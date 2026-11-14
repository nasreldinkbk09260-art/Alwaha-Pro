import fs from 'node:fs';
import path from 'node:path';
const fail = (message) => { console.error('FAIL:', message); process.exitCode = 1; };
const read = (file) => { const full=path.join(process.cwd(),file); if(!fs.existsSync(full)){fail(`Missing required file: ${file}`);return '';} return fs.readFileSync(full,'utf8'); };
const html=read('index.html'), games=read('games.js'), pkg=JSON.parse(read('package.json')||'{}'), cap=JSON.parse(read('capacitor.config.json')||'{}'), lock=JSON.parse(read('package-lock.json')||'{}'), manifest=JSON.parse(read('manifest.json')||'{}');
const workflow=read('.github/workflows/build-apk-aab-release.yml');
const polish=read('production-polish.js');
const sw=read('sw.js');
const buildWeb=read('scripts/build-web.mjs');
const nativeBack=read('scripts/native-back-handler.mjs');
const marketplaceWriteMigration=read('supabase/migrations/20261113030000_marketplace_chat_notification_column_privileges.sql');
const marketplaceWriteTest=read('supabase/tests/20261113030000_marketplace_chat_notification_column_privileges.sql');
const sqlCi=read('scripts/ci-validate-supabase-sql.sh');
const securityDefinerMigration=read('supabase/migrations/20261113040000_security_definer_api_isolation.sql');
const securityDefinerTest=read('supabase/tests/20261113040000_security_definer_api_isolation.sql');
const securityDefinerAudit=read('scripts/security-definer-audit.mjs');
const triggerDefinerMigration=read('supabase/migrations/20261113050000_trigger_definer_empty_search_path.sql');
const triggerDefinerTest=read('supabase/tests/20261113050000_trigger_definer_empty_search_path.sql');
const localVault=read('alwaha-local-vault.js'), experience=read('alwaha-experience.js'), modalShell=read('alwaha-modal-shell.js'), kidsRoom=read('alwaha-kids-room.js');
if(!localVault.includes("appVersion:'3.0.3'"))fail('Encrypted backup metadata must record the final app version 3.0.3.');
for(const id of ['home-section','market-section','chat-section','reels-section','games-section','profile-section']){if(!html.includes(`id="${id}"`))fail(`Missing main section: ${id}`);if(!html.includes(`showSection('${id}'`))fail(`Missing navigation handler for ${id}`);}
for(const handler of ['previewHomePostImage','publishNewHomePost','editOwnHomePost','deleteOwnHomePost','openHomePostDetails','handleHomePostCardActivation','handleHomePostCardKeydown','startHomePostEdit','saveEditedHomePost','closeHomePostDetails','openCommentsForActiveHomePost','renderReelsFeed','toggleReelFollow','editOwnReel','deleteOwnReel','submitNewProductToMarket','editMyMarketItem','deleteMyMarketItem','openMarketProductDetails','callMarketSeller','startReelRecording','stopReelRecording','publishRecordedReel','toggleFloatingAddMenu','downloadReelMedia','setProductLocationFromDevice','setMarketSearchLocation','markMyProductSold','archiveMyProduct','reactivateMyProduct','promoteMyProduct','reportMarketplaceItem','submitMarketplaceReview','acknowledgeAlwahaPrivacyNotice','showAlwahaPrivacyNotice','showAlwahaPrivacyNoticeIfNeeded','deferAlwahaPrivacyNotice','handleNewUserRegistrationSubmit','executeUserLoginAuth','savePrivacyProfileUpdates','changeAppTheme']){if(!new RegExp(`(?:async\\s+)?function\\s+${handler}\\s*\\(`).test(html))fail(`Missing app handler: ${handler}`);}
if(!html.includes('id="home-post-details-modal"')||!html.includes('id="home-post-edit-text"'))fail('Home post details/edit modal fields missing.');
if(!html.includes('window.__alwahaHomePosts = new Map')||!html.includes('saveEditedHomePost(event)'))fail('Home post open/edit state wiring is incomplete.');
if(/window\.prompt\('عدّل نص المنشور:/.test(html))fail('Legacy empty/unreliable post edit prompt remains.');
if(!html.includes('handleHomePostCardKeydown'))fail('Keyboard activation for post cards missing.');
if(!html.includes('لوحة الإدارة — طلبات التوثيق'))fail('Admin verification dashboard missing.');
if(!html.includes('لا توجد طلبات توثيق معلقة حالياً.'))fail('Admin empty state missing.');
if(!html.includes("if(!profile?.is_admin)return triggerToastNotification('هذا الإجراء متاح للإدارة فقط.','error');"))fail('Admin review authorization guard missing.');
if(html.includes('seller_email'))fail('Frontend must not request or render seller_email.');
if(!html.includes("savedTheme = localStorage.getItem('alwaha_theme') || 'default'"))fail('Saved theme is not restored on startup.');
const themeChoices=[...html.matchAll(/data-theme-choice="([^"]+)"/g)].map(m=>m[1]);
if(themeChoices.length!==3||new Set(themeChoices).size!==3||!['default','oasis','abyss'].every(theme=>themeChoices.includes(theme)))fail('The app must expose exactly the three approved theme choices.');
const themeCss=read('alwaha-theme-system.css');
if(!themeCss.includes('body[data-alwaha-theme="oasis"] #alwaha-theme-backdrop')||!themeCss.includes('body[data-alwaha-theme="abyss"] #alwaha-theme-backdrop'))fail('Premium image-free theme atmospheres are incomplete.');
if(!html.includes('المكالمات عبر البلوتوث لم تُنفذ بعد'))fail('Bluetooth is not labelled honestly.');
if(!html.includes('aria-disabled="true"'))fail('Bluetooth control should not pretend to work.');
if(games.includes('الألعاب الفردية الحالية')||games.includes('data-mp-legacy')||games.includes('LEGACY_TITLES'))fail('Legacy single-player games remain visible or launchable.');
if(/function\s+renderGamesSection\s*\(/.test(html)||/function\s+launchGameEngine\s*\(/.test(html)||html.includes('لعبة الذاكرة التقنية 🧠')||html.includes('تحدي كسر التشفير 🔐'))fail('Obsolete inline game UI must not shadow the dedicated multiplayer games module.');
if(!games.includes('window.renderGamesSection = renderGamesSection')||!games.includes('window.launchGameEngine = function(gameTitle)'))fail('Dedicated multiplayer games module must own the games UI and launcher.');
if(!html.includes('./assets/qr/qrcode-generator.min.js')||!html.includes('./assets/qr/jsQR.min.js')||!sw.includes("'./assets/qr/qrcode-generator.min.js'")||!sw.includes("'./assets/qr/jsQR.min.js'"))fail('Offline QR generator/decoder scripts are not loaded and precached.');
if(!buildWeb.includes("scripts', 'vendor', 'qr'")||!buildWeb.includes('minify: true')||!buildWeb.includes('window.qrcode = qrcode'))fail('Pinned offline QR libraries are not built into minified web assets with a stable encoder global.');
if(!pkg.scripts?.['audit:games']?.includes('scripts/qr-runtime-test.mjs')||!fs.existsSync(path.join(process.cwd(),'scripts/qr-runtime-test.mjs')))fail('QR encoder/decoder runtime smoke test must run inside the game audit.');
if(!games.includes('navigator.mediaDevices.getUserMedia')||!games.includes('window.jsQR(frame.data')||games.includes('window.prompt('))fail('Game QR scanner or in-app room code entry is incomplete.');
if(!workflow.includes('android.permission.CAMERA'))fail('Android camera permission is required for game QR scanning.');
if(pkg.version!=='3.0.3'||lock.version!=='3.0.3'||lock.packages?.['']?.version!=='3.0.3')fail('package and lockfile versions must be 3.0.3.');
if(cap.appId!=='pro.alwaha.app'||cap.webDir!=='dist')fail('Unexpected Capacitor app configuration.');
if(manifest.version!==pkg.version)fail('manifest.json version must match package.json.');
if(!html.includes('Alwaha-Pro 3.0.3'))fail('HTML release version is not 3.0.3.');
if(!html.includes('function previewHomePostImage()')||!html.includes('async function publishNewHomePost()')||!html.includes("uploadFileToStorage(imageFile,'posts',{maxBytes:8*1024*1024})")||!html.includes('window.__alwahaHomePostInFlight=true'))fail('Home post image selection, publishing or duplicate-submit protection is incomplete.');

for(const file of ['icon.png','manifest.json','sw.js','alwaha-call-feedback.js','scripts/build-web.mjs','production-polish.js','alwaha-modal-shell.js','alwaha-runtime-guard.js','scripts/runtime-boot-audit.mjs','scripts/game-actions-audit.mjs','scripts/call-signaling-runtime-test.mjs','supabase/migrations/20261007082734_20261005000000_fix_like_count_security.sql','supabase/migrations/20261011204819_secure_contact_privacy_defaults.sql','supabase/migrations/20261013235236_multiplayer_game_rooms_v283.sql','supabase/migrations/20261014192321_username_follows_call_features_20261014090000.sql','supabase/migrations/20261014193854_legacy_archive_api_access_hardening.sql','supabase/migrations/20261014194007_safe_public_directory_invoker.sql','supabase/migrations/20261014194053_app_settings_api_privacy.sql','supabase/migrations/20261014194820_release_policy_performance_cleanup.sql','supabase/migrations/20261014194848_rls_initplan_optimization.sql','supabase/migrations/20261014195018_game_room_join_game_validation.sql','supabase/migrations/20261014195108_game_room_join_rpc_compatibility.sql','supabase/migrations/20261014195445_friend_request_column_privileges.sql','supabase/migrations/20261014195540_friend_request_policy_consolidation.sql','supabase/migrations/20261014232322_notification_fail_safe.sql','supabase/migrations/20261029035135_marketplace_lifecycle_reviews.sql','supabase/migrations/20261029035139_require_accepted_friendship_for_messages.sql','supabase/migrations/20261101022015_marketplace_conversation_messaging.sql','supabase/migrations/20261101022031_marketplace_conversation_policy_owner_fix.sql','supabase/migrations/20261029121330_add_marketplace_foreign_key_indexes.sql','supabase/migrations/20261101210000_marketplace_transaction_archive_and_call_auth.sql','supabase/migrations/20261102010000_legacy_client_privileges_hardening.sql','supabase/migrations/20261102100000_marketplace_retention_policy_and_cleanup.sql','supabase/migrations/20261102150000_products_seller_email_privacy.sql','supabase/tests/20261102150000_products_seller_email_privacy.sql','supabase/migrations/20261108110000_marketplace_retention_two_party_consent.sql','supabase/tests/20261108110000_marketplace_retention_two_party_consent.sql','supabase/tests/20261102160000_marketplace_snapshot_column_privileges.sql'])if(!fs.existsSync(path.join(process.cwd(),file)))fail(`Missing release file: ${file}`);
if(fs.statSync(path.join(process.cwd(),'icon.png')).size<1000)fail('icon.png unexpectedly small.');
if (html.includes('openAlwahaLocalNetworkPanel') || html.includes('الشبكة الحرة للأصدقاء القريبين') || html.includes('إعدادات الشبكة القريبة')) fail('Local network UI entry points must remain removed as requested.');
if (html.includes('free-mode-toggle-main-btn') || html.includes('toggleFreeMeshShareSystem') || html.includes('id="free-section"')) fail('Unsupported local-network/file-share page must remain removed.');
const declaredFunctions=new Set([...html.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]));
for (const source of [localVault,experience,kidsRoom]) for (const match of source.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|[A-Za-z_$][\w$]*\s*=>)/g)) declaredFunctions.add(match[1]);
if(kidsRoom.includes('window.toggleAlwahaKidsMode=open')) declaredFunctions.add('toggleAlwahaKidsMode');
for (const match of html.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\b/g)) declaredFunctions.add(match[1]);
for(const name of ['setAlwahaRingtoneEnabled','playAlwahaCallRingtone','previewAlwahaCallRingtone','stopAlwahaCallRingtone','setAlwahaRingtoneChoice'])if(new RegExp('window\\.'+name+'\\s*=').test(polish))declaredFunctions.add(name);
for(const match of html.matchAll(/\bon(?:click|change|input|submit|keydown|keyup)\s*=\s*["']\s*(?:return\s+)?([A-Za-z_$][\w$]*)\s*\(/g)){const name=match[1];if(!declaredFunctions.has(name))fail('Inline handler has no declared function: '+name);}
for(const required of ['reg-username','reg-country-code','alwaha-call-ringtone-enabled','openPublicUserProfile','toggleUserFollow','playAlwahaCallRingtone','getAlwahaIceServers'])if(!html.includes(required))fail('Missing release feature: '+required);
if(!html.includes("functions.invoke('username-auth'"))fail('Username Auth invocation missing.');
if(!html.includes("functions.invoke('call-config'"))fail('Call ICE config hook missing.');
if(!fs.existsSync(path.join(process.cwd(),'production-polish.js')))fail('Missing registration/audio polish module.');
if(!fs.existsSync(path.join(process.cwd(),'scripts/vendor-assets.mjs')))fail('Missing local vendor asset builder.');
for(const dependency of ['@fortawesome/fontawesome-free','@fontsource/cairo','@supabase/supabase-js'])if(!pkg.dependencies?.[dependency])fail('Missing pinned local dependency: '+dependency);
for(const asset of ['./assets/vendor/fontawesome/css/all.min.css','./assets/vendor/supabase/supabase.js','./assets/vendor/cairo/300.css','./assets/vendor/cairo/400.css','./assets/vendor/cairo/600.css','./assets/vendor/cairo/700.css','./assets/vendor/cairo/900.css'])if(!html.includes(asset))fail('Critical UI dependency is not served locally: '+asset);
for(const asset of ['assets/sounds/saffron_tide.mp3','assets/sounds/marimba_bloom.mp3','assets/backgrounds/bg-nebula.webp','alwaha-theme-system.css'])if(!fs.existsSync(path.join(process.cwd(),asset)))fail('Missing 3.0.3 media asset: '+asset);
for(const helper of ['setAlwahaLanguage','setAlwahaDataSaver','setAlwahaReducedMotion','setAlwahaRingtoneChoice'])if(!fs.readFileSync(path.join(process.cwd(),'production-polish.js'),'utf8').includes('window.'+helper))fail('Missing settings handler: '+helper);
if(!fs.readFileSync(path.join(process.cwd(),'games.js'),'utf8').includes('p_expected_game_id'))fail('Missing wrong-game room join guard.');
if (!pkg.dependencies?.['@capacitor/app']) fail('Missing Android native back plugin: @capacitor/app.');
if (!pkg.devDependencies?.['esbuild']) fail('Missing web build dependency: esbuild.');
if (!html.includes('./alwaha-native-back-handler.js')) fail('Native back handler script tag missing.');
if (!buildWeb.includes("path.join(root, 'scripts', 'native-back-handler.mjs')") || !buildWeb.includes("outfile: path.join(dist, 'alwaha-native-back-handler.js')") || !buildWeb.includes("if (!fs.existsSync(path.join(dist, 'alwaha-native-back-handler.js')))") ) fail('Native back handler is not integrated into the web build.');
if (!sw.includes("'./alwaha-native-back-handler.js'")) fail('Native back handler is not precached by the service worker.');
if (!sw.includes("'./alwaha-local-vault.js'") || !sw.includes("'./alwaha-experience.js'") || !sw.includes("'./alwaha-modal-shell.js'") || !sw.includes("'./alwaha-kids-room.js'")) fail('3.0.3 local experience modules are not precached.');
if (!sw.includes("'./alwaha-runtime-guard.js'")) fail('Runtime resilience guard is not precached.');
if (!html.includes('src="./alwaha-runtime-guard.js?v=3.0.3-core-20261113-security"') || !sw.includes("'./alwaha-runtime-guard.js?v=3.0.3-core-20261113-security'") || !sw.includes("'./alwaha-runtime-guard.js'")) fail('Runtime resilience guard must use the versioned precached path with offline retry fallback.');
for (const asset of ['games.js','alwaha-experience.js','alwaha-modal-shell.js','alwaha-runtime-guard.js','alwaha-call-feedback.js']) if (!html.includes('src="./'+asset+'?v=3.0.3-core-20261113-security"') || !sw.includes("'./"+asset+"?v=3.0.3-core-20261113-security'") || !sw.includes("'./"+asset+"'")) fail('Offline script URL does not match versioned and fallback service-worker precache entries: '+asset);
if (!experience.includes('syncDock,initialize') || !experience.includes('if(initialized||!document.body)return;')) fail('Experience module initialization must be exported and idempotent.');
if (!fs.readFileSync('alwaha-modal-shell.js','utf8').includes('hasRelevantMutation(records)')) fail('Modal mutation observer is not scoped to relevant dialog mutations.');
const runtimeAuditCommand = pkg.scripts?.['audit:runtime'] || '';
if (!workflow.includes('npm run audit:runtime') || !runtimeAuditCommand.includes('node scripts/runtime-boot-audit.mjs') || !runtimeAuditCommand.includes('node scripts/back-navigation-runtime-test.mjs')) fail('Startup/runtime and back-navigation regression audits are not wired into release CI.');
if (!workflow.includes('npm run audit:release') || pkg.scripts?.['audit:offline-cache'] !== 'node scripts/offline-cache-audit.mjs' || !pkg.scripts?.['audit:release']?.includes('audit:offline-cache')) fail('Offline cache budget/reconnect audit is not wired into the single release gate.');

if (!sw.includes("'./assets/sounds/saffron_tide.mp3'") || !sw.includes("'./assets/sounds/marimba_bloom.mp3'")) fail('Both full local call ringtones must be precached for offline use.');
if (!nativeBack.includes("App.addListener('backButton'")) fail('Native back listener registration missing.');
if (!nativeBack.includes('window.alwahaExitNativeApp = () => App.exitApp()') || !html.includes('window.alwahaExitNativeApp')) fail('Android exit confirmation does not invoke the native exit action.');
for (const permission of ['android.permission.CAMERA','android.permission.RECORD_AUDIO','android.permission.MODIFY_AUDIO_SETTINGS','android.permission.ACCESS_COARSE_LOCATION','android.permission.ACCESS_FINE_LOCATION']) if (!workflow.includes(permission)) fail(`Android feature permission missing from release workflow: ${permission}`);


for (const file of ['supabase/migrations/20261108120000_real_chat_message_replies.sql','supabase/tests/20261108120000_message_reply_scope.sql','supabase/migrations/20261108130000_friend_request_acceptance_notification.sql','supabase/tests/20261108130000_friend_request_acceptance_notification.sql','supabase/tests/chat-replies-ci-bootstrap.sql']) if(!fs.existsSync(path.join(process.cwd(),file))) fail(`Missing real chat reply scope release file: ${file}`);
const friendPolicyMigration=read('supabase/migrations/20261029035139_require_accepted_friendship_for_messages.sql');
if (!friendPolicyMigration.includes('messages_insert_sender_accepted_friends') || !/fr\.status\s*=\s*'accepted'/.test(friendPolicyMigration) || !/\(SELECT auth\.uid\(\)\)\s*=\s*sender_id/.test(friendPolicyMigration)) fail('Message RLS does not require an accepted friendship.');
if (!html.includes("webrtc-call-result") || !html.includes('handleIncomingCallResult') || !html.includes('hasAcceptedAlwahaFriendship(payload.from)')) fail('Incoming/outgoing call friendship gate is incomplete.');
 if (!html.includes("AlwahaCallFeedback?.start('ringback')") || !html.includes('scheduleCallTimeout') || !html.includes("reason:'declined'")) fail('Call progress feedback, no-answer timeout or decline reason is incomplete.');

if (!html.includes("const safePublicTables = new Set(['posts','reels','products','post_like_counts','reel_like_counts'])") || !html.includes("const isPublicCommentThread = tableName === 'comments'") || !html.includes('target_type=eq')) fail('Offline cache must be limited to public feeds and explicit public comment threads.');
if (!html.includes('function sanitizeAlwahaPublicCacheRows') || !html.includes("products: ['id','seller_id','title','price','category','description','image_url','image_urls','created_at','status','location_label','latitude','longitude','promoted_until']")) fail('Public cache must whitelist public product fields and omit seller/buyer-sensitive fields.');
for (const file of ['supabase/migrations/20261101022015_marketplace_conversation_messaging.sql','supabase/migrations/20261101022031_marketplace_conversation_policy_owner_fix.sql']) if (!fs.existsSync(path.join(process.cwd(),file))) fail('Missing isolated marketplace messaging migration: '+file);
const marketChatPolicyFix=read('supabase/migrations/20261101022031_marketplace_conversation_policy_owner_fix.sql');
if (!marketChatPolicyFix.includes('p.seller_id=market_conversations.seller_id')) fail('Marketplace conversation insert policy must bind seller_id to the outer conversation row.');
if (!html.includes('window.__alwahaHomeFeedInFlight') || !html.includes("alwahaUiDeadline(supabaseFetch('posts?select=*&order=created_at.desc&limit=100'), 9500, null)")) fail('Home feed must coalesce duplicate renders and bound the public posts fetch.');
if(!html.includes('window.__alwahaMarketProductSubmitInFlight')||!html.includes('async function submitNewProductToMarketInternal()')||!html.includes('finally{')||!html.includes("button.textContent='جارٍ حفظ الإعلان…'"))fail('Marketplace publish/edit must block duplicate submissions and restore the button after completion.');
if(!html.includes('let marketLifecycleSchemaPromise = null;')||!html.includes('return marketLifecycleSchemaPromise;')||!html.includes('usedLegacyMarketQuery')||!html.includes('marketLifecycleSchemaReady=!usedLegacyMarketQuery;'))fail('Marketplace optional-schema detection must await one shared probe and preserve legacy-schema state.');
if(!html.includes('select=id,seller_id,title,price,category,description,image_url&limit=1')||!html.includes('status:\'active\'}));')||!html.includes('تعذر تحميل إعلاناتك.'))fail('Marketplace edit and seller listing views must fall back safely when optional lifecycle columns are unavailable.');
if(!html.includes('function syncAlwahaModalBodyLock()')||!html.includes('syncAlwahaModalBodyLock();window.AlwahaModalShell?.sync?.();void renderMarketConversationsList();')||!html.includes('syncAlwahaModalBodyLock();window.AlwahaModalShell?.sync?.();'))fail('Closing marketplace full-screen views must restore background interaction without unlocking other open modals.');
if(!html.includes('let marketMessagesRequestId = 0;')||!html.includes('requestId!==marketMessagesRequestId')||!html.includes('conversationId!==String(currentMarketConversationId||\'\')'))fail('Market chat must discard stale message loads when the active conversation changes or closes.');
if(!html.includes('let marketConversationsRenderRequestId = 0;')||!html.includes('requestId!==marketConversationsRenderRequestId')||!html.includes('let marketTransactionsRenderRequestId = 0;')||!html.includes('requestId!==marketTransactionsRenderRequestId'))fail('Market inbox and transaction list must ignore stale concurrent renders.');
if(!html.includes('let directMessagesRequestId = 0;')||!html.includes('peerId!==String(currentChatUserId||\'\')')||!html.includes('let directMessageSendInFlight = false;')||!html.includes('if(directMessageSendInFlight)return;')||!html.includes('let directChatOpenRequestId = 0;'))fail('Direct chat must prevent duplicate sends and stale message/user lookups.');
if(!html.includes('let reelsFeedRequestId = 0;')||!html.includes('requestId!==reelsFeedRequestId')||!html.includes('window.__alwahaReelLikeLocks')||!html.includes('window.__alwahaReelFollowLocks')||!html.includes('تعذر التحقق من الإعجاب؛ لم نرسل طلبًا جديدًا لتجنب التكرار.'))fail('Reels feed and engagement actions must ignore stale loads and prevent duplicate likes/follows.');
if(!html.includes('let reelPublishInFlight = false;')||!html.includes('if(reelPublishInFlight)return false;')||!html.includes('finally { reelPublishInFlight=false; }'))fail('Reel publishing must prevent duplicate concurrent uploads/inserts and always release its lock.');
if(!html.includes('previousMarkup=button?.innerHTML')||!html.includes('button.innerHTML=previousMarkup'))fail('Direct chat send action must restore its original icon/markup after completion.');
if (!html.includes('id="market-conversations-panel"') || !html.includes("modal.id='market-chat-modal'") || !html.includes('async function sendMarketMessage()') || !html.includes('market_messages')) fail('Marketplace chat must use its own inbox, modal, and message table.');
const friendMessageSendStart = html.indexOf('async function sendLiveChatMessageFromUI()');
const friendMessageSendEnd = html.indexOf('async function renderConversationsList()', friendMessageSendStart);
const friendMessageSendBody = friendMessageSendStart >= 0 && friendMessageSendEnd > friendMessageSendStart
  ? html.slice(friendMessageSendStart, friendMessageSendEnd)
  : '';
if (!friendMessageSendBody.includes('hasAcceptedAlwahaFriendship(peerId)') ||
    !friendMessageSendBody.includes('peerId!==String(currentChatUserId||\'\')')) {
  fail('Friend chat must verify an accepted friendship for the active peer before sending.');
}
if (!html.includes('callMarketSeller') || !html.includes('اتصال صوتي بالبائع') || !html.includes('toggleReelFollow')) fail('Marketplace voice-call action missing.');
if (!html.includes('setMarketSearchLocation') || !html.includes('market-radius-select')) fail('Marketplace distance/radius search controls missing.');
if (!html.includes('alwaha_privacy_notice_ack_v2') || !html.includes('showAlwahaPrivacyNoticeIfNeeded();') || !html.includes('function showAlwahaPrivacyNotice()') || !html.includes('function deferAlwahaPrivacyNotice()')) fail('Privacy notice on first launch or its current notice actions are missing.');

if (!html.includes('height: 100dvh;') || !html.includes('body.alwaha-exit-confirm-open') || !html.includes('function showExitConfirmationModal()')) fail('Exit confirmation viewport/safe-area fix missing.');
if (!html.includes('max-height: calc(100dvh - 122px - env(safe-area-inset-bottom))') || !html.includes('class=\"reels-floating-btn')) fail('Reels options menu is not bounded to the viewport or circular actions missing.');
if (!html.includes('preload=\"${index===0?\'metadata\':\'none\'}\"') || !html.includes('alwaha-mobile-performance-final')) fail('Reels network preloading/mobile rendering performance guard missing.');
if (!html.includes('sellerRatingSummary') || !html.includes('marketplace_reviews?seller_id=')) fail('Marketplace seller rating summary missing.');
for (const label of ['إعجاب','تعليق','متابعة','مشاركة','حفظ','خيارات']) if (!html.includes(label)) fail(`Missing reels action label: ${label}`);
if (!html.includes('products?select=id,seller_id,title,price,category,description,image_url,image_urls,created_at,status,location_label,latitude,longitude,promoted_until&order=created_at.desc&limit=120')) fail('Public marketplace query must use an explicit, minimized field list.');

const marketplaceMigration = read('supabase/migrations/20261029035135_marketplace_lifecycle_reviews.sql');
for (const feature of ['marketplace_reviews','marketplace_reports','products_status_created_idx','products_geo_idx','marketplace_reviews_insert_verified_buyer','marketplace_reports_insert_own']) if (!marketplaceMigration.includes(feature)) fail(`Marketplace migration missing: ${feature}`);

const friendPolicyMigrationLatest=read('supabase/migrations/20261029035139_require_accepted_friendship_for_messages.sql');
if (!friendPolicyMigrationLatest.includes('messages_insert_sender_accepted_friends') || !/fr\.status\s*=\s*'accepted'/.test(friendPolicyMigrationLatest) || !/\(SELECT auth\.uid\(\)\)\s*=\s*sender_id/.test(friendPolicyMigrationLatest)) fail('Latest message RLS migration does not require an accepted friendship.');
for (const file of ['supabase/migrations/20261029035135_marketplace_lifecycle_reviews.sql','supabase/migrations/20261029035139_require_accepted_friendship_for_messages.sql','supabase/migrations/20261029035151_realtime_call_channel_authorization.sql','supabase/migrations/20261029035414_marketplace_review_privacy_rpc.sql','supabase/migrations/20261029035811_realtime_call_peer_inbox_select.sql']) if (!fs.existsSync(path.join(process.cwd(),file))) fail(`Missing 3.0.3 privacy/marketplace migration: ${file}`);
if (!html.includes("webrtc-call-result") || !html.includes('handleIncomingCallResult') || !html.includes('hasAcceptedAlwahaFriendship(payload.from)')) fail('Incoming/outgoing call friendship gate is incomplete.');
 if (!html.includes("AlwahaCallFeedback?.start('ringback')") || !html.includes('scheduleCallTimeout') || !html.includes("reason:'declined'")) fail('Call progress feedback, no-answer timeout or decline reason is incomplete.');
if (!html.includes('config:{private:true}') && !html.includes('config: { private: true }')) fail('WebRTC channels must use private Realtime Broadcast.');
if (!html.includes('waitForIceGathering(timeoutMs = 10000)') || !html.includes('this.client.realtime.setAuth(session.access_token)')) fail('Private call channel auth/ICE safeguards are incomplete.');
if (!html.includes("supabaseClient.rpc('can_review_marketplace_product'")) fail('Marketplace buyer eligibility must be checked by the privacy-safe RPC.');


const approvedThemes=[...html.matchAll(/data-theme-choice="([^"]+)"/g)].map(m=>m[1]);
if(approvedThemes.length!==3||new Set(approvedThemes).size!==3||!['default','oasis','abyss'].every(x=>approvedThemes.includes(x)))fail('Exactly the approved default/oasis/abyss themes must be selectable.');
if(!themeCss.includes('--wa-accent')||!themeCss.includes('body[data-alwaha-theme="oasis"] #alwaha-theme-backdrop')||!themeCss.includes('body[data-alwaha-theme="abyss"] #alwaha-theme-backdrop')||!html.includes('alwaha-theme-backdrop'))fail('Integrated premium theme palettes/backdrop are incomplete.');
if(sw.includes('bg-spring.webp')||sw.includes('bg-summer.webp')||sw.includes('bg-autumn.webp')||sw.includes('bg-winter.webp'))fail('Obsolete seasonal wallpaper files remain in the active offline cache list.');
if(!sw.includes("'./alwaha-theme-system.css'")||!sw.includes("'./alwaha-theme-system.css?v=3.0.3-core-20261113-security'")||!sw.includes("'./assets/backgrounds/bg-nebula.webp'"))fail('Theme CSS or default background is missing from offline precache.');

if (!workflow.includes('npm run audit:chat') || pkg.scripts?.['audit:chat'] !== 'node scripts/chat-release-audit.mjs') fail('Chat/feed regression audit is not wired into release CI.');

if(!html.includes('market-call-room-')||!html.includes("mode:market?'market':'online'")||!html.includes('complete_market_sale')) fail('3.0.3 market call and transaction workflow are incomplete.');
if(!html.includes('id="kidsModeBtn"')||!html.includes('وضع الأطفال — قريبًا')||!html.includes('disabled aria-disabled="true"')||!kidsRoom.includes('window.toggleAlwahaKidsMode=open')||!html.includes('alwaha-local-vault.js')||!html.includes('alwaha-experience.js')||!html.includes('alwaha-modal-shell.js')) fail('3.0.3 local experience suite must remain packaged while untested kids controls are visibly deferred.');
if(!fs.existsSync('alwaha-kids-room.js')||!fs.existsSync('alwaha-local-vault.js')||!fs.existsSync('alwaha-experience.js')||!fs.existsSync('alwaha-modal-shell.js')) fail('Missing 3.0.3 local experience modules.');
const legacyPrivilegesMigration=read('supabase/migrations/20261102010000_legacy_client_privileges_hardening.sql');
for(const table of ['public.likes','public.profiles','public.ratings']) if(!legacyPrivilegesMigration.includes(table)) fail(`Legacy privilege hardening missing ${table}.`);
if(!/REVOKE\s+ALL\s+PRIVILEGES\s+ON\s+TABLE[\s\S]*?FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(legacyPrivilegesMigration)) fail('Legacy client table privileges are not fully revoked.');
const retentionMigration=read('supabase/migrations/20261102100000_marketplace_retention_policy_and_cleanup.sql');
const profileSecurityMigration=read('supabase/migrations/20261110001000_profile_account_security_hardening.sql');
const profileSecurityTest=read('supabase/tests/20261110001000_profile_account_security_hardening.sql');
const profileSecurityFixture=read('supabase/tests/profile-security-ci-bootstrap.sql');
const sharedCiBootstrap=read('supabase/tests/ci-bootstrap.sql');
const profileAudit=read('scripts/profile-ui-acceptance.mjs');
const retentionConsentMigration=read('supabase/migrations/20261108110000_marketplace_retention_two_party_consent.sql');
for(const marker of ['purge_expired_marketplace_archives',"interval '30 days'","interval '7 days'",'market_product_sync_conversation_retention_delete','REVOKE ALL ON FUNCTION public.purge_expired_marketplace_archives']) if(!retentionMigration.includes(marker)) fail(`Marketplace retention policy missing: ${marker}`);
if (!retentionMigration.includes("current_user IN ('postgres','service_role')") || !retentionMigration.includes("NEW.status='archived'")) fail('Scheduled warranty expiry must be allowed through the buyer-confirmation guard only for the database role.');
if (!retentionMigration.includes('WITH due AS MATERIALIZED') || !retentionMigration.includes('UPDATE public.market_transactions AS t') || !retentionMigration.includes('UPDATE public.market_conversations AS c')) fail('Retention notice batches must mark only the bounded selected rows.');
if(retentionMigration.includes('cron.schedule')||retentionMigration.includes('DELETE FROM public.market_conversations')||retentionMigration.includes('DELETE FROM public.market_transactions')||!retentionMigration.includes('FROM PUBLIC,anon,authenticated,service_role')) fail('First-stage retention migration must not schedule or execute deletion before two-party consent.');
for(const marker of ['approve_market_archive_deletion',"t.status='disputed'",'delete_approved_by_buyer_at IS NOT NULL','delete_approved_by_seller_at IS NOT NULL',"cron.schedule('alwaha-marketplace-retention-daily'",'CREATE EXTENSION IF NOT EXISTS pg_cron','GRANT EXECUTE ON FUNCTION public.purge_expired_marketplace_archives(integer) TO service_role']) if(!retentionConsentMigration.includes(marker)) fail(`Final two-party retention migration missing: ${marker}`);
if(!retentionConsentMigration.includes('لا يحذف الأرشيف إلا بعد موافقة المشتري والبائع ومرور 7 أيام كاملة بعد هذا الإشعار')) fail('Final retention notice must require both participant approvals and a full grace period.');
if(!workflow.includes('npm run audit:retention-kids-vault') || pkg.scripts?.['audit:retention-kids-vault']!=='node scripts/retention-kids-vault-audit.mjs') fail('Retention/kids/vault regression audit is not wired into release CI.');
if (!workflow.includes('sql-regression:') || !workflow.includes('needs: sql-regression') || !fs.existsSync('scripts/ci-validate-supabase-sql.sh') || !fs.existsSync('supabase/tests/ci-bootstrap.sql') || !fs.existsSync('supabase/tests/20261102100000_marketplace_retention_behavior.sql') || !fs.existsSync('supabase/tests/20261102100000_marketplace_retention_policy_and_cleanup.sql')) fail('Disposable PostgreSQL SQL regression gate is missing or not required before Android build.');
if(!workflow.includes('npm run audit:marketplace-columns') || pkg.scripts?.['audit:marketplace-columns']!=='node scripts/marketplace-column-audit.mjs') fail('Marketplace column permission audit is not wired into release CI.');
if(!workflow.includes('npm run audit:ui') || pkg.scripts?.['audit:ui']!=='node scripts/ui-handler-audit.mjs') fail('Full UI handler audit is not wired into release CI.');
if(!workflow.includes('npm run audit:profile') || pkg.scripts?.['audit:profile']!=='node scripts/profile-ui-acceptance.mjs' || !profileAudit.includes('PROFILE_UI_ACCEPTANCE=')) fail('Profile registration/login acceptance audit is not wired into release CI.');
if(!profileSecurityMigration.includes('DROP POLICY IF EXISTS users_delete_own') || !profileSecurityMigration.includes('REVOKE DELETE ON TABLE public.users') || !profileSecurityMigration.includes('REVOKE UPDATE (hide_email,hide_phone)') || !profileSecurityMigration.includes("status = 'pending'") || !profileSecurityMigration.includes('reviewed_by IS NULL')) fail('Profile account and verification insert hardening migration is incomplete.');
if(!profileSecurityTest.includes('has_table_privilege') || !profileSecurityTest.includes('has_column_privilege') || !sharedCiBootstrap.includes('CREATE TABLE public.users') || !profileSecurityFixture.includes('CREATE TABLE public.verification_requests')) fail('Profile security SQL regression fixture or assertions are missing.');
if(!read('scripts/ci-validate-supabase-sql.sh').includes('20261110001000_profile_account_security_hardening.sql') || !read('scripts/ci-validate-supabase-sql.sh').includes('profile-security-ci-bootstrap.sql')) fail('Profile security migration is not covered by disposable PostgreSQL CI.');
if(!workflow.includes('npm run audit:themes') || pkg.scripts?.['audit:themes']!=='node scripts/theme-runtime-test.mjs') fail('Theme runtime audit is not wired into release CI.');
if(!workflow.includes('npm run audit:field-repair') || pkg.scripts?.['audit:field-repair']!=='node scripts/field-repair-audit.mjs') fail('Field repair regression audit is not wired into release CI.');
if(!fs.existsSync('scripts/adaptive-video-quality-runtime-test.mjs') || !workflow.includes('npm run audit:adaptive-video-quality') || pkg.scripts?.['audit:adaptive-video-quality']!=='node scripts/adaptive-video-quality-runtime-test.mjs') fail('Adaptive video quality feedback regression audit is missing or not wired into release CI.');
if(!workflow.includes('npm audit --audit-level=high')) fail('Dependency vulnerability audit is not wired into release CI.');
if(!fs.existsSync('supabase/tests/20261102010000_legacy_client_privileges_hardening.sql') || !fs.existsSync('supabase/tests/20261102100000_marketplace_retention_policy_and_cleanup.sql')) fail('Supabase regression assertion files are missing.');
if(!fs.existsSync('scripts/marketplace-column-audit.mjs'))fail('scripts/marketplace-column-audit.mjs is missing.');
if(!securityDefinerMigration.includes('CREATE SCHEMA IF NOT EXISTS app_private')||!securityDefinerMigration.includes('SECURITY INVOKER')||!securityDefinerTest.includes('Public SECURITY DEFINER functions remain executable')||!triggerDefinerMigration.includes('ALTER FUNCTION public.handle_auth_user_update() SET search_path TO')||!triggerDefinerTest.includes('Public SECURITY DEFINER functions without empty search_path')||!securityDefinerAudit.includes('SECURITY_DEFINER_AUDIT=PASS')||!sqlCi.includes('20261113040000_security_definer_api_isolation.sql')||!sqlCi.includes('20261113050000_trigger_definer_empty_search_path.sql')||!workflow.includes('test -s scripts/security-definer-audit.mjs')||!workflow.includes('test -s supabase/tests/20261113050000_trigger_definer_empty_search_path.sql')||!pkg.scripts?.['audit:security-definers']||!pkg.scripts?.['audit:release']?.includes('audit:security-definers'))fail('SECURITY DEFINER isolation and empty search_path hardening are not wired into release CI.');
if(!marketplaceWriteMigration.includes('REVOKE INSERT ON TABLE public.market_messages')||!marketplaceWriteMigration.includes('GRANT UPDATE (is_read) ON TABLE public.notifications TO authenticated')||!marketplaceWriteTest.includes('notifications update grants must be limited to is_read')||!sqlCi.includes('20261113030000_marketplace_chat_notification_column_privileges.sql')||!workflow.includes('test -s supabase/tests/20261113030000_marketplace_chat_notification_column_privileges.sql'))fail('Marketplace/chat/notification column privilege hardening is not covered by SQL CI.');
if(!fs.existsSync('scripts/android/AlwahaAudioRoutePlugin.java'))fail('native audio route plugin is missing.');
if(!workflow.includes('alwaha-pro-3.0.3-final-rebuild-20261107'))fail('Android build workflow is not wired to the final rebuild branch.');
if (process.exitCode) throw new Error('Alwaha-Pro 3.0.3 release preflight failed.');
console.log('Alwaha-Pro 3.0.3 release preflight checks passed.');
console.log('Static checks do not replace Supabase integration tests, applying migrations, or two-device call tests.');
