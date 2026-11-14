import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const TEST_MEDIA_OBJECTS = [
  "0294e707-23a7-432b-b6a4-a3974f0722d1/products/9151ec12-9f90-4d20-9cc8-37ed27621cc8.jpg",
  "16f1efcd-4d24-4bda-a6ea-1586fe36a30b/products/794d9372-1f7e-4912-a094-756b9e4ed67a.jpg",
  "61f76c4c-1ddc-4627-966e-30573ff594c3/reels/459bdcbe-e40d-4bf1-937a-15f7c0bee8b6.mp4",
  "65a272fc-4c34-4658-be60-e72229e802a3/avatars/6062cb06-9ac9-453d-8115-6a75eb204eac.jpg",
  "65a272fc-4c34-4658-be60-e72229e802a3/avatars/b3a1d7f4-a953-4bd6-b687-eec40b81e9af.jpg",
  "97e19be3-5fe4-4388-953c-cceadaadf52b/products/ab28bb39-c819-45ff-bad9-b4c9b1d47ff9.jpg",
  "97e19be3-5fe4-4388-953c-cceadaadf52b/products/fe49d57d-53ac-455f-afa3-e7c3574eaa3c.jpg",
  "ab919b98-2fa7-41dc-afb0-ae5aecaf0c22/avatars/91b8a12d-5984-4523-b82c-44aaa551fcba.jpg",
  "ab919b98-2fa7-41dc-afb0-ae5aecaf0c22/avatars/a8e03a92-d9ea-414b-a5bf-a911eaf40136.jpg",
  "ab919b98-2fa7-41dc-afb0-ae5aecaf0c22/posts/0a161ee9-27e6-4b2f-a4e4-b8aa4cd11f2d.jpg",
  "ab919b98-2fa7-41dc-afb0-ae5aecaf0c22/products/84335437-d9fd-4481-8f57-18cc4d18b2ae.jpg",
  "bf50b2a7-6960-425f-83c3-f746b360a100/avatars/6955e40a-a248-426f-8276-4266b134834a.jpg",
  "cbb082e5-c921-4753-844d-aaff30837b58/products/5b00e8ab-24d0-413a-ae6b-ae4199a52923.jpg",
  "cbb082e5-c921-4753-844d-aaff30837b58/products/9af1be8d-ed59-4a5e-88d2-0e1230a3e02d.jpg",
  "cbb082e5-c921-4753-844d-aaff30837b58/products/f6b6da2d-4fb0-4c23-ac38-5c90379614e3.jpg",
  "f9fe4f8d-2f35-481c-8e2d-6489a176a4b6/posts/27696d0b-6f23-4b7d-84ba-d06d4af5e259.jpg",
  "fdeae4c4-5f31-4c0b-8c46-d8f21b63a89a/avatars/1eece8ae-e315-4505-93e9-4cfb2944060b.jpg",
  "fdeae4c4-5f31-4c0b-8c46-d8f21b63a89a/avatars/27d5054e-9ed3-458e-a6d2-8adc0f9ce8bf.jpg"
] as const;
const TEST_MEDIA_PURGE_CONFIRMATION = 'PURGE_TEST_MEDIA_20261114';

type AdminAction = 'summary' | 'list_users' | 'list_verification_requests' | 'review_verification' | 'list_audit_logs' | 'purge_test_media';
const allowedActions = new Set<AdminAction>([
  'summary', 'list_users', 'list_verification_requests', 'review_verification', 'list_audit_logs', 'purge_test_media',
]);

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return Number.isInteger(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => '\\' + ch);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'طريقة الطلب غير مسموحة.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('admin-api server configuration is incomplete');
    return json({ error: 'خدمة الإدارة غير مهيأة على الخادم.' }, 500);
  }

  const authorization = req.headers.get('Authorization') || '';
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) return json({ error: 'يلزم تسجيل الدخول مجددًا.' }, 401);
  const token = tokenMatch[1].trim();

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return json({ error: 'الجلسة غير صالحة؛ سجّل الدخول مجددًا.' }, 401);

  const server = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await server
    .from('users').select('id,is_admin').eq('id', user.id).maybeSingle();
  if (profileError) {
    console.error('admin-api role lookup failed:', profileError.message);
    return json({ error: 'تعذر التحقق من صلاحية الإدارة.' }, 503);
  }
  if (!profile?.is_admin) {
    const { error: deniedLogError } = await server.from('admin_action_logs').insert({
      actor_user_id: user.id, action: 'summary', outcome: 'denied',
      details: { reason: 'admin_required' },
    });
    if (deniedLogError) console.error('admin-api denied request could not be audited:', deniedLogError.message);
    return json({ error: 'هذا الحساب لا يملك صلاحية الإدارة.' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    const declaredLength = Number(req.headers.get('content-length') || 0);
    if (declaredLength > 12_000) return json({ error: 'حجم الطلب أكبر من المسموح.' }, 413);
    body = asObject(await req.json());
  } catch {
    return json({ error: 'بيانات الطلب غير صالحة.' }, 400);
  }
  const action = String(body.action || '') as AdminAction;
  if (!allowedActions.has(action)) return json({ error: 'الإجراء غير مدعوم.' }, 400);
  if (action === 'purge_test_media' && body.confirmPurge !== TEST_MEDIA_PURGE_CONFIRMATION) {
    return json({ error: 'يلزم تأكيد صريح قبل حذف ملفات التجارب.' }, 400);
  }

  const offset = boundedInteger(body.offset, 0, 0, 100_000);
  const limit = boundedInteger(body.limit, 50, 1, 100);
  const query = String(body.query || '').trim().slice(0, 80);
  const requestStatus = String(body.status || 'pending');
  if (action === 'list_verification_requests' &&
      !['all', 'pending', 'approved', 'rejected'].includes(requestStatus)) {
    return json({ error: 'حالة الطلب غير صالحة.' }, 400);
  }
  let reviewId = '';
  let reviewStatus = '';
  if (action === 'review_verification') {
    const rawId = String(body.id ?? '');
    if (!/^\d{1,18}$/.test(rawId) || !Number.isSafeInteger(Number(rawId)) || Number(rawId) < 1) {
      return json({ error: 'رقم طلب التوثيق غير صالح.' }, 400);
    }
    reviewId = rawId;
    reviewStatus = String(body.status || '');
    if (!['approved', 'rejected'].includes(reviewStatus)) {
      return json({ error: 'قرار التوثيق غير صالح.' }, 400);
    }
  }

  const auditDetails: Record<string, unknown> = {};
  if (action === 'list_users') Object.assign(auditDetails, { offset, limit, filtered: Boolean(query) });
  if (action === 'list_verification_requests') Object.assign(auditDetails, { status: requestStatus, offset, limit });
  if (action === 'list_audit_logs') Object.assign(auditDetails, { offset, limit });
  if (action === 'review_verification') Object.assign(auditDetails, { status: reviewStatus });
  if (action === 'purge_test_media') Object.assign(auditDetails, {
    bucket: 'media', scope: 'fixed_test_only_orphaned_objects', requestedCount: TEST_MEDIA_OBJECTS.length,
  });
  const { data: audit, error: auditInsertError } = await server.from('admin_action_logs').insert({
    actor_user_id: user.id,
    action,
    target_id: action === 'review_verification' ? reviewId : action === 'purge_test_media' ? 'media:test-assets-20261114' : null,
    outcome: 'pending',
    details: auditDetails,
  }).select('id').single();
  if (auditInsertError || !audit) {
    console.error('admin-api could not create audit record:', auditInsertError?.message);
    return json({ error: 'تعذر تسجيل العملية بأمان؛ لم يُنفذ الإجراء.' }, 503);
  }

  const finishAudit = async (outcome: 'success' | 'denied' | 'error', details = auditDetails) => {
    const { error } = await server.from('admin_action_logs')
      .update({ outcome, details }).eq('id', audit.id);
    if (error) console.error('admin-api audit finalization failed:', error.message);
    return !error;
  };

  try {
    let result: Record<string, unknown>;

    if (action === 'summary') {
      const [u, p] = await Promise.all([
        server.from('users').select('id', { count: 'exact', head: true }),
        server.from('verification_requests').select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
      ]);
      if (u.error || p.error) throw new Error('summary_query_failed');
      result = { usersCount: u.count ?? 0, pendingCount: p.count ?? 0 };
    } else if (action === 'list_users') {
      const columns = 'id,first_name,last_name,identifier,username,is_verified,is_admin,created_at';
      let rows: Record<string, unknown>[] = [];
      let hasMore = false;
      if (!query) {
        const { data, error } = await server.from('users').select(columns)
          .order('created_at', { ascending: false }).range(offset, offset + limit);
        if (error) throw new Error('users_query_failed');
        const page = data || [];
        hasMore = page.length > limit;
        rows = page.slice(0, limit);
      } else {
        const pattern = '%' + escapeLike(query) + '%';
        const fields = ['first_name', 'last_name', 'identifier', 'username'];
        const matches = await Promise.all(fields.map((field) =>
          server.from('users').select(columns).ilike(field, pattern)
            .order('created_at', { ascending: false }).limit(Math.min(100, limit + offset + 1))
        ));
        if (matches.some((item) => item.error)) throw new Error('users_search_failed');
        const deduped = new Map<string, Record<string, unknown>>();
        for (const item of matches) for (const row of (item.data || [])) deduped.set(String(row.id), row);
        rows = [...deduped.values()].sort((a, b) =>
          String(b.created_at || '').localeCompare(String(a.created_at || ''))
        ).slice(offset, offset + limit);
      }
      result = { users: rows, offset, limit, hasMore };
    } else if (action === 'list_verification_requests') {
      let q = server.from('verification_requests')
        .select('id,user_id,reason,status,created_at,reviewed_at,reviewed_by,category,profile_url,extra_details')
        .order('created_at', { ascending: false });
      if (requestStatus !== 'all') q = q.eq('status', requestStatus);
      const { data, error } = await q.range(offset, offset + limit);
      if (error) throw new Error('verification_query_failed');
      const page = data || [];
      result = { requests: page.slice(0, limit), offset, limit, hasMore: page.length > limit };
    } else if (action === 'list_audit_logs') {
      const { data, error } = await server.from('admin_action_logs')
        .select('id,actor_user_id,action,target_id,outcome,details,created_at')
        .neq('id', audit.id).order('created_at', { ascending: false })
        .range(offset, offset + limit);
      if (error) throw new Error('audit_log_query_failed');
      const page = data || [];
      result = { entries: page.slice(0, limit), offset, limit, hasMore: page.length > limit };
    } else if (action === 'purge_test_media') {
      const { data, error } = await server.storage.from('media').remove([...TEST_MEDIA_OBJECTS]);
      if (error) throw new Error('test_media_storage_remove_failed');
      result = { removedCount: (data || []).length, requestedCount: TEST_MEDIA_OBJECTS.length };
    } else {
      const { data, error } = await server.from('verification_requests')
        .update({ status: reviewStatus, reviewed_by: user.id })
        .eq('id', Number(reviewId)).eq('status', 'pending')
        .select('id,user_id,status,reviewed_at').maybeSingle();
      if (error) throw new Error('verification_update_failed');
      if (!data) {
        await finishAudit('denied', { ...auditDetails, reason: 'not_pending_or_not_found' });
        return json({ error: 'الطلب غير موجود أو تمت مراجعته مسبقًا؛ حدّث القائمة.' }, 409);
      }
      result = { reviewedRequest: data };
    }

    const completionDetails = action === 'purge_test_media'
      ? { ...auditDetails, removedCount: result.removedCount ?? 0 }
      : auditDetails;
    const auditOk = await finishAudit('success', completionDetails);
    if (!auditOk) {
      console.error('admin-api request completed, but audit finalization failed');
      return json({ ...result, warning: 'تمت العملية لكن تعذر تأكيد سجل التدقيق؛ راجع سجل الخادم.' }, 200);
    }
    return json(result);
  } catch (error) {
    console.error('admin-api operation failed:', action, error instanceof Error ? error.message : 'unknown');
    await finishAudit('error', { ...auditDetails, errorCode: 'operation_failed' });
    return json({ error: 'تعذر تنفيذ العملية الآن. حاول التحديث، وإذا استمر الخطأ افحص سجل الخادم.' }, 503);
  }
});
