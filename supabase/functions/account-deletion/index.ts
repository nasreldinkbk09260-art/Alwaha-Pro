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
const BUCKETS = ['media', 'avatars', 'posts', 'products'] as const;
const PAGE_SIZE = 500;
const MAX_ROWS = 20000;
const MAX_STORAGE_OBJECTS = 20000;

type StorageReference = { bucket: string; path: string };

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function storageReference(value: string, userId: string, supabaseUrl: string): StorageReference | null {
  try {
    const url = new URL(value, supabaseUrl);
    const marker = '/storage/v1/object/';
    const index = url.pathname.indexOf(marker);
    if (index < 0) return null;
    const parts = url.pathname.slice(index + marker.length).split('/');
    const access = parts.shift();
    const bucket = parts.shift();
    if (!['public', 'sign', 'authenticated'].includes(String(access))
        || !BUCKETS.includes(bucket as typeof BUCKETS[number])) return null;
    const path = decodeURIComponent(parts.join('/'));
    if (!path.startsWith(userId + '/')) return null;
    return { bucket: String(bucket), path };
  } catch (_) {
    return null;
  }
}
function collectOwnedReferences(value: unknown, userId: string, supabaseUrl: string, output: Map<string, StorageReference>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectOwnedReferences(item, userId, supabaseUrl, output);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) collectOwnedReferences(item, userId, supabaseUrl, output);
    return;
  }
  if (typeof value !== 'string' || !value.trim()) return;
  const ref = storageReference(value, userId, supabaseUrl);
  if (ref) output.set(ref.bucket + ':' + ref.path, ref);
}
function rewriteOwnedReferences(value: unknown, userId: string, supabaseUrl: string, replacements: Map<string, string>): unknown {
  if (Array.isArray(value)) return value.map(item => rewriteOwnedReferences(item, userId, supabaseUrl, replacements));
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = rewriteOwnedReferences(item, userId, supabaseUrl, replacements);
    }
    return result;
  }
  if (typeof value !== 'string') return value;
  const ref = storageReference(value, userId, supabaseUrl);
  if (!ref) return value;
  return replacements.get(ref.bucket + ':' + ref.path) || value;
}
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function collectRows(
  db: any,
  table: string,
  columns: string,
  apply: (query: any) => any,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await apply(db.from(table).select(columns)).range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error('account_deletion_database_read_failed');
    const page = (data || []) as Record<string, unknown>[];
    rows.push(...page);
    if (rows.length > MAX_ROWS) throw new Error('account_deletion_row_limit_exceeded');
    if (page.length < PAGE_SIZE) return rows;
  }
}
async function listOwnedObjects(
  db: any,
  bucket: string,
  prefix: string,
  output: string[],
  depth = 0,
): Promise<void> {
  if (depth > 6) throw new Error('account_deletion_storage_depth_exceeded');
  let offset = 0;
  for (;;) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error('account_deletion_storage_list_failed');
    const entries = data || [];
    for (const entry of entries) {
      const path = prefix + '/' + entry.name;
      if (entry.id || entry.metadata) {
        output.push(path);
        if (output.length > MAX_STORAGE_OBJECTS) throw new Error('account_deletion_storage_limit_exceeded');
      } else {
        await listOwnedObjects(db, bucket, path, output, depth + 1);
      }
    }
    if (entries.length < 1000) return;
    offset += entries.length;
  }
}
async function archiveMarketplaceReferences(
  db: any,
  references: Map<string, StorageReference>,
): Promise<Map<string, string>> {
  const replacements = new Map<string, string>();
  for (const [key, ref] of references) {
    const hash = await sha256(key);
    const originalName = ref.path.split('/').pop() || 'media.bin';
    const extensionMatch = originalName.match(/\.([a-z0-9]{1,10})$/i);
    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'bin';
    const fileName = hash + '.' + extension;
    const destination = 'marketplace-archive/' + fileName;

    // Objects created through the service key have no user owner, allowing the
    // Auth account to be removed while their market/warranty references survive.
    const { data: existing, error: listError } = await db.storage.from(ref.bucket)
      .list('marketplace-archive', { limit: 5, search: fileName });
    if (listError) throw new Error('account_deletion_marketplace_archive_check_failed');
    const alreadyArchived = (existing || []).some(item => item.name === fileName && (item.id || item.metadata));
    if (!alreadyArchived) {
      const { error: copyError } = await db.storage.from(ref.bucket).copy(ref.path, destination);
      if (copyError) throw new Error('account_deletion_marketplace_media_archive_failed');
    }
    const publicUrl = db.storage.from(ref.bucket).getPublicUrl(destination).data.publicUrl;
    if (!publicUrl) throw new Error('account_deletion_marketplace_media_url_failed');
    replacements.set(key, publicUrl);
  }
  return replacements;
}
async function deleteOwnedObjects(
  db: any,
  userId: string,
): Promise<number> {
  let removed = 0;
  for (const bucket of BUCKETS) {
    const objects: string[] = [];
    await listOwnedObjects(db, bucket, userId, objects);
    for (let offset = 0; offset < objects.length; offset += 1000) {
      const { data, error } = await db.storage.from(bucket).remove(objects.slice(offset, offset + 1000));
      if (error) throw new Error('account_deletion_storage_remove_failed');
      removed += (data || []).length;
    }
  }
  return removed;
}
async function deleteCommentsForTargets(
  db: any,
  targetType: string,
  ids: string[],
): Promise<void> {
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { error } = await db.from('comments').delete().eq('target_type', targetType)
      .in('target_id', ids.slice(offset, offset + 100));
    if (error) throw new Error('account_deletion_comments_cleanup_failed');
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'طريقة الطلب غير مسموحة.' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'خدمة حذف الحساب غير مهيأة.' }, 503);
  const match = (req.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return json({ error: 'سجّل الدخول أولًا.' }, 401);

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 12000) return json({ error: 'حجم الطلب أكبر من المسموح.' }, 413);
    body = asObject(JSON.parse(raw));
  } catch (_) {
    return json({ error: 'بيانات الطلب غير صالحة.' }, 400);
  }
  const password = String(body.password || '');
  if (password.length < 8 || password.length > 128) return json({ error: 'أدخل كلمة المرور الحالية لإثبات ملكية الحساب.' }, 400);

  const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = match[1].trim();
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user || !user.email) return json({ error: 'الجلسة أو البريد المرتبط بالحساب غير صالحين.' }, 401);
  const { data: reauthenticated, error: reauthError } = await auth.auth.signInWithPassword({ email: user.email, password });
  if (reauthError || reauthenticated.user?.id !== user.id) return json({ error: 'كلمة المرور غير صحيحة أو البريد غير مؤكد.' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin.from('users').select('id,is_admin').eq('id', user.id).maybeSingle();
  if (profileError || !profile) return json({ error: 'تعذر التحقق من ملكية الحساب.' }, 503);
  if (profile.is_admin === true) return json({ error: 'لا يمكن حذف حساب الإدارة من مسار المستخدمين.' }, 403);

  try {
    const products = await collectRows(admin, 'products', 'id,image_url,image_urls', q => q.eq('seller_id', user.id));
    const conversations = await collectRows(admin, 'market_conversations', 'id,listing_snapshot',
      q => q.or('buyer_id.eq.' + user.id + ',seller_id.eq.' + user.id));
    const transactions = await collectRows(admin, 'market_transactions', 'id,listing_snapshot',
      q => q.or('buyer_id.eq.' + user.id + ',seller_id.eq.' + user.id));

    const references = new Map<string, StorageReference>();
    for (const row of products) {
      collectOwnedReferences(row.image_url, user.id, supabaseUrl, references);
      collectOwnedReferences(row.image_urls, user.id, supabaseUrl, references);
    }
    for (const row of conversations) collectOwnedReferences(row.listing_snapshot, user.id, supabaseUrl, references);
    for (const row of transactions) collectOwnedReferences(row.listing_snapshot, user.id, supabaseUrl, references);

    // Archive all retained marketplace media with service-role ownership (owner_id NULL),
    // update every snapshot/product reference, then remove all user-owned originals.
    const replacements = await archiveMarketplaceReferences(admin, references);
    for (const row of products) {
      const imageUrl = rewriteOwnedReferences(row.image_url, user.id, supabaseUrl, replacements);
      const imageUrls = rewriteOwnedReferences(row.image_urls, user.id, supabaseUrl, replacements);
      if (JSON.stringify(imageUrl) !== JSON.stringify(row.image_url)
          || JSON.stringify(imageUrls) !== JSON.stringify(row.image_urls)) {
        const { error } = await admin.from('products').update({ image_url: imageUrl, image_urls: imageUrls }).eq('id', row.id);
        if (error) throw new Error('account_deletion_marketplace_product_update_failed');
      }
    }
    for (const row of conversations) {
      const snapshot = rewriteOwnedReferences(row.listing_snapshot, user.id, supabaseUrl, replacements);
      if (JSON.stringify(snapshot) !== JSON.stringify(row.listing_snapshot)) {
        const { error } = await admin.from('market_conversations').update({ listing_snapshot: snapshot }).eq('id', row.id);
        if (error) throw new Error('account_deletion_marketplace_conversation_update_failed');
      }
    }
    for (const row of transactions) {
      const snapshot = rewriteOwnedReferences(row.listing_snapshot, user.id, supabaseUrl, replacements);
      if (JSON.stringify(snapshot) !== JSON.stringify(row.listing_snapshot)) {
        const { error } = await admin.from('market_transactions').update({ listing_snapshot: snapshot }).eq('id', row.id);
        if (error) throw new Error('account_deletion_marketplace_transaction_update_failed');
      }
    }

    const posts = await collectRows(admin, 'posts', 'id', q => q.eq('author_id', user.id));
    const reels = await collectRows(admin, 'reels', 'id', q => q.eq('author_id', user.id));
    const postIds = posts.map(row => String(row.id)), reelIds = reels.map(row => String(row.id));
    const { error: commentsError } = await admin.from('comments').delete().eq('user_id', user.id);
    if (commentsError) throw new Error('account_deletion_comments_cleanup_failed');
    await deleteCommentsForTargets(admin, 'post', postIds);
    await deleteCommentsForTargets(admin, 'reel', reelIds);
    const { error: postsError } = await admin.from('posts').delete().eq('author_id', user.id);
    if (postsError) throw new Error('account_deletion_posts_cleanup_failed');
    const { error: reelsError } = await admin.from('reels').delete().eq('author_id', user.id);
    if (reelsError) throw new Error('account_deletion_reels_cleanup_failed');

    const removedObjects = await deleteOwnedObjects(admin, user.id);
    const { error: deletionError } = await admin.auth.admin.deleteUser(user.id);
    if (deletionError) throw new Error('account_deletion_auth_remove_failed');
    return json({ ok: true, removedObjects, archivedMarketplaceImages: replacements.size, retainedMarketplaceRecords: true });
  } catch (error) {
    console.error('account-deletion failed:', String(error));
    return json({ error: 'تعذر إكمال الحذف بأمان. لم يتم تأكيد حذف الحساب؛ قد يكون حُذف بعض المحتوى الاجتماعي، ويمكنك إعادة المحاولة.' }, 503);
  }
});
