import fs from 'node:fs';
import path from 'node:path';
const fail = (message) => { console.error('FAIL:', message); process.exitCode = 1; };
const read = (file) => { const full=path.join(process.cwd(),file); if(!fs.existsSync(full)){fail(`Missing required file: ${file}`);return '';} return fs.readFileSync(full,'utf8'); };
const html=read('index.html'), games=read('games.js'), pkg=JSON.parse(read('package.json')||'{}'), cap=JSON.parse(read('capacitor.config.json')||'{}'), lock=JSON.parse(read('package-lock.json')||'{}'), manifest=JSON.parse(read('manifest.json')||'{}');
for(const id of ['home-section','market-section','free-section','chat-section','reels-section','games-section','profile-section']){if(!html.includes(`id="${id}"`))fail(`Missing main section: ${id}`);if(!html.includes(`showSection('${id}'`))fail(`Missing navigation handler for ${id}`);}
for(const handler of ['publishNewHomePost','editOwnHomePost','deleteOwnHomePost','renderReelsFeed','editOwnReel','deleteOwnReel','submitNewProductToMarket','editMyMarketItem','deleteMyMarketItem','openMarketProductDetails','handleNewUserRegistrationSubmit','executeUserLoginAuth','savePrivacyProfileUpdates','changeAppTheme']){if(!new RegExp(`(?:async\\s+)?function\\s+${handler}\\s*\\(`).test(html))fail(`Missing app handler: ${handler}`);}
if(html.includes('seller_email'))fail('Frontend must not request or render seller_email.');
if(!html.includes("savedTheme = localStorage.getItem('alwaha_theme') || 'default'"))fail('Saved theme is not restored on startup.');
for(const theme of ['default','nature','tech','soft'])if(!html.includes(`changeAppTheme('${theme}')`))fail(`Missing theme selection: ${theme}`);
if(!html.includes('المكالمات عبر البلوتوث لم تُنفذ بعد'))fail('Bluetooth is not labelled honestly.');
if(!html.includes('aria-disabled="true"'))fail('Bluetooth control should not pretend to work.');
if(games.includes('الألعاب الفردية الحالية')||games.includes('data-mp-legacy')||games.includes('LEGACY_TITLES'))fail('Legacy single-player games remain visible or launchable.');
if(pkg.version!=='2.8.7'||lock.version!=='2.8.7'||lock.packages?.['']?.version!=='2.8.7')fail('package and lockfile versions must be 2.8.7.');
if(cap.appId!=='pro.alwaha.app'||cap.webDir!=='dist')fail('Unexpected Capacitor app configuration.');
if(manifest.version!==pkg.version)fail('manifest.json version must match package.json.');
if(!html.includes('Alwaha-Pro 2.8.7'))fail('HTML release version is not 2.8.7.');
for(const file of ['icon.png','manifest.json','sw.js','scripts/build-web.mjs','production-polish.js','supabase/migrations/20261007082734_20261005000000_fix_like_count_security.sql','supabase/migrations/20261011204819_secure_contact_privacy_defaults.sql','supabase/migrations/20261013235236_multiplayer_game_rooms_v283.sql','supabase/migrations/20261014192321_username_follows_call_features_20261014090000.sql','supabase/migrations/20261014193854_legacy_archive_api_access_hardening.sql','supabase/migrations/20261014194007_safe_public_directory_invoker.sql','supabase/migrations/20261014194053_app_settings_api_privacy.sql','supabase/migrations/20261014194820_release_policy_performance_cleanup.sql','supabase/migrations/20261014194848_rls_initplan_optimization.sql','supabase/migrations/20261014195018_game_room_join_game_validation.sql','supabase/migrations/20261014195108_game_room_join_rpc_compatibility.sql','supabase/migrations/20261014195445_friend_request_column_privileges.sql','supabase/migrations/20261014195540_friend_request_policy_consolidation.sql','supabase/migrations/20261014232322_notification_fail_safe.sql'])if(!fs.existsSync(path.join(process.cwd(),file)))fail(`Missing release file: ${file}`);
if(fs.statSync(path.join(process.cwd(),'icon.png')).size<1000)fail('icon.png unexpectedly small.');
if(process.exitCode)throw new Error('Alwaha-Pro release preflight failed.');
const declaredFunctions=new Set([...html.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]));
for(const match of html.matchAll(/\bon(?:click|change|input|submit|keydown|keyup)\s*=\s*["']\s*(?:return\s+)?([A-Za-z_$][\w$]*)\s*\(/g)){const name=match[1];if(!declaredFunctions.has(name))fail('Inline handler has no declared function: '+name);}
for(const required of ['reg-username','reg-country-code','alwaha-call-ringtone-enabled','openPublicUserProfile','toggleUserFollow','playAlwahaCallRingtone','getAlwahaIceServers'])if(!html.includes(required))fail('Missing release feature: '+required);
if(!html.includes("functions.invoke('username-auth'"))fail('Username Auth invocation missing.');
if(!html.includes("functions.invoke('call-config'"))fail('Call ICE config hook missing.');
if(!fs.existsSync(path.join(process.cwd(),'production-polish.js')))fail('Missing registration/audio polish module.');
for(const asset of ['assets/sounds/saffron_tide.mp3','assets/sounds/marimba_bloom.mp3','assets/backgrounds/bg-nebula.webp','assets/backgrounds/bg-aurora.webp','assets/backgrounds/bg-underwater.webp','assets/backgrounds/bg-moonlit.webp'])if(!fs.existsSync(path.join(process.cwd(),asset)))fail('Missing 2.8.7 media asset: '+asset);
for(const helper of ['setAlwahaLanguage','setAlwahaDataSaver','setAlwahaReducedMotion','setAlwahaRingtoneChoice'])if(!fs.readFileSync(path.join(process.cwd(),'production-polish.js'),'utf8').includes('window.'+helper))fail('Missing settings handler: '+helper);
if(!fs.readFileSync(path.join(process.cwd(),'games.js'),'utf8').includes('p_expected_game_id'))fail('Missing wrong-game room join guard.');
console.log('Alwaha-Pro 2.8.7 release preflight checks passed.');
console.log('Static checks do not replace Supabase integration tests or two-device call tests.');
