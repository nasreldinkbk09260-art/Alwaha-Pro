import fs from 'node:fs';
const fail=m=>{console.error('FAIL:',m);process.exitCode=1;};
const pass=m=>console.log('PASS:',m);
const read=p=>{if(!fs.existsSync(p)){fail('Missing '+p);return '';}return fs.readFileSync(p,'utf8');};
const html=read('index.html'),guard=read('alwaha-runtime-guard.js'),modal=read('alwaha-modal-shell.js'),experience=read('alwaha-experience.js'),sw=read('sw.js'),build=read('scripts/build-web.mjs'),pkg=JSON.parse(read('package.json')),wf=read('.github/workflows/build-apk-aab-release.yml');
const a=html.indexOf('// تهيئة كل المكونات بعد جاهزية DOM'),b=html.indexOf('// Alwaha-Pro Cosmic Garden UX and production-safe form behavior.',a),init=a>=0&&b>a?html.slice(a,b):'';
const checks=[
 ['runtime guard uses the versioned service-worker path and retains an unversioned offline retry',html.includes('src="./alwaha-runtime-guard.js?v=3.0.3-core-20261113"')&&sw.includes("'./alwaha-runtime-guard.js?v=3.0.3-core-20261113'")&&sw.includes("'./alwaha-runtime-guard.js'")&&guard.includes('window.AlwahaRuntimeGuard')],
 ['synchronous and asynchronous JS failures are captured',guard.includes("addEventListener('error'")&&guard.includes("addEventListener('unhandledrejection'")],
 ['local navigation fallback exists when the main router fails',guard.includes('fallbackNavigate')&&guard.includes('bindNavigation')&&guard.includes('fallbackDock')],
 ['feed watchdog restores a retry state after a stuck loading indicator',guard.includes('feedWatchdog')&&guard.includes('18000')&&guard.includes('إعادة المحاولة')],
 ['runtime module retry strips query strings and avoids duplicate retry scripts',guard.includes("(s.getAttribute('src')||'').split('?')[0]")&&guard.includes("s.src='./'+path")&&guard.includes('dataset.alwahaRetry')],
 ['modal candidate selection avoids Array.at for older Android WebViews',!modal.includes('.at(-1)')&&modal.includes('layers.length?layers[layers.length-1]:null')],
 ['modal observer filters mutations to dialog/layer nodes only',modal.includes('hasRelevantMutation(records)')&&modal.includes('nodeContainsLayer')&&modal.includes('LAYER_SELECTOR')],
 ['modal observer batches relevant updates in requestAnimationFrame',modal.includes('function scheduleSync()')&&modal.includes('syncScheduled')&&modal.includes('requestAnimationFrame')],
 ['modal shell syncs the navigation dock only when the top layer changes',modal.includes('if(changed)window.AlwahaExperience?.syncDock?.()')],
 ['modal shell observer start is idempotent',modal.includes('if(started||!document.body)return;started=true;')],
 ['experience module initialization is exported and idempotent',experience.includes('if(initialized||!document.body)return;initialized=true;')&&experience.includes('syncDock,initialize')],
 ['experience local preference access tolerates blocked localStorage',experience.includes('function safeGet')&&experience.includes('function safeSet')&&experience.includes('function safeRemove')],
 ['navigation group dragging has no duplicate whole-document observer',!experience.includes('modalObserver')&&!experience.includes('new MutationObserver')],
 ['whole-dock movement is initiated by long-press on any navigation button',experience.includes("const item=event.target.closest('.nav-item')")&&experience.includes("nav.classList.add('alwaha-nav-free-position','alwaha-nav-group-dragging')")],
 ['cached local profile/feed are initialized before bounded cloud tasks',init.includes("safeStartup('profile-ui', syncUiWithLoadedProfileData)")&&init.includes("safeStartup('home-feed', renderHomePostsFeed)")&&init.indexOf("safeStartup('home-feed'")<init.indexOf('const cloudTasks')&&!init.includes("DOMContentLoaded', async")],
 ['duplicate legacy home/feed DOMContentLoaded bootstrap is absent',!html.includes("/* تهيئة العرض الابتدائي عند تحميل الصفحة */")&&!html.includes("window.addEventListener('DOMContentLoaded', () => {\n            syncUiWithLoadedProfileData();\n            renderHomePostsFeed();")],
 ['background cloud services include calls, notifications, friends and market inbox',init.includes('initializeRealtimeCallInbox()')&&init.includes('subscribeToNotifications()')&&init.includes('subscribeToDirectMessages()')&&init.includes('subscribeToMarketInbox()')&&init.includes('Promise.allSettled(cloudTasks)')],
 ['core local script URLs match versioned assets and offline retry precache paths', ['games.js','alwaha-experience.js','alwaha-modal-shell.js','alwaha-runtime-guard.js','alwaha-call-feedback.js'].every(asset=>html.includes('src="./'+asset+'?v=3.0.3-core-20261113"')&&sw.includes("'./"+asset+"'")&&sw.includes("'./"+asset+"?v=3.0.3-core-20261113'"))],
 ['runtime guard is copied into the Web build and both cache paths are precached',build.includes("'alwaha-runtime-guard.js'")&&sw.includes("'./alwaha-runtime-guard.js'")&&sw.includes("'./alwaha-runtime-guard.js?v=3.0.3-core-20261113'")],
 ['runtime audit is wired into npm and Android CI',pkg.scripts?.['audit:runtime']==='node scripts/runtime-boot-audit.mjs'&&wf.includes('npm run audit:runtime')],
 ['service-worker update bypasses HTTP cache and uses a versioned registration',html.includes("navigator.serviceWorker.register('./sw.js?v=3.0.3-core-20261113', { scope: './', updateViaCache: 'none' });")],
 ['modal mutation observer filters relevant layers and coalesces updates',modal.includes('hasRelevantMutation(records)')&&modal.includes('scheduleSync()')&&modal.includes('nodeContainsLayer')&&modal.includes('if(changed)window.AlwahaExperience?.syncDock?.()')],
 ['navigation handle label updates are idempotent',experience.includes('if(handle.textContent!==handleLabel)handle.textContent=handleLabel')&&!experience.includes('new MutationObserver')]

 ['service-worker uses the final 3.0.3 cache namespace',sw.includes("const CACHE_NAME = 'alwaha-pro-v3.0.3-final-20261113-core-consolidated'")],
];
for(const [name,ok] of checks)ok?pass(name):fail(name);
if(process.exitCode)process.exit(1);
console.log(`RUNTIME_BOOT_AUDIT=PASS (${checks.length} checks)`);
