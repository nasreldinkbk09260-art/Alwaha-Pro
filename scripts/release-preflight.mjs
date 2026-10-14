import fs from 'node:fs';
import path from 'node:path';
const fail = (message) => { console.error('FAIL:', message); process.exitCode = 1; };
const read = (file) => { const full=path.join(process.cwd(),file); if(!fs.existsSync(full)){fail(`Missing required file: ${file}`);return '';} return fs.readFileSync(full,'utf8'); };
const html=read('index.html'), games=read('games.js'), pkg=JSON.parse(read('package.json')||'{}'), cap=JSON.parse(read('capacitor.config.json')||'{}'), lock=JSON.parse(read('package-lock.json')||'{}');
for(const id of ['home-section','market-section','free-section','chat-section','reels-section','games-section','profile-section']){if(!html.includes(`id="${id}"`))fail(`Missing main section: ${id}`);if(!html.includes(`showSection('${id}'`))fail(`Missing navigation handler for ${id}`);}
for(const handler of ['publishNewHomePost','editOwnHomePost','deleteOwnHomePost','renderReelsFeed','editOwnReel','deleteOwnReel','submitNewProductToMarket','editMyMarketItem','deleteMyMarketItem','openMarketProductDetails','handleNewUserRegistrationSubmit','executeUserLoginAuth','savePrivacyProfileUpdates','changeAppTheme']){if(!new RegExp(`(?:async\\s+)?function\\s+${handler}\\s*\\(`).test(html))fail(`Missing app handler: ${handler}`);}
if(html.includes('seller_email'))fail('Frontend must not request or render seller_email.');
if(!html.includes("savedTheme = localStorage.getItem('alwaha_theme') || 'default'"))fail('Saved theme is not restored on startup.');
for(const theme of ['default','nature','tech','soft'])if(!html.includes(`changeAppTheme('${theme}')`))fail(`Missing theme selection: ${theme}`);
if(!html.includes('المكالمات عبر البلوتوث لم تُنفذ بعد'))fail('Bluetooth is not labelled honestly.');
if(!html.includes('aria-disabled="true"'))fail('Bluetooth control should not pretend to work.');
if(games.includes('الألعاب الفردية الحالية')||games.includes('data-mp-legacy')||games.includes('LEGACY_TITLES'))fail('Legacy single-player games remain visible or launchable.');
if(pkg.version!=='2.8.4'||lock.version!=='2.8.4'||lock.packages?.['']?.version!=='2.8.4')fail('package and lockfile versions must be 2.8.4.');
if(cap.appId!=='pro.alwaha.app'||cap.webDir!=='dist')fail('Unexpected Capacitor app configuration.');
if(!html.includes('Alwaha-Pro 2.8.4'))fail('HTML release version is not 2.8.4.');
for(const file of ['icon.png','manifest.json','sw.js','scripts/build-web.mjs','supabase/migrations/20261012140000_multiplayer_game_rooms.sql'])if(!fs.existsSync(path.join(process.cwd(),file)))fail(`Missing release file: ${file}`);
if(fs.statSync(path.join(process.cwd(),'icon.png')).size<1000)fail('icon.png unexpectedly small.');
if(process.exitCode)throw new Error('Alwaha-Pro release preflight failed.');
console.log('Alwaha-Pro 2.8.4 release preflight checks passed.');
console.log('Static checks do not replace Supabase integration tests or two-device call tests.');
