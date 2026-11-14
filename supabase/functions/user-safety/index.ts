import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const targetTypes = new Set(['user','post','reel','comment']);
const reasons = new Set(['spam','harassment','inappropriate','violence','fraud','other']);
type Body = Record<string, unknown>;
const asBody = (value: unknown): Body => value && typeof value === 'object' && !Array.isArray(value) ? value as Body : {};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'طريقة الطلب غير مسموحة.' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'خدمة سلامة المستخدم غير مهيأة.' }, 503);
  const authHeader = req.headers.get('Authorization') || '';
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) return json({ error: 'سجّل الدخول أولًا.' }, 401);
  let body: Body;
  try {
    const length = Number(req.headers.get('content-length') || 0);
    if (length > 10000) return json({ error: 'حجم الطلب أكبر من المسموح.' }, 413);
    body = asBody(await req.json());
  } catch { return json({ error: 'بيانات الطلب غير صالحة.' }, 400); }

  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(tokenMatch[1].trim());
  const user = authData?.user;
  if (authError || !user) return json({ error: 'الجلسة غير صالحة؛ سجّل الدخول مجددًا.' }, 401);
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const action = String(body.action || '');

  try {
    if (action === 'report_content') {
      const targetType = String(body.targetType || '');
      const targetId = String(body.targetId || '').trim();
      const reason = String(body.reason || '');
      const details = String(body.details || '').trim();
      if (!targetTypes.has(targetType) || !targetId || targetId.length > 64 || !reasons.has(reason) || details.length > 850) {
        return json({ error: 'بيانات البلاغ غير صالحة.' }, 400);
      }
      if (targetType === 'user' ? !uuidPattern.test(targetId) : !/^\d{1,18}$/.test(targetId)) {
        return json({ error: 'معرّف الحساب أو المحتوى غير صالح.' }, 400);
      }
      let ownerId: string | null = null;
      if (targetType === 'user') {
        const { data, error } = await db.from('users').select('id').eq('id', targetId).maybeSingle();
        if (error || !data) return json({ error: 'لم يتم العثور على الحساب.' }, 404);
        ownerId = String(data.id);
      } else {
        const table = targetType === 'post' ? 'posts' : targetType === 'reel' ? 'reels' : 'comments';
        const ownerColumn = targetType === 'comment' ? 'user_id' : 'author_id';
        const { data, error } = await db.from(table).select('id,' + ownerColumn).eq('id', targetId).maybeSingle();
        if (error || !data) return json({ error: 'لم يتم العثور على المحتوى.' }, 404);
        ownerId = data[ownerColumn] ? String(data[ownerColumn]) : null;
      }
      if (!ownerId) return json({ error: 'تعذر تحديد صاحب المحتوى.' }, 409);
      if (ownerId === user.id) return json({ error: 'لا يمكنك الإبلاغ عن حسابك أو محتواك.' }, 400);
      const since = new Date(Date.now() - 86400000).toISOString();
      const { count, error: rateError } = await db.from('content_reports').select('id',{count:'exact',head:true}).eq('reporter_id',user.id).gte('created_at',since);
      if (rateError) throw new Error('report_rate_check_failed');
      if ((count || 0) >= 10) return json({ error: 'وصلت إلى الحد اليومي للبلاغات. حاول بعد 24 ساعة.' },429);
      const { data: openReport, error: dupError } = await db.from('content_reports').select('id')
        .eq('reporter_id',user.id).eq('target_type',targetType).eq('target_id',targetId)
        .in('status',['pending','under_review']).maybeSingle();
      if (dupError) throw new Error('report_duplicate_check_failed');
      if (openReport) return json({ok:true,duplicate:true,message:'يوجد بلاغ مفتوح عن هذا المحتوى بالفعل.'});
      const { error: insertError } = await db.from('content_reports').insert({
        reporter_id:user.id,target_type:targetType,target_id:targetId,target_user_id:ownerId,reason,details,status:'pending'
      });
      if (insertError) {
        if (insertError.code==='23505') return json({ok:true,duplicate:true,message:'يوجد بلاغ مفتوح عن هذا المحتوى بالفعل.'});
        throw new Error('report_insert_failed');
      }
      return json({ok:true,message:'تم إرسال البلاغ للمراجعة.'});
    }

    if (action === 'block_user' || action === 'unblock_user') {
      const targetId = String(body.userId || '');
      if (!uuidPattern.test(targetId) || targetId===user.id) return json({error:'معرّف الحساب غير صالح.'},400);
      const {data:target,error:targetError}=await db.from('users').select('id').eq('id',targetId).maybeSingle();
      if (targetError || !target) return json({error:'لم يتم العثور على الحساب.'},404);
      if (action==='block_user') {
        const {error}=await db.from('user_blocks').upsert({blocker_id:user.id,blocked_user_id:targetId},{onConflict:'blocker_id,blocked_user_id',ignoreDuplicates:true});
        if(error)throw new Error('block_insert_failed');
        const [f1,f2,fr]=await Promise.all([
          db.from('follows').delete().eq('follower_id',user.id).eq('following_id',targetId),
          db.from('follows').delete().eq('follower_id',targetId).eq('following_id',user.id),
          db.from('friend_requests').delete().or('and(requester_id.eq.'+user.id+',target_id.eq.'+targetId+'),and(requester_id.eq.'+targetId+',target_id.eq.'+user.id+')')
        ]);
        if(f1.error||f2.error||fr.error)throw new Error('block_relationship_cleanup_failed');
        return json({ok:true,blocked:true});
      }
      const {error}=await db.from('user_blocks').delete().eq('blocker_id',user.id).eq('blocked_user_id',targetId);
      if(error)throw new Error('unblock_failed');
      return json({ok:true,blocked:false});
    }

    if (action === 'block_status') {
      const targetId = String(body.userId || '');
      if (!uuidPattern.test(targetId) || targetId===user.id) return json({error:'معرّف الحساب غير صالح.'},400);
      const [a,b]=await Promise.all([
        db.from('user_blocks').select('id').eq('blocker_id',user.id).eq('blocked_user_id',targetId).maybeSingle(),
        db.from('user_blocks').select('id').eq('blocker_id',targetId).eq('blocked_user_id',user.id).maybeSingle()
      ]);
      if(a.error||b.error)throw new Error('block_status_failed');
      return json({ok:true,blockedByMe:!!a.data,blockedMe:!!b.data});
    }

    if (action === 'list_my_blocks') {
      const [a,b]=await Promise.all([
        db.from('user_blocks').select('blocked_user_id').eq('blocker_id',user.id),
        db.from('user_blocks').select('blocker_id').eq('blocked_user_id',user.id)
      ]);
      if(a.error||b.error)throw new Error('block_list_failed');
      return json({ok:true,blockedByMe:(a.data||[]).map(x=>x.blocked_user_id),blockedMe:(b.data||[]).map(x=>x.blocker_id)});
    }
    return json({error:'الإجراء غير مدعوم.'},400);
  } catch(error) {
    console.error('user-safety operation failed:',String(error));
    return json({error:'تعذر إكمال الإجراء الآن. حاول مرة أخرى.'},503);
  }
});
