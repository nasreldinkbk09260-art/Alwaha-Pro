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
for(const id of ['home-section','market-section','free-section','chat-section','reels-section','games-section','profile-section']){if(!html.includes(`id="${id}"`))fail(`Missing main section: ${id}`);if(!html.includes(`showSection('${id}'`))fail(`Missing navigation handler for ${id}`);}
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
for(const theme of ['default','nature','tech','soft'])if(!html.includes(`changeAppTheme('${theme}')`))fail(`Missing theme selection: ${theme}`);
if(!html.includes('المكالمات عبر البلوتوث لم تُنفذ بعد'))fail('Bluetooth is not labelled honestly.');
if(!html.includes('aria-disabled="true"'))fail('Bluetooth control should not pretend to work.');
if(games.includes('الألعاب الفردية الحالية')||games.includes('data-mp-legacy')||games.includes('LEGACY_TITLES'))fail('Legacy single-player games remain visible or launchable.');
if(pkg.version!=='3.0.1'||lock.version!=='3.0.1'||lock.packages?.['']?.version!=='3.0.1')fail('package and lockfile versions must be 3.0.1.');
if(cap.appId!=='pro.alwaha.app'||cap.webDir!=='dist')fail('Unexpected Capacitor app configuration.');
if(manifest.version!==pkg.version)fail('manifest.json version must match package.json.');
if(!html.includes('Alwaha-Pro 3.0.1'))fail('HTML release version is not 3.0.1.');
for(const file of ['icon.png','manifest.json','sw.js','scripts/build-web.mjs','production-polish.js','supabase/migrations/20261007082734_20261005000000_fix_like_count_security.sql','supabase/migrations/20261011204819_secure_contact_privacy_defaults.sql','supabase/migrations/20261013235236_multiplayer_game_rooms_v283.sql','supabase/migrations/20261014192321_username_follows_call_features_20261014090000.sql','supabase/migrations/20261014193854_legacy_archive_api_access_hardening.sql','supabase/migrations/20261014194007_safe_public_directory_invoker.sql','supabase/migrations/20261014194053_app_settings_api_privacy.sql','supabase/migrations/20261014194820_release_policy_performance_cleanup.sql','supabase/migrations/20261014194848_rls_initplan_optimization.sql','supabase/migrations/20261014195018_game_room_join_game_validation.sql','supabase/migrations/20261014195108_game_room_join_rpc_compatibility.sql','supabase/migrations/20261014195445_friend_request_column_privileges.sql','supabase/migrations/20261014195540_friend_request_policy_consolidation.sql','supabase/migrations/20261014232322_notification_fail_safe.sql','supabase/migrations/20261024211500_marketplace_lifecycle_reviews.sql'])if(!fs.existsSync(path.join(process.cwd(),file)))fail(`Missing release file: ${file}`);
if(fs.statSync(path.join(process.cwd(),'icon.png')).size<1000)fail('icon.png unexpectedly small.');
if(process.exitCode)throw new Error('Alwaha-Pro release preflight failed.');
const declaredFunctions=new Set([...html.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]));
for(const name of ['setAlwahaRingtoneEnabled','playAlwahaCallRingtone','previewAlwahaCallRingtone','stopAlwahaCallRingtone','setAlwahaRingtoneChoice'])if(new RegExp('window\\.'+name+'\\s*=').test(polish))declaredFunctions.add(name);
for(const match of html.matchAll(/\bon(?:click|change|input|submit|keydown|keyup)\s*=\s*["']\s*(?:return\s+)?([A-Za-z_$][\w$]*)\s*\(/g)){const name=match[1];if(!declaredFunctions.has(name))fail('Inline handler has no declared function: '+name);}
for(const required of ['reg-username','reg-country-code','alwaha-call-ringtone-enabled','openPublicUserProfile','toggleUserFollow','playAlwahaCallRingtone','getAlwahaIceServers'])if(!html.includes(required))fail('Missing release feature: '+required);
if(!html.includes("functions.invoke('username-auth'"))fail('Username Auth invocation missing.');
if(!html.includes("functions.invoke('call-config'"))fail('Call ICE config hook missing.');
if(!fs.existsSync(path.join(process.cwd(),'production-polish.js')))fail('Missing registration/audio polish module.');
if(!fs.existsSync(path.join(process.cwd(),'scripts/vendor-assets.mjs')))fail('Missing local vendor asset builder.');
for(const dependency of ['@fortawesome/fontawesome-free','@fontsource/cairo','@supabase/supabase-js'])if(!pkg.dependencies?.[dependency])fail('Missing pinned local dependency: '+dependency);
for(const asset of ['./assets/vendor/fontawesome/css/all.min.css','./assets/vendor/supabase/supabase.js','./assets/vendor/cairo/300.css','./assets/vendor/cairo/400.css','./assets/vendor/cairo/600.css','./assets/vendor/cairo/700.css','./assets/vendor/cairo/900.css'])if(!html.includes(asset))fail('Critical UI dependency is not served locally: '+asset);
for(const asset of ['assets/sounds/saffron_tide.mp3','assets/sounds/marimba_bloom.mp3','assets/backgrounds/bg-nebula.webp','assets/backgrounds/bg-aurora.webp','assets/backgrounds/bg-underwater.webp','assets/backgrounds/bg-moonlit.webp'])if(!fs.existsSync(path.join(process.cwd(),asset)))fail('Missing 3.0.1 media asset: '+asset);
for(const helper of ['setAlwahaLanguage','setAlwahaDataSaver','setAlwahaReducedMotion','setAlwahaRingtoneChoice'])if(!fs.readFileSync(path.join(process.cwd(),'production-polish.js'),'utf8').includes('window.'+helper))fail('Missing settings handler: '+helper);
if(!fs.readFileSync(path.join(process.cwd(),'games.js'),'utf8').includes('p_expected_game_id'))fail('Missing wrong-game room join guard.');
if (!pkg.dependencies?.['@capacitor/app']) fail('Missing Android native back plugin: @capacitor/app.');
if (!pkg.devDependencies?.['esbuild']) fail('Missing web build dependency: esbuild.');
if (!html.includes('./alwaha-native-back-handler.js')) fail('Native back handler script tag missing.');
if (!buildWeb.includes("path.join(root, 'scripts', 'native-back-handler.mjs')") || !buildWeb.includes("outfile: path.join(dist, 'alwaha-native-back-handler.js')") || !buildWeb.includes("if (!fs.existsSync(path.join(dist, 'alwaha-native-back-handler.js')))") ) fail('Native back handler is not integrated into the web build.');
if (!sw.includes("'./alwaha-native-back-handler.js'")) fail('Native back handler is not precached by the service worker.');
if (!nativeBack.includes("App.addListener('backButton'")) fail('Native back listener registration missing.');
if (!nativeBack.includes('window.alwahaExitNativeApp = () => App.exitApp()') || !html.includes('window.alwahaExitNativeApp')) fail('Android exit confirmation does not invoke the native exit action.');
for (const permission of ['android.permission.CAMERA','android.permission.RECORD_AUDIO','android.permission.MODIFY_AUDIO_SETTINGS','android.permission.ACCESS_COARSE_LOCATION','android.permission.ACCESS_FINE_LOCATION']) if (!workflow.includes(permission)) fail(`Android feature permission missing from release workflow: ${permission}`);


if (!html.includes("const safePublicTables = new Set(['posts','reels','products','post_like_counts','reel_like_counts'])") || !html.includes("const isPublicCommentThread = tableName === 'comments'") || !html.includes('target_type=eq')) fail('Offline cache must be limited to public feeds and explicit public comment threads.');
if (!html.includes("delete row['seller_'+'email']") || !html.includes("delete row['sold_'+'to']")) fail('Public product cache does not remove sensitive seller/buyer fields.');
if (!html.includes('callMarketSeller') || !html.includes('اتصال صوتي بالبائع') || !html.includes('toggleReelFollow')) fail('Marketplace voice-call action missing.');
if (!html.includes('setMarketSearchLocation') || !html.includes('market-radius-select')) fail('Marketplace distance/radius search controls missing.');
if (!html.includes('alwaha_privacy_notice_ack_v1') || !html.includes('showAlwahaPrivacyNoticeIfNeeded')) fail('Privacy notice on first launch missing.');

if (!html.includes('height: 100dvh;') || !html.includes('body.alwaha-exit-confirm-open') || !html.includes('function showExitConfirmationModal()')) fail('Exit confirmation viewport/safe-area fix missing.');
if (!html.includes('max-height: calc(100dvh - 122px - env(safe-area-inset-bottom))') || !html.includes('class=\"reels-floating-btn')) fail('Reels options menu is not bounded to the viewport or circular actions missing.');
if (!html.includes('preload=\"${index===0?\'metadata\':\'none\'}\"') || !html.includes('alwaha-mobile-performance-final')) fail('Reels network preloading/mobile rendering performance guard missing.');
if (!html.includes('sellerRatingSummary') || !html.includes('marketplace_reviews?seller_id=')) fail('Marketplace seller rating summary missing.');
for (const label of ['إعجاب','تعليق','متابعة','مشاركة','حفظ','خيارات']) if (!html.includes(label)) fail(`Missing reels action label: ${label}`);
if (!html.includes('products?select=id,seller_id,title,price,category,description,image_url,image_urls,created_at,status,location_label,latitude,longitude,promoted_until&order=created_at.desc&limit=120')) fail('Public marketplace query must use an explicit, minimized field list.');

const marketplaceMigration = read('supabase/migrations/20261024211500_marketplace_lifecycle_reviews.sql');
for (const feature of ['marketplace_reviews','marketplace_reports','products_status_created_idx','products_geo_idx','marketplace_reviews_insert_verified_buyer','marketplace_reports_insert_own']) if (!marketplaceMigration.includes(feature)) fail(`Marketplace migration missing: ${feature}`);

if (process.exitCode) throw new Error('Alwaha-Pro release preflight failed.');
console.log('Alwaha-Pro 3.0.1 release preflight checks passed.');
console.log('Static checks do not replace Supabase integration tests, applying migrations, or two-device call tests.');
