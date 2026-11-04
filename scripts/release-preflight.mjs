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
const localVault=read('alwaha-local-vault.js'), experience=read('alwaha-experience.js'), modalShell=read('alwaha-modal-shell.js'), kidsRoom=read('alwaha-kids-room.js');
for(const id of ['home-section','market-section','chat-section','reels-section','games-section','profile-section']){if(!html.includes(`id="${id}"`))fail(`Missing main section: ${id}`);if(!html.includes(`showSection('${id}'`))fail(`Missing navigation handler for ${id}`);}
for(const handler of ['publishNewHomePost','editOwnHomePost','deleteOwnHomePost','openHomePostDetails','handleHomePostCardActivation','handleHomePostCardKeydown','startHomePostEdit','saveEditedHomePost','closeHomePostDetails','openCommentsForActiveHomePost','renderReelsFeed','toggleReelFollow','editOwnReel','deleteOwnReel','submitNewProductToMarket','editMyMarketItem','deleteMyMarketItem','openMarketProductDetails','callMarketSeller','startReelRecording','stopReelRecording','publishRecordedReel','toggleFloatingAddMenu','downloadReelMedia','setProductLocationFromDevice','setMarketSearchLocation','markMyProductSold','archiveMyProduct','reactivateMyProduct','promoteMyProduct','reportMarketplaceItem','submitMarketplaceReview','acknowledgeAlwahaPrivacyNotice','showAlwahaPrivacyPolicy','handleNewUserRegistrationSubmit','executeUserLoginAuth','savePrivacyProfileUpdates','changeAppTheme']){if(!new RegExp(`(?:async\\s+)?function\\s+${handler}\\s*\\(`).test(html))fail(`Missing app handler: ${handler}`);}
if(!html.includes('id="home-post-details-modal"')||!html.includes('id="home-post-edit-text"'))fail('Home post details/edit modal fields missing.');
if(!html.includes('window.__alwahaHomePosts = new Map')||!html.includes('saveEditedHomePost(event)'))fail('Home post open/edit state wiring is incomplete.');
if(/window\.prompt\('عدّل نص المنشور:/.test(html))fail('Legacy empty/unreliable post edit prompt remains.');
if(!html.includes('handleHomePostCardKeydown'))fail('Keyboard activation for post cards missing.');
if(!html.includes('لوحة الإدارة — طلبات التوثيق'))fail('Admin verification dashboard missing.');
if(!html.includes('لا توجد طلبات توثيق معلقة حالياً.'))fail('Admin empty state missing.');
if(!html.includes("if(!profile?.is_admin)return triggerToastNotification('هذا الإجراء متاح للإدارة فقط.','error');"))fail('Admin review authorization guard missing.');
if(html.includes('seller_email'))fail('Frontend must not request or render seller_email.');
if(!html.includes("savedTheme = localStorage.getItem('alwaha_theme') || 'default'"))fail('Saved theme is not restored on startup.');
for(const theme of ['default','spring','summer','autumn','winter'])if(!html.includes(`changeAppTheme('${theme}')`) && !experience.includes(`id:'${theme}'`))fail(`Missing theme selection: ${theme}`);
if(!html.includes('المكالمات عبر البلوتوث لم تُنفذ بعد'))fail('Bluetooth is not labelled honestly.');
if(!html.includes('aria-disabled="true"'))fail('Bluetooth control should not pretend to work.');
if(games.includes('الألعاب الفردية الحالية')||games.includes('data-mp-legacy')||games.includes('LEGACY_TITLES'))fail('Legacy single-player games remain visible or launchable.');
if(pkg.version!=='3.0.2'||lock.version!=='3.0.2'||lock.packages?.['']?.version!=='3.0.2')fail('package and lockfile versions must be 3.0.2.');
if(cap.appId!=='pro.alwaha.app'||cap.webDir!=='dist')fail('Unexpected Capacitor app configuration.');
if(manifest.version!==pkg.version)fail('manifest.json version must match package.json.');
if(!html.includes('Alwaha-Pro 3.0.2'))fail('HTML release version is not 3.0.2.');
for(const file of ['icon.png','manifest.json','sw.js','scripts/build-web.mjs','production-polish.js','alwaha-modal-shell.js','supabase/migrations/20261007082734_20261005000000_fix_like_count_security.sql','supabase/migrations/20261011204819_secure_contact_privacy_defaults.sql','supabase/migrations/20261013235236_multiplayer_game_rooms_v283.sql','supabase/migrations/20261014192321_username_follows_call_features_20261014090000.sql','supabase/migrations/20261014193854_legacy_archive_api_access_hardening.sql','supabase/migrations/20261014194007_safe_public_directory_invoker.sql','supabase/migrations/20261014194053_app_settings_api_privacy.sql','supabase/migrations/20261014194820_release_policy_performance_cleanup.sql','supabase/migrations/20261014194848_rls_initplan_optimization.sql','supabase/migrations/20261014195018_game_room_join_game_validation.sql','supabase/migrations/20261014195108_game_room_join_rpc_compatibility.sql','supabase/migrations/20261014195445_friend_request_column_privileges.sql','supabase/migrations/20261014195540_friend_request_policy_consolidation.sql','supabase/migrations/20261014232322_notification_fail_safe.sql','supabase/migrations/20261029035135_marketplace_lifecycle_reviews.sql','supabase/migrations/20261029035139_require_accepted_friendship_for_messages.sql','supabase/migrations/20261101022015_marketplace_conversation_messaging.sql','supabase/migrations/20261101022031_marketplace_conversation_policy_owner_fix.sql','supabase/migrations/20261029121330_add_marketplace_foreign_key_indexes.sql','supabase/migrations/20261101210000_marketplace_transaction_archive_and_call_auth.sql','supabase/migrations/20261102010000_legacy_client_privileges_hardening.sql','supabase/migrations/20261102100000_marketplace_retention_policy_and_cleanup.sql','supabase/migrations/20261102150000_products_seller_email_privacy.sql','supabase/tests/20261102150000_products_seller_email_privacy.sql','supabase/tests/20261102160000_marketplace_snapshot_column_privileges.sql'])if(!fs.existsSync(path.join(process.cwd(),file)))fail(`Missing release file: ${file}`);
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
for(const asset of ['assets/sounds/saffron_tide.mp3','assets/sounds/marimba_bloom.mp3','assets/backgrounds/bg-nebula.webp','assets/backgrounds/bg-spring.webp','assets/backgrounds/bg-summer.webp','assets/backgrounds/bg-autumn.webp','assets/backgrounds/bg-winter.webp','alwaha-theme-system.css'])if(!fs.existsSync(path.join(process.cwd(),asset)))fail('Missing 3.0.2 media asset: '+asset);
for(const helper of ['setAlwahaLanguage','setAlwahaDataSaver','setAlwahaReducedMotion','setAlwahaRingtoneChoice'])if(!fs.readFileSync(path.join(process.cwd(),'production-polish.js'),'utf8').includes('window.'+helper))fail('Missing settings handler: '+helper);
if(!fs.readFileSync(path.join(process.cwd(),'games.js'),'utf8').includes('p_expected_game_id'))fail('Missing wrong-game room join guard.');
if (!pkg.dependencies?.['@capacitor/app']) fail('Missing Android native back plugin: @capacitor/app.');
if (!pkg.devDependencies?.['esbuild']) fail('Missing web build dependency: esbuild.');
if (!html.includes('./alwaha-native-back-handler.js')) fail('Native back handler script tag missing.');
if (!buildWeb.includes("path.join(root, 'scripts', 'native-back-handler.mjs')") || !buildWeb.includes("outfile: path.join(dist, 'alwaha-native-back-handler.js')") || !buildWeb.includes("if (!fs.existsSync(path.join(dist, 'alwaha-native-back-handler.js')))") ) fail('Native back handler is not integrated into the web build.');
if (!sw.includes("'./alwaha-native-back-handler.js'")) fail('Native back handler is not precached by the service worker.');
if (!sw.includes("'./alwaha-local-vault.js'") || !sw.includes("'./alwaha-experience.js'") || !sw.includes("'./alwaha-modal-shell.js'") || !sw.includes("'./alwaha-kids-room.js'")) fail('3.0.2 local experience modules are not precached.');
if (!nativeBack.includes("App.addListener('backButton'")) fail('Native back listener registration missing.');
if (!nativeBack.includes('window.alwahaExitNativeApp = () => App.exitApp()') || !html.includes('window.alwahaExitNativeApp')) fail('Android exit confirmation does not invoke the native exit action.');
for (const permission of ['android.permission.CAMERA','android.permission.RECORD_AUDIO','android.permission.MODIFY_AUDIO_SETTINGS','android.permission.ACCESS_COARSE_LOCATION','android.permission.ACCESS_FINE_LOCATION']) if (!workflow.includes(permission)) fail(`Android feature permission missing from release workflow: ${permission}`);


const friendPolicyMigration=read('supabase/migrations/20261029035139_require_accepted_friendship_for_messages.sql');
if (!friendPolicyMigration.includes('messages_insert_sender_accepted_friends') || !/fr\.status\s*=\s*'accepted'/.test(friendPolicyMigration) || !/\(SELECT auth\.uid\(\)\)\s*=\s*sender_id/.test(friendPolicyMigration)) fail('Message RLS does not require an accepted friendship.');
if (!html.includes("webrtc-call-result") || !html.includes('handleIncomingCallResult') || !html.includes('hasAcceptedAlwahaFriendship(payload.from)')) fail('Incoming/outgoing call friendship gate is incomplete.');

if (!html.includes("const safePublicTables = new Set(['posts','reels','products','post_like_counts','reel_like_counts'])") || !html.includes("const isPublicCommentThread = tableName === 'comments'") || !html.includes('target_type=eq')) fail('Offline cache must be limited to public feeds and explicit public comment threads.');
if (!html.includes('function sanitizeAlwahaPublicCacheRows') || !html.includes("products: ['id','seller_id','title','price','category','description','image_url','image_urls','created_at','status','location_label','latitude','longitude','promoted_until']")) fail('Public cache must whitelist public product fields and omit seller/buyer-sensitive fields.');
for (const file of ['supabase/migrations/20261101022015_marketplace_conversation_messaging.sql','supabase/migrations/20261101022031_marketplace_conversation_policy_owner_fix.sql']) if (!fs.existsSync(path.join(process.cwd(),file))) fail('Missing isolated marketplace messaging migration: '+file);
const marketChatPolicyFix=read('supabase/migrations/20261101022031_marketplace_conversation_policy_owner_fix.sql');
if (!marketChatPolicyFix.includes('p.seller_id=market_conversations.seller_id')) fail('Marketplace conversation insert policy must bind seller_id to the outer conversation row.');
if (!html.includes('window.__alwahaHomeFeedInFlight') || !html.includes("alwahaUiDeadline(supabaseFetch('posts?select=*&order=created_at.desc&limit=100'), 9500, null)")) fail('Home feed must coalesce duplicate renders and bound the public posts fetch.');
if (!html.includes('id="market-conversations-panel"') || !html.includes("modal.id='market-chat-modal'") || !html.includes('async function sendMarketMessage()') || !html.includes('market_messages')) fail('Marketplace chat must use its own inbox, modal, and message table.');
if (!html.includes('hasAcceptedAlwahaFriendship(currentChatUserId)')) fail('Friend chat must retain its accepted-friendship gate.');
if (!html.includes('callMarketSeller') || !html.includes('اتصال صوتي بالبائع') || !html.includes('toggleReelFollow')) fail('Marketplace voice-call action missing.');
if (!html.includes('setMarketSearchLocation') || !html.includes('market-radius-select')) fail('Marketplace distance/radius search controls missing.');
if (!html.includes('alwaha_privacy_notice_ack_v1') || !html.includes('showAlwahaPrivacyNoticeIfNeeded')) fail('Privacy notice on first launch missing.');

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
for (const file of ['supabase/migrations/20261029035135_marketplace_lifecycle_reviews.sql','supabase/migrations/20261029035139_require_accepted_friendship_for_messages.sql','supabase/migrations/20261029035151_realtime_call_channel_authorization.sql','supabase/migrations/20261029035414_marketplace_review_privacy_rpc.sql','supabase/migrations/20261029035811_realtime_call_peer_inbox_select.sql']) if (!fs.existsSync(path.join(process.cwd(),file))) fail(`Missing 3.0.2 privacy/marketplace migration: ${file}`);
if (!html.includes("webrtc-call-result") || !html.includes('handleIncomingCallResult') || !html.includes('hasAcceptedAlwahaFriendship(payload.from)')) fail('Incoming/outgoing call friendship gate is incomplete.');
if (!html.includes('config:{private:true}') && !html.includes('config: { private: true }')) fail('WebRTC channels must use private Realtime Broadcast.');
if (!html.includes('waitForIceGathering(timeoutMs = 10000)') || !html.includes('this.client.realtime.setAuth(session.access_token)')) fail('Private call channel auth/ICE safeguards are incomplete.');
if (!html.includes("supabaseClient.rpc('can_review_marketplace_product'")) fail('Marketplace buyer eligibility must be checked by the privacy-safe RPC.');

const themeCss=read('alwaha-theme-system.css');
for(const theme of ['default','spring','summer','autumn','winter']) if(!html.includes(`changeAppTheme('${theme}')`) && !experience.includes(`id:'${theme}'`)) fail(`Theme missing: ${theme}`);
for(const asset of ['bg-spring.webp','bg-summer.webp','bg-autumn.webp','bg-winter.webp']) if(!sw.includes(asset)||!experience.includes(asset)) fail(`Theme asset is not precached and selectable: ${asset}`);
if(!themeCss.includes('--wa-accent')||!themeCss.includes('#alwaha-theme-backdrop')||!html.includes('alwaha-theme-backdrop')) fail('Integrated theme palette/backdrop is missing.');

if (!workflow.includes('npm run audit:chat') || pkg.scripts?.['audit:chat'] !== 'node scripts/chat-release-audit.mjs') fail('Chat/feed regression audit is not wired into release CI.');

if(!html.includes('market-call-room-')||!html.includes("mode:market?'market':'online'")||!html.includes('complete_market_sale')) fail('3.0.2 market call and transaction workflow are incomplete.');
if(!html.includes('toggleAlwahaKidsMode')||!html.includes('alwaha-local-vault.js')||!html.includes('alwaha-experience.js')||!html.includes('alwaha-modal-shell.js')) fail('3.0.2 local experience suite is incomplete.');
if(!fs.existsSync('alwaha-kids-room.js')||!fs.existsSync('alwaha-local-vault.js')||!fs.existsSync('alwaha-experience.js')||!fs.existsSync('alwaha-modal-shell.js')) fail('Missing 3.0.2 local experience modules.');
const legacyPrivilegesMigration=read('supabase/migrations/20261102010000_legacy_client_privileges_hardening.sql');
for(const table of ['public.likes','public.profiles','public.ratings']) if(!legacyPrivilegesMigration.includes(table)) fail(`Legacy privilege hardening missing ${table}.`);
if(!/REVOKE\s+ALL\s+PRIVILEGES\s+ON\s+TABLE[\s\S]*?FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(legacyPrivilegesMigration)) fail('Legacy client table privileges are not fully revoked.');
const retentionMigration=read('supabase/migrations/20261102100000_marketplace_retention_policy_and_cleanup.sql');
for(const marker of ['purge_expired_marketplace_archives','alwaha-marketplace-retention-daily',"interval '30 days'","interval '7 days'","t.status='disputed'",'market_product_sync_conversation_retention_delete','REVOKE ALL ON FUNCTION public.purge_expired_marketplace_archives']) if(!retentionMigration.includes(marker)) fail(`Marketplace retention policy missing: ${marker}`);
if (!retentionMigration.includes("current_user IN ('postgres','service_role')") || !retentionMigration.includes("NEW.status='archived'")) fail('Scheduled warranty expiry must be allowed through the buyer-confirmation guard only for the database role.');
if (!retentionMigration.includes('WITH due AS MATERIALIZED') || !retentionMigration.includes('UPDATE public.market_transactions AS t') || !retentionMigration.includes('UPDATE public.market_conversations AS c')) fail('Retention notice batches must mark only the bounded selected rows.');
if(!retentionMigration.includes("retention_notice_sent_at<=now()-interval '7 days'")||!retentionMigration.includes('يبدأ الحذف بعد 7 أيام من هذا التنبيه')) fail('Late retention cron recovery must preserve a full seven-day notice grace.');
if(!workflow.includes('npm run audit:retention-kids-vault') || pkg.scripts?.['audit:retention-kids-vault']!=='node scripts/retention-kids-vault-audit.mjs') fail('Retention/kids/vault regression audit is not wired into release CI.');
if (!workflow.includes('sql-regression:') || !workflow.includes('needs: sql-regression') || !fs.existsSync('scripts/ci-validate-supabase-sql.sh') || !fs.existsSync('supabase/tests/ci-bootstrap.sql') || !fs.existsSync('supabase/tests/20261102100000_marketplace_retention_behavior.sql') || !fs.existsSync('supabase/tests/20261102100000_marketplace_retention_policy_and_cleanup.sql')) fail('Disposable PostgreSQL SQL regression gate is missing or not required before Android build.');
if(!workflow.includes('npm run audit:marketplace-columns') || pkg.scripts?.['audit:marketplace-columns']!=='node scripts/marketplace-column-audit.mjs') fail('Marketplace column permission audit is not wired into release CI.');
if(!workflow.includes('npm run audit:ui') || pkg.scripts?.['audit:ui']!=='node scripts/ui-handler-audit.mjs') fail('Full UI handler audit is not wired into release CI.');
if(!workflow.includes('npm run audit:themes') || pkg.scripts?.['audit:themes']!=='node scripts/theme-runtime-test.mjs') fail('Theme runtime audit is not wired into release CI.');
if(!workflow.includes('npm run audit:field-repair') || pkg.scripts?.['audit:field-repair']!=='node scripts/field-repair-audit.mjs') fail('Field repair regression audit is not wired into release CI.');
if(!workflow.includes('npm audit --audit-level=high')) fail('Dependency vulnerability audit is not wired into release CI.');
if(!fs.existsSync('supabase/tests/20261102010000_legacy_client_privileges_hardening.sql') || !fs.existsSync('supabase/tests/20261102100000_marketplace_retention_policy_and_cleanup.sql')) fail('Supabase regression assertion files are missing.');
if(!fs.existsSync('scripts/marketplace-column-audit.mjs'))fail('scripts/marketplace-column-audit.mjs is missing.');
if(!fs.readFileSync('TERMUX-PUSH-3.0.2-R7.5-20261103.sh','utf8').includes("scripts/android/AlwahaAudioRoutePlugin.java"))fail('native deployment script must preserve scripts/android plugin.');
if (process.exitCode) throw new Error('Alwaha-Pro 3.0.2 release preflight failed.');
console.log('Alwaha-Pro 3.0.2 release preflight checks passed.');
console.log('Static checks do not replace Supabase integration tests, applying migrations, or two-device call tests.');
