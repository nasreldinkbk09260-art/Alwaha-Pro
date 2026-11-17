import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const usernamePattern = /^[a-z0-9_]{3,32}$/;
const allowedFields = new Set(['first_name', 'last_name', 'username', 'email', 'phone', 'gender', 'birthdate', 'avatar_url']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'طريقة الطلب غير مسموحة.' }, 405);

  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
  if (!token) return json({ error: 'يجب تسجيل الدخول أولاً.' }, 401);

  let body: Record<string, unknown>;
  try {
    const declaredLength = Number(req.headers.get('content-length') || 0);
    if (declaredLength > 20_000) return json({ error: 'حجم الطلب أكبر من المسموح.' }, 413);
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'بيانات الطلب غير صالحة.' }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: 'بيانات الطلب غير صالحة.' }, 400);
  }
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !allowedFields.has(key))) return json({ error: 'الطلب يحتوي على حقول غير مسموح بتعديلها.' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'خدمة تحديث الملف غير مهيأة على الخادم.' }, 500);

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user?.id) return json({ error: 'انتهت جلسة الدخول. سجّل الدخول مجددًا.' }, 401);

  const { data: existing, error: existingError } = await admin.from('users')
    .select('id,username').eq('id', user.id).maybeSingle();
  if (existingError || !existing) return json({ error: 'تعذر العثور على الملف الشخصي لهذا الحساب.' }, 404);

  const update: Record<string, unknown> = {};
  if ('first_name' in body) {
    const value = String(body.first_name ?? '').trim();
    if (!value || value.length > 80) return json({ error: 'الاسم الظاهر مطلوب وبحد أقصى 80 حرفًا.' }, 400);
    update.first_name = value;
  }
  if ('last_name' in body) {
    const value = String(body.last_name ?? '').trim();
    if (value.length > 80) return json({ error: 'اسم العائلة أطول من الحد المسموح.' }, 400);
    update.last_name = value;
  }
  if ('username' in body) {
    const value = String(body.username ?? '').trim().toLowerCase();
    if (!usernamePattern.test(value)) return json({ error: 'اسم المستخدم يجب أن يكون من 3 إلى 32 حرفًا إنجليزيًا صغيرًا أو رقمًا أو _.' }, 400);
    if (value !== String(existing.username || '').toLowerCase()) {
      const { data: duplicate, error: lookupError } = await admin.from('users')
        .select('id').eq('username', value).neq('id', user.id).limit(1).maybeSingle();
      if (lookupError) return json({ error: 'تعذر التحقق من اسم المستخدم الآن.' }, 503);
      if (duplicate) return json({ error: 'اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر.' }, 409);
    }
    update.username = value;
  }
  if ('phone' in body) {
    const value = String(body.phone ?? '').trim();
    if (value && !/^\+[1-9]\d{7,14}$/.test(value)) return json({ error: 'رقم الهاتف يجب أن يكون بصيغة دولية صحيحة.' }, 400);
    update.phone = value;
  }
  if ('gender' in body) {
    const value = String(body.gender ?? 'ذكر');
    if (!['ذكر', 'أنثى'].includes(value)) return json({ error: 'قيمة النوع غير صحيحة.' }, 400);
    update.gender = value;
  }
  if ('birthdate' in body) {
    const value = body.birthdate == null ? '' : String(body.birthdate).trim();
    if (value) {
      const date = new Date(value + 'T00:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || date.getTime() > Date.now()) {
        return json({ error: 'تاريخ الميلاد غير صحيح.' }, 400);
      }
      update.birthdate = value;
    } else update.birthdate = null;
  }
  if ('avatar_url' in body) {
    const value = String(body.avatar_url ?? '').trim();
    const storagePrefix = supabaseUrl.replace(/\/+$/, '') + '/storage/v1/object/public/media/' + user.id + '/avatars/';
    if (!value.startsWith(storagePrefix) || value.length > 2000 || /[?#]/.test(value)) {
      return json({ error: 'الصورة يجب أن تكون مرفوعة داخل مجلد صور هذا الحساب فقط.' }, 400);
    }
    update.avatar_url = value;
  }

  let requestedEmail = '';
  if ('email' in body) {
    const email = String(body.email ?? '').trim().toLowerCase();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'صيغة البريد الإلكتروني غير صحيحة.' }, 400);
    if (email && email !== String(user.email || '').trim().toLowerCase()) requestedEmail = email;
  }

  let profile: Record<string, unknown> | null = null;
  let metadataSynced = true;
  if (Object.keys(update).length) {
    update.updated_at = new Date().toISOString();
    const { data: updatedProfile, error: updateError } = await admin.from('users').update(update).eq('id', user.id)
      .select('id,first_name,last_name,username,phone,gender,birthdate,avatar_url').maybeSingle();
    if (updateError) {
      if (updateError.code === '23505') return json({ error: 'اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر.' }, 409);
      console.warn('Profile update failed:', updateError.code || 'database_update_failed');
      return json({ error: 'تعذر حفظ بيانات الملف الشخصي الآن.' }, 503);
    }
    if (!updatedProfile) return json({ error: 'لم يتم تحديث الملف الشخصي. أعد تحميل بيانات الحساب وحاول مجددًا.' }, 409);
    profile = updatedProfile;

    const metadata: Record<string, unknown> = { ...(user.user_metadata || {}), ...update };
    delete metadata.updated_at;
    const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, { user_metadata: metadata });
    metadataSynced = !metadataError;
    if (metadataError) console.warn('Profile metadata sync warning:', metadataError.code || 'metadata_sync_failed');
  }

  let emailUpdateRequested = false;
  let emailError = '';
  if (requestedEmail) {
    const response = await fetch(supabaseUrl.replace(/\/+$/, '') + '/auth/v1/user', {
      method: 'PUT',
      headers: { apikey: anonKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: requestedEmail }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) emailUpdateRequested = true;
    else emailError = String(result.msg || result.message || result.error_description || 'تعذر طلب تغيير البريد الآن.').slice(0, 240);
  }

  if (!profile && !emailUpdateRequested && !emailError) return json({ error: 'لم يتم إرسال أي بيانات قابلة للتعديل.' }, 400);
  return json({ ok: true, profile, metadata_synced: metadataSynced, email_update_requested: emailUpdateRequested, email_error: emailError });
});