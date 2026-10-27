import fs from 'node:fs';
import path from 'node:path';

let failed = 0;
const pass = (label) => console.log(`PASS: ${label}`);
const fail = (label) => { console.error(`FAIL: ${label}`); failed++; };
const read = (name) => {
  const full = path.join(process.cwd(), name);
  if (!fs.existsSync(full)) { fail(`missing ${name}`); return ''; }
  return fs.readFileSync(full, 'utf8');
};
const html = read('index.html');
const sw = read('sw.js');
const migration = read('supabase/migrations/20261027170000_require_accepted_friendship_for_messages.sql');
const notes = read('REPAIR_NOTES_AR.md');

if (html.includes('alwaha-public-feed-cache-v1') && html.includes('indexedDB.open(ALWAHA_PUBLIC_CACHE_DB,1)') && html.includes('queueAlwahaPublicRefresh')) pass('public feeds have IndexedDB persistence and stale-while-revalidate');
else fail('offline-first public feed cache is incomplete');
if (html.includes('function sanitizeAlwahaPublicCacheRows') && html.includes('ALWAHA_PUBLIC_CACHE_FIELDS') && !html.includes("products: ['id','seller_id','seller_email'")) pass('persistent cache is allowlisted by public table fields');
else fail('public cache sanitizer/field allowlist missing');
if (html.includes("webrtc-call-result") && html.includes('handleIncomingCallResult') && html.includes('hasAcceptedAlwahaFriendship(payload.from)') && html.includes('hasAcceptedAlwahaFriendship(peerId)')) pass('incoming and outgoing calls require accepted friendship');
else fail('call friendship gate is incomplete');
if (html.includes('respondFriendRequest') && html.includes("status:'accepted'") && html.includes('طلبات صداقة بانتظار ردك')) pass('incoming friend requests are surfaced with response UI');
else if (html.includes('respondFriendRequest') && html.includes('طلبات صداقة بانتظار ردك')) pass('incoming friend request response UI is present');
else fail('friend request response UI missing');
if (migration.includes('messages_insert_sender_accepted_friends') && migration.includes("fr.status = 'accepted'") && migration.includes('DROP POLICY IF EXISTS messages_insert_sender ON public.messages')) pass('SQL migration enforces accepted friendship for message inserts');
else fail('accepted-friend message RLS migration incomplete');
if (sw.includes('alwaha-pro-v3.0.1-offline-first-20261027') && sw.includes('/storage/v1/object/public/') &&  /image\\\//.test(sw) && /rest\\\/v1/.test(sw)) pass('service worker caches static shell and public image media, not REST API');
else fail('service-worker cache namespace/safety guards incomplete');
if (html.includes('alwaha-burgundy-velvet-background') && html.includes('alwaha-safe-modal-layout')) pass('burgundy velvet background and viewport-safe modal styling are present');
else fail('requested background/modal styles missing');
if (html.includes("profile?.is_admin") && html.includes("if(!profile?.is_admin)return triggerToastNotification('هذا الإجراء متاح للإدارة فقط.'")) pass('embedded admin review UI has role guard');
else fail('embedded admin role guard missing');
if (!fs.existsSync('admin-app')) console.log('INFO: standalone admin-app directory is absent from this supplied source bundle; only embedded admin UI could be audited.');
if (notes.includes('لم يتم التحقق') || notes.includes('لم تُختبر') || notes.includes('لم تتوفر')) pass('repair notes record non-verified items');
else console.log('WARN: ensure repair notes distinguish static checks from real-device/production tests.');

// Check for duplicate DOM IDs.
const staticMarkup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
const ids = [];
for (const match of staticMarkup.matchAll(/<[^>]+\bid=["']([^"']+)["'][^>]*>/g)) ids.push(match[1]);
const counts = new Map();
for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
const duplicates = [...counts].filter(([, count]) => count > 1).map(([id]) => id);
if (!duplicates.length) pass(`no duplicate static IDs (${ids.length} IDs checked)`);
else fail(`duplicate static IDs: ${duplicates.join(', ')}`);

if (failed) { console.error(`FIELD_REPAIR_AUDIT=FAIL (${failed})`); process.exit(1); }
console.log('FIELD_REPAIR_AUDIT=PASS');
console.log('NOTE: this is a static source audit, not a live Supabase/Android/device test.');
