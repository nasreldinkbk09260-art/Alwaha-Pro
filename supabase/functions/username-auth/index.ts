import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const usernamePattern = /^[a-z0-9_]{3,32}$/;

function normalizeUsername(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}
function validPhone(value: unknown): string | null {
  const phone = String(value ?? '').trim();
  if (!phone) return null;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}
async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  let body: Record<string, unknown>;
  try {
    const length = Number(req.headers.get('content-length') || 0);
    if (length > 20_000) return json({ error: 'Request too large.' }, 413);
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const action = String(body.action || '');
  const username = normalizeUsername(body.username);
  const password = String(body.password || '');
  if (!usernamePattern.test(username)) return json({ error: 'اسم المستخدم يجب أن يتكون من 3 إلى 32 حرفًا إنجليزيًا أو رقمًا أو _.' }, 400);
  if (password.length < 8 || password.length > 128) return json({ error: 'كلمة المرور يجب أن تكون من 8 إلى 128 حرفًا.' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Username authentication is not configured on the server.' }, 500);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (action === 'register') {
    // A username-auth account uses a private, non-deliverable Auth email internally;
    // the username is the public sign-in handle. The phone is optional contact data only.
    const firstName = String(body.first_name || '').trim().slice(0, 80);
    const lastName = String(body.last_name || '').trim().slice(0, 80);
    const gender = body.gender === 'أنثى' ? 'أنثى' : 'ذكر';
    const birthdate = String(body.birthdate || '').trim();
    const phoneRaw = String(body.phone || '').trim();
    const phone = validPhone(phoneRaw);
    if (!firstName) return json({ error: 'اكتب الاسم الأول.' }, 400);
    if (phoneRaw && !phone) return json({ error: 'رقم الهاتف يجب أن يكون بصيغة دولية صحيحة مثل +201xxxxxxxxx.' }, 400);
    if (birthdate && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return json({ error: 'تاريخ الميلاد غير صالح.' }, 400);

    const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown-client';
    const ip = forwarded.split(',')[0].trim().slice(0, 120);
    const ipHash = await sha256(`${ip}:register`);
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin.from('username_signup_attempts')
      .select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since);
    if (countError) return json({ error: 'تعذر التحقق من حد التسجيل؛ حاول لاحقًا.' }, 503);
    if ((count || 0) >= 5) return json({ error: 'تم بلوغ حد إنشاء الحسابات مؤقتًا. حاول بعد 15 دقيقة.' }, 429);
    const { error: attemptError } = await admin.from('username_signup_attempts').insert({ ip_hash: ipHash });
    if (attemptError) return json({ error: 'تعذر بدء التسجيل الآن.' }, 503);
    await admin.from('username_signup_attempts').delete().lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const { data: existing, error: lookupError } = await admin.from('users').select('id').eq('username', username).limit(1).maybeSingle();
    if (lookupError) return json({ error: 'تعذر التحقق من اسم المستخدم. طبّق تحديث قاعدة البيانات أولًا.' }, 503);
    if (existing) return json({ error: 'اسم المستخدم مستخدم بالفعل؛ اختر اسمًا آخر.' }, 409);

    const internalEmail = `${username}@users.alwaha.invalid`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username, first_name: firstName, last_name: lastName, gender,
        birthdate: birthdate || null, phone: phone || '', avatar_url: null,
        hide_email: true, hide_phone: true,
      },
    });
    if (createError || !created.user) {
      console.error('username-auth createUser:', createError?.message);
      return json({ error: 'تعذر إنشاء الحساب. تحقق من اسم المستخدم ثم حاول مرة أخرى.' }, 400);
    }

    const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({ email: internalEmail, password });
    if (signInError || !signedIn.session) {
      await admin.auth.admin.deleteUser(created.user.id);
      console.error('username-auth signIn:', signInError?.message);
      return json({ error: 'أُنشئ الحساب لكن تعذر تسجيل الدخول تلقائيًا؛ جرّب تسجيل الدخول باسم المستخدم.' }, 500);
    }
    return json({ session: signedIn.session, user: signedIn.user, username });
  }

  if (action === 'login') {
    const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown-client';
    const ip = forwarded.split(',')[0].trim().slice(0, 120);
    const ipHash = await sha256(`${ip}:login`);
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin.from('username_signup_attempts')
      .select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since);
    if (countError) return json({ error: 'تعذر التحقق من محاولات الدخول؛ حاول لاحقًا.' }, 503);
    if ((count || 0) >= 15) return json({ error: 'محاولات دخول كثيرة. انتظر 15 دقيقة ثم حاول مرة أخرى.' }, 429);
    const { error: attemptError } = await admin.from('username_signup_attempts').insert({ ip_hash: ipHash });
    if (attemptError) return json({ error: 'تعذر بدء تسجيل الدخول الآن.' }, 503);
    const { data: profile, error: lookupError } = await admin.from('users').select('identifier,username').eq('username', username).limit(1).maybeSingle();
    if (lookupError || !profile?.identifier) return json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' }, 401);
    const { data, error } = await client.auth.signInWithPassword({ email: profile.identifier, password });
    if (error || !data.session) return json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة. إذا كان الحساب بالبريد، تأكد من البريد أولًا.' }, 401);
    return json({ session: data.session, user: data.user, username: profile.username });
  }

  return json({ error: 'Unsupported action.' }, 400);
});
