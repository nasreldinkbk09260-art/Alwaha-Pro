import fs from 'node:fs';
import process from 'node:process';
const read=p=>fs.readFileSync(p,'utf8');
const html=read('index.html'),sw=read('sw.js'),vault=read('alwaha-local-vault.js'),polish=read('production-polish.js'),build=read('scripts/build-web.mjs');
const pkg=JSON.parse(read('package.json')),workflow=read('.github/workflows/build-apk-aab-release.yml');
const cacheStart=sw.indexOf("const CACHE_NAME = '");
const cache=cacheStart>=0?sw.slice(cacheStart+"const CACHE_NAME = '".length).split("'")[0]:'';
const registrationStart=html.indexOf("navigator.serviceWorker.register('./sw.js?v=");
const serviceWorkerVersion=registrationStart>=0?html.slice(registrationStart+"navigator.serviceWorker.register('./sw.js?v=".length).split("'")[0]:'';
const version=serviceWorkerVersion;
const hasVersionedAsset=(asset)=>{
  const marker='src="./'+asset+'?v=';
  const pos=html.indexOf(marker);
  if(pos<0)return false;
  const assetVersion=html.slice(pos+marker.length).split('"')[0];
  return !!assetVersion&&sw.includes("'./"+asset+"?v="+assetVersion+"'")&&sw.includes("'./"+asset+"'");
};
const assets=html.split('<script').slice(1).map(chunk=>{
  const tag=chunk.slice(0,chunk.indexOf('>')),marker='src="./',pos=tag.indexOf(marker);
  if(pos<0)return null;
  const url=tag.slice(pos+marker.length).split('"')[0],query=url.indexOf('?v=');
  if(query<0||!url.slice(0,query).endsWith('.js'))return null;
  const asset=url.slice(0,query);
  return asset.startsWith('assets/')?null:asset;
}).filter(Boolean);
let failed=0;
const check=(label,ok)=>{if(ok)console.log('PASS:',label);else{console.error('FAIL:',label);failed++;}};
check('public feed cache is a dedicated IndexedDB database',html.includes("ALWAHA_PUBLIC_CACHE_DB = 'alwaha-public-feed-cache-v1'")&&html.includes('indexedDB.open(ALWAHA_PUBLIC_CACHE_DB,1)'));
check('public feed cache is bounded by entry bytes, total bytes, and entry count',html.includes('ALWAHA_PUBLIC_CACHE_MAX_ENTRY_BYTES = 2 * 1024 * 1024')&&html.includes('ALWAHA_PUBLIC_CACHE_MAX_TOTAL_BYTES = 12 * 1024 * 1024')&&html.includes('ALWAHA_PUBLIC_CACHE_MAX_ENTRIES = 80'));
check('oversized public records are skipped and old entries are evicted',html.includes('if(bytes>ALWAHA_PUBLIC_CACHE_MAX_ENTRY_BYTES)return false')&&html.includes('totalBytes+rowBytes>ALWAHA_PUBLIC_CACHE_MAX_TOTAL_BYTES')&&html.includes('store.delete(row.key)'));
check('only explicitly public tables are persisted; private message/notification tables are excluded',html.includes("new Set(['posts','reels','products','post_like_counts','reel_like_counts'])")&&html.includes('isPublicCommentThread')&&!html.includes("new Set(['posts','reels','products','messages','market_messages','notifications'])"));
check('public product cache field allowlist excludes email and phone',/products:\s*\[[^\]]*'seller_id'[^\]]*'promoted_until'\]/.test(html)&&!(/products:\s*\[[^\]]*seller_email|products:\s*\[[^\]]*phone/.test(html)));
check('reconnect forces a background refresh for both memory and persisted snapshots',html.includes('shouldRefreshAlwahaPublicCacheAfterReconnect(cacheKey)')&&html.includes('memory.expiresAt<=now || reconnectRefresh))queueAlwahaPublicRefresh')&&html.includes('ALWAHA_PUBLIC_CACHE_MEMORY_TTL || reconnectRefresh))queueAlwahaPublicRefresh'));
check('reconnect keeps cached public rows visible while refresh runs',html.includes('window.__alwahaOnlineRefreshPulse=Date.now()||1')&&html.includes('__alwahaPublicRefreshStarted?.clear?.()'));
check('Service Worker excludes Auth, REST, Storage and Functions endpoints',sw.includes('url.pathname')&&sw.includes('rest\\/v1')&&sw.includes('functions\\/v1')&&sw.includes("request.headers.has('Authorization')"));
check('public image cache is bounded to 2 MiB per image and 40 images',sw.includes('size<=2*1024*1024')&&sw.includes('media.length-40'));
const themeMarker='href="./alwaha-theme-system.css?v=',themePosition=html.indexOf(themeMarker);
const themeHref=themePosition>=0?html.slice(themePosition+themeMarker.length).split('"')[0]:'';
check('all first-party modules use versioned URLs and have offline fallback entries',assets.length>0&&assets.every(asset=>hasVersionedAsset(asset)&&build.includes(asset))&&!!themeHref&&sw.includes("'./alwaha-theme-system.css?v="+themeHref+"'")&&sw.includes("'./alwaha-theme-system.css'"));
check('Service Worker precache bypasses stale HTTP cache responses',sw.includes("cache.addAll(PRECACHE_ASSETS.map(asset => new Request(new URL(asset, self.registration.scope), { cache: 'reload' })))"));
const profileEditorRevision=(polish.match(/alwaha-profile-editor\.js\?v=([^'"]+)/)||[])[1]||'';
check('dynamic profile editor module is loaded locally, included in the web build and precached with versioned/fallback URLs',polish.includes('alwaha-profile-editor.js')&&build.includes('alwaha-profile-editor.js')&&!!profileEditorRevision&&sw.includes("'./alwaha-profile-editor.js'")&&sw.includes("'./alwaha-profile-editor.js?v="+profileEditorRevision+"'"));
check('Service Worker has a fresh namespace and cache-bypassing versioned registration',sw.includes("const CACHE_NAME = '"+cache+"'")&&html.includes("navigator.serviceWorker.register('./sw.js?v="+serviceWorkerVersion+"', { scope: './', updateViaCache: 'none' });"));
check('encrypted backup vault remains separate from public display cache',vault.includes("DB_NAME='alwaha-pro-local-vault-v1'")&&vault.includes('AES-GCM')&&!vault.includes('ALWAHA_PUBLIC_CACHE_DB'));
check('private direct chat and peer identity labels are encrypted in the separate local vault',vault.includes('async function saveDirectChatCache')&&vault.includes('async function getAllDirectChatCaches')&&vault.includes('async function savePeerProfileCache')&&vault.includes('async function getPeerProfileCache')&&vault.includes("putEncryptedCache('cache:peer-profile:'"));
check('direct inbox renders prior local caches when offline or when the online request fails',html.includes('async function renderCachedDirectConversationList')&&html.includes('if(!navigator.onLine||window.AlwahaLocalMesh?.isEnabled())')&&html.includes('if(!Array.isArray(rows))'));
check('home comment aggregate cache stores only post identifiers and totals',html.includes("post_comment_counts: ['post_id','comments_count']")&&html.includes("tableName === 'post_comment_counts'")&&html.includes("query.includes('select=post_id,comments_count')"));

check('private account views are encrypted, bounded and use an explicit account-scoped cache contract',
  vault.includes('async function saveAccountViewCache')&&vault.includes('async function getAccountViewCache')&&
  vault.includes('ACCOUNT_VIEW_CACHE_NAMES')&&vault.includes("putEncryptedCache('cache:view:'")&&vault.includes('size>2*1024*1024'));
check('previous authenticated sessions remain available locally after transient network failures',
  html.includes('supabaseClient.auth.getSession()')&&html.includes('async function getCurrentAuthUser()')&&
  html.includes('Offline session lookup failed'));
check('notifications and pending friend requests render from encrypted account snapshots offline',
  html.includes("getAccountViewCache?.(me.id,'notifications')")&&html.includes("getAccountViewCache?.(me.id,'friend-requests')")&&
  html.includes("getAccountViewCache?.(me.id,'friend-requester-directory')")&&html.includes('const offlineView=!navigator.onLine'));
check('offline notification reads are local-only, queued, and synchronized after reconnection',
  html.includes("saveAccountViewCache?.(me.id,'pending-notification-reads'")&&
  html.includes('async function syncPendingNotificationReads(userId)')&&
  html.includes('await syncPendingNotificationReads(me.id)')&&html.includes("saveAccountViewCache?.(uid,'pending-notification-reads',[])"));
check('friend directory and relationship state are available as encrypted read-only offline snapshots',
  html.includes("getAccountViewCache?.(me.id,'friend-relations')")&&html.includes("saveAccountViewCache?.(me.id,'friend-relations',requests)")&&
  html.includes('إجراءات الصداقة تحتاج اتصالاً للمزامنة'));
check('market transaction and delivery snapshots remain encrypted and read-only while offline',
  html.includes("getAccountViewCache?.(me.id,'market-transactions')")&&html.includes("saveAccountViewCache?.(me.id,'market-transactions',rows)")&&
  html.includes('سجل معاملات مشفّر للقراءة فقط دون اتصال')&&html.includes('!offlineView&&!buyer&&deliveryNext'));
check('the own-profile encrypted cache retains private fields without storing credentials or service keys',
  vault.includes('birthdate:profile.birthdate')&&vault.includes('phone:profile.phone')&&vault.includes('is_admin:profile.is_admin===true')&&
  !/saveProfileCache[\\s\\S]{0,600}(?:password|access_token|refresh_token|service_role)/.test(vault));



check('R7.5.1 runtime observer loop protections remain present',read('alwaha-modal-shell.js').includes('hasRelevantMutation(records)')&&read('alwaha-modal-shell.js').includes('scheduleSync()')&&read('alwaha-modal-shell.js').includes('nodeContainsLayer')&&read('alwaha-experience.js').includes('if(handle.textContent!==handleLabel)handle.textContent=handleLabel'));
check('offline cache audit is part of npm release and Android CI',pkg.scripts?.['audit:offline-cache']==='node scripts/offline-cache-audit.mjs'&&pkg.scripts?.['audit:release']?.includes('audit:offline-cache')&&workflow.includes('npm run audit:release'));
if(failed){console.error('OFFLINE_CACHE_AUDIT=FAIL ('+failed+')');process.exit(1);}
console.log('OFFLINE_CACHE_AUDIT=PASS');