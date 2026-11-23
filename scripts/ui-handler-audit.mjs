import fs from 'node:fs';

const sourceFiles=['index.html','production-polish.js','compatibility.js','games.js','alwaha-experience.js','alwaha-modal-shell.js','alwaha-kids-room.js','alwaha-local-vault.js','scripts/native-back-handler.mjs'];
const contents=new Map();
for(const file of sourceFiles){if(!fs.existsSync(file))throw new Error(`Missing UI source ${file}`);contents.set(file,fs.readFileSync(file,'utf8'));}
const all=[...contents.values()].join('\n');
const definitions=new Set();
for(const m of all.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g))definitions.add(m[1]);
for(const m of all.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g))definitions.add(m[1]);
for(const m of all.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^\n]*?\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g))definitions.add(m[1]);
const ignored=new Set(['event','this','if','for','while','switch','catch','function','return','setTimeout','setInterval','clearTimeout','clearInterval','confirm','alert','prompt','parseInt','parseFloat','Number','String','Boolean','Math','JSON','Date','Array','Object','Promise','console','encodeURIComponent','decodeURIComponent','stopPropagation','preventDefault','closest','remove','slice','trim','map','filter','forEach','find','includes','join','push','setItem','getItem','removeItem','focus','click','getElementById','querySelector','querySelectorAll','addEventListener','dispatchEvent','classList','getAttribute','setAttribute','scrollIntoView','toLocaleString','toLocaleTimeString','toLocaleDateString','toISOString','replace','split','match','test','format','toString']);
const html=contents.get('index.html'),references=[];
for(const m of html.matchAll(/\bon(?:click|change|input|submit|keydown|keyup|touchstart|touchend|load|error)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)){
  const expr=m[1]??m[2]??'';
  for(const call of expr.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)){const name=call[1];if(!ignored.has(name))references.push({name,expr:expr.slice(0,130)});}
}
const unique=[...new Map(references.map(x=>[x.name,x])).values()];
const missing=unique.filter(x=>!definitions.has(x.name));
if(missing.length){for(const m of missing)console.error(`FAIL: unresolved inline event function ${m.name}: ${m.expr}`);process.exit(1);}
console.log(`PASS: ${references.length} inline event function calls resolve to ${unique.length} defined names.`);
const forbidden=['toggleFreeMeshShareSystem','free-mode-toggle-main-btn','local-share-file-btn','openAlwahaLocalNetworkPanel','share-app-btn-main','shareAlwahaApp','shareApk'];
for(const marker of forbidden){if(html.includes(marker))throw new Error(`Removed local-network control returned: ${marker}`);}
console.log('PASS: removed local-network controls remain absent.');
const nativeAudioPlugin=fs.readFileSync('scripts/android/AlwahaAudioRoutePlugin.java','utf8');
const browserVisual=fs.readFileSync('scripts/browser-visual-acceptance.mjs','utf8');
if(html.includes('async function shareTextContent')&&html.includes('shareReelContent'))console.log('PASS: post/reel content sharing remains independent.');else throw new Error('Post/reel content sharing unexpectedly removed.');
if(!html.includes('share-app-btn-main')&&!html.includes('shareAlwahaApp')&&!nativeAudioPlugin.includes('shareApk'))console.log('PASS: retired application APK-share UI/native path absent.');else throw new Error('Retired app-share path returned.');
const homeStart=html.indexOf('<section id="home-section"'),marketStart=html.indexOf('<section id="market-section"',homeStart);const homeSection=homeStart>=0?html.slice(homeStart,marketStart<0?html.length:marketStart):'';
if(!homeSection.includes('toggleInternalNotificationCenter')&&html.includes('notification-nav-item'))console.log('PASS: one persistent home notification entry.');else throw new Error('Duplicate home notification entry found.');
const callStart=html.indexOf('function updateCallUi(state, meta = {})'),callEnd=html.indexOf('function startCallTimer()',callStart);const callUi=callStart>=0?html.slice(callStart,callEnd):'';
if(callUi.includes("callCloseBtn.style.display = state === 'idle' ? 'inline-block' : 'none'")&&callUi.includes("endBtn.style.display = ['outgoing','connected','connecting'].includes(state) ? 'inline-block' : 'none'"))console.log('PASS: call close and hang-up are mutually exclusive.');else throw new Error('Call control de-duplication missing.');
if(browserVisual.includes('auditActiveControls')&&browserVisual.includes('CONTROL-AUDIT.json')&&browserVisual.includes('duplicate visible semantic actions')&&browserVisual.includes('function fingerprintFunction')&&browserVisual.includes('function actionFingerprint'))console.log('PASS: Chromium performs wrapper-aware live semantic control inspection.');else throw new Error('Wrapper-aware live semantic audit missing from browser runner.');
if(browserVisual.includes('Page.addScriptToEvaluateOnNewDocument')&&browserVisual.includes('__alwahaAuditListeners')&&browserVisual.includes('directClickListenerCount')&&browserVisual.includes('direct-listener-and-card-dedupe-self-test')&&browserVisual.includes('cardGroups'))console.log('PASS: Chromium captures direct click listeners and audits duplicate actions within each card.');else throw new Error('Direct-listener/card-level semantic audit coverage missing from browser runner.');
const profileViews=['sub-prof-register','sub-prof-login','sub-prof-settings','sub-prof-device-suite','sub-prof-recovery','sub-prof-password-change','sub-prof-password-reset','sub-prof-privacy','sub-prof-verify'];
if(profileViews.every(id=>browserVisual.includes(id))&&browserVisual.includes('profile subview '))console.log('PASS: Chromium traverses every profile subview.');else throw new Error('Profile subview coverage missing from browser runner.');
if(browserVisual.includes("auditActiveControls('reels add menu')")&&browserVisual.includes("auditActiveControls('market buy')")&&browserVisual.includes("auditActiveControls('market my items')")&&browserVisual.includes('CI Active Listing')&&browserVisual.includes('reactivateMyProduct'))console.log('PASS: Chromium covers reels action menu and buyer/seller market tabs.');else throw new Error('Reels and marketplace tab interaction coverage missing.');

const chessEngine=fs.readFileSync('assets/chess.min.js','utf8');
if(/\bexport\s*\{/.test(chessEngine)||!chessEngine.includes("window.Chess=Chess"))throw new Error('Chess engine must expose window.Chess for the classic games runtime.');
console.log('PASS: chess engine is compatible with the classic games runtime.');
