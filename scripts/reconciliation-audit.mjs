import fs from 'node:fs';
import process from 'node:process';
const fail = (m) => { console.error(`FAIL: ${m}`); process.exitCode = 1; };
const pass = (m) => console.log(`PASS: ${m}`);
const read = (p) => { if (!fs.existsSync(p)) { fail(`Missing ${p}`); return ''; } return fs.readFileSync(p, 'utf8'); };
const has = (s, token) => s.includes(token);
const pkg = JSON.parse(read('package.json'));
const cap = JSON.parse(read('capacitor.config.json'));
const manifest = JSON.parse(read('manifest.json'));
const html = read('index.html');
const sw = read('sw.js');
const games = read('games.js');
const kids = read('alwaha-kids-room.js');
const vault = read('alwaha-local-vault.js');
const experience = read('alwaha-experience.js');
const themeCss = read('alwaha-theme-system.css');
const native = read('scripts/android/AlwahaAudioRoutePlugin.java');
const workflow = read('.github/workflows/build-apk-aab-release.yml');
const pages = read('.github/workflows/pages-web-300.yml');
const migrationGuard = read('.github/workflows/supabase-migrations.yml');
const marketSql = read('supabase/migrations/20261101022015_marketplace_conversation_messaging.sql');
const ownerSql = read('supabase/migrations/20261101022031_marketplace_conversation_policy_owner_fix.sql');
const lifecycleSql = read('supabase/migrations/20261101210000_marketplace_transaction_archive_and_call_auth.sql');
const retentionSql = read('supabase/migrations/20261102100000_marketplace_retention_policy_and_cleanup.sql');
const privacySql = read('supabase/migrations/20261102150000_products_seller_email_privacy.sql');
const nonfriendTest = read('supabase/tests/20261102170000_marketplace_nonfriend_conversation.sql');
const sqlRunner = read('scripts/ci-validate-supabase-sql.sh');

function check(label, condition) { condition ? pass(label) : fail(label); }

check('release version 3.0.3 is consistent across package, lockfile, manifest and title',
  pkg.version === '3.0.3' && JSON.parse(read('package-lock.json')).packages?.['']?.version === '3.0.3' && manifest.version === '3.0.3' && /<title>Alwaha-Pro 3\.0\.3<\/title>/.test(html));
check('Capacitor identity is unchanged', cap.appId === 'pro.alwaha.app' && cap.appName === 'Alwaha-Pro' && cap.webDir === 'dist');
check('3.0.3 final cache token agrees across all current audits',
  sw.includes("const CACHE_NAME = 'alwaha-pro-v3.0.3-final-20261111-release-gates'") &&
  read('scripts/performance-audit.mjs').includes('alwaha-pro-v3\\.0\\.3-final-20261111-release-gates') &&
  read('scripts/field-repair-audit.mjs').includes('alwaha-pro-v3.0.3-final-20261111-release-gates') &&
  read('scripts/compatibility-audit.mjs').includes('alwaha-pro-v3.0.3-final-20261111-release-gates'));

// 3.0.1 final post-test repair family: field compatibility, audio routing, call UI and no mesh-share resurrection.
check('3.0.1 field repairs remain: safe multiplayer viewport and notification overlay',
  games.includes('ALWAHA FIELD REPAIR: viewport-safe room dialog') && html.includes('alwaha-notifications-open'));
check('native call speaker routing is bundled and defaults to earpiece',
  has(html,'speakerRouteBtn') && has(html,'setAlwahaCallSpeaker(false,true)') && native.includes('setRoute'));
check('native audio-route and APK FileProvider plugin is retained',
  native.includes('FileProvider.getUriForFile') && native.includes('setRoute'));
check('local network/mesh share remains intentionally absent',
  !/toggleFreeMeshShareSystem|free-mode-toggle-main-btn|local-share-file-btn|radar-live-results|free-section/.test(html+games));
check('Bluetooth is honestly disabled, not represented as an implemented call path',
  html.includes('المكالمات عبر البلوتوث لم تُنفذ بعد') && /aria-disabled=["']true["']/.test(html));

// 3.0.1 R2 post-branch repairs: notifications, non-friend market messaging, feed coalescing and archive.
check('home feed has a single-flight guard and bounded secondary requests',
  html.includes('__alwahaHomeFeedInFlight') && html.includes('alwahaUiDeadline') && html.includes('2200'));
check('notification center leaves unread items; a single card is marked read individually',
  html.includes('markSingleNotificationRead') && html.includes('data-notification-id') &&
  !html.includes('markNotificationsReadSilently(notificationRows.filter(x => !x.is_read).map(x => x.id))'));
check('friend request accept/reject path removes one row without waiting on full-list rerender',
  html.includes('data-friend-request-id') && html.includes('refreshAlwahaNotificationBadge') && html.includes('loadAllRegisteredUsersList'));
check('market messages use independent market tables and do not reuse friend-chat sender state',
  html.includes('market-conversations-panel') && html.includes('market-chat-modal') &&
  html.includes('async function sendMarketMessage') && html.includes('market_messages?select=id,conversation_id') &&
  html.includes('market_conversations?product_id=eq.') && marketSql.includes('market_messages_insert_participant'));
check('market insert policy validates buyer and active seller-owned listing, without friend-request dependency',
  marketSql.includes('market_conversations_insert_buyer_active_listing') &&
  marketSql.includes('buyer_id=(SELECT auth.uid())') && marketSql.includes('p.status=\'active\'') &&
  !/friend_requests/.test(marketSql+ownerSql));
check('market call signaling is scoped to the conversation participants',
  lifecycleSql.includes('market-call-room-') && lifecycleSql.includes('market-call-inbox-') &&
  html.includes('market-call-room-') && html.includes('market-call-inbox-'));
check('seller delete action is archive PATCH, not REST DELETE',
  /async function deleteMyMarketItem\(prodId\)[\s\S]{0,1200}method:'PATCH'[\s\S]{0,500}status:'archived'/.test(html) &&
  !/async function deleteMyMarketItem\(prodId\)[\s\S]{0,800}method:'DELETE'/.test(html));
check('listing snapshots, sale RPC, warranty and retention rules are present',
  lifecycleSql.includes('capture_market_conversation_snapshot') && lifecycleSql.includes('complete_market_sale') &&
  lifecycleSql.includes('guarantee_expires_at') && retentionSql.includes('retention_until'));
check('product hard-delete privilege is removed by migration, not by UI convention alone',
  lifecycleSql.includes('REVOKE DELETE ON TABLE public.products FROM PUBLIC, anon, authenticated') && lifecycleSql.includes('DROP POLICY IF EXISTS products_delete_own'));
check('seller_email privacy migration clears values and denies client SELECT',
  privacySql.includes('seller_email') && privacySql.includes('REVOKE SELECT') && privacySql.includes('SECURITY INVOKER'));
check('CI contains a no-friendship marketplace conversation/message regression',
  nonfriendTest.includes('no public.friend_requests table') && nonfriendTest.includes('MARKETPLACE_NONFRIEND_CONVERSATION=PASS') &&
  sqlRunner.includes('20261102170000_marketplace_nonfriend_conversation.sql'));
check('market_messages.sender_id foreign-key advisor finding has a migration index and SQL assertion',
  lifecycleSql.includes('market_messages_sender_id_idx') &&
  nonfriendTest.includes('Missing index for market_messages.sender_id foreign key'));

// Kids mode: real source and call-audio track path are checked separately from device QA.
check('kids mode is explicitly deferred in the app until real-device acceptance',
  kids.includes('وضع الأطفال متاح أثناء مكالمة فيديو متصلة فقط') && html.includes('id="kidsModeBtn"') &&
  html.includes('وضع الأطفال — قريبًا') && html.includes('disabled aria-disabled="true"') &&
  !html.includes('onclick="toggleAlwahaKidsMode()"'));
check('kids room includes local scene, both video streams, camera filters, toys, balloon, key and door lock',
  kids.includes('kids-video-port') && kids.includes('kids-local-port') && kids.includes('const filters=') &&
  kids.includes('data-toy') && kids.includes('kids-balloon') && kids.includes('kids-key') && kids.includes('kids-lock') && kids.includes('kids-door'));
check('kids room uses parent override, focus handling and reduced-motion preference',
  kids.includes('kids-parent-exit') && kids.includes('previousFocus') && kids.includes('prefers-reduced-motion'));
check('glass effect is explicitly a safe cartoon simulation, not real physics',
  kids.includes('شظايا كرتونية فقط') && kids.includes('kids-shard'));
check('kids effect sounds have a distinct WebRTC audio track and bridge to remote peer',
  html.includes('createMediaStreamDestination') && html.includes('effectsTrack') &&
  html.includes('window.alwahaPlayCallEffect') && kids.includes('window.alwahaPlayCallEffect'));

// Local backup, seasons and movable nav.
check('encrypted local backup supports export/import and excludes passwords/session/service keys',
  vault.includes('PBKDF2') && vault.includes('AES-GCM') && vault.includes('async function exportBackup') &&
  vault.includes('async function importBackup') && vault.includes('لا يتضمن كلمات المرور أو رموز الجلسة أو مفاتيح الخدمة'));
check('three approved themes include the default plus two full-app image-free premium atmospheres',
  ['default','oasis','abyss'].every(x=>experience.includes(`id:'${x}'`)) &&
  [...html.matchAll(/data-theme-choice="([^"]+)"/g)].length===3 &&
  themeCss.includes('body[data-alwaha-theme="oasis"] #alwaha-theme-backdrop') &&
  themeCss.includes('body[data-alwaha-theme="abyss"] #alwaha-theme-backdrop') &&
  !themeCss.includes('bg-aurora.webp') && !themeCss.includes('bg-underwater.webp') &&
  html.includes('alwaha:themechange'));
check('theme/nav motion respects reduced-motion and data-saver while UI sound remains independently configurable',
  experience.includes('function motionAllowed()') &&
  experience.includes("safeGet('alwaha_data_saver')!=='true'") &&
  experience.includes("safeGet('alwaha_reduced_motion')!=='true'") &&
  experience.includes("matchMedia('(prefers-reduced-motion: reduce)').matches") &&
  experience.includes('body.alwaha-reduced-motion .bottom-nav-bar') &&
  experience.includes('body.alwaha-data-saver .bottom-nav-bar') &&
  experience.includes('function comic(el){if(!motionAllowed())return;') &&
  experience.includes('function setSoundEnabled') && experience.includes('bindGlobalFeedbackSound'));
check('nav drag has a lightweight comic follower with falling/recovered hat or shoe and distinct grab/drop sounds',
  experience.includes('alwaha-comic-walker') && experience.includes('walker-follow') &&
  experience.includes('walker-gear') && experience.includes('alwahaGearDrop') &&
  experience.includes('sound(560)') && experience.includes('sound(760)') &&
  experience.includes("nav.classList.add('alwaha-nav-free-position','alwaha-nav-group-dragging')"));
check('persisted nav position/order/hidden/stack controls exist', experience.includes('POSITION_KEY') &&
  experience.includes('ORDER_KEY') && experience.includes('HIDDEN_KEY') && experience.includes('alwaha-nav-stack'));

// No accidental deployment on push from a test/release branch.
check('APK/AAB build workflow is wired to 3.0.3 final rebuild branch', workflow.includes('alwaha-pro-3.0.3-final-rebuild-20261107'));
check('web build workflow is manual build-only and has no deployment job',
  /^on:\s*\n\s*workflow_dispatch:/m.test(pages) && !/^\s*push:/m.test(pages) &&
  !/uses:\s*actions\/deploy-pages|deploy-pages|pages-build-deployment/i.test(pages));
check('Supabase migration workflow remains manual and non-deploying',
  /^on:\s*\n\s*workflow_dispatch:/m.test(migrationGuard) && migrationGuard.includes('will not run supabase db push'));
check('missing historical production migrations remain an explicit deployment blocker',
  migrationGuard.includes('20261011184718_alwaha_profile_privacy_clean_start.sql') &&
  migrationGuard.includes('20261011184813_verification_request_profile_requirements.sql'));

if (process.exitCode) process.exit(1);
console.log('CROSS_RELEASE_RECONCILIATION_AUDIT=PASS');
console.log('NOTE: Static source/CI fixture audit only; real Supabase deployment and two-device Android testing are still separate release gates.');
