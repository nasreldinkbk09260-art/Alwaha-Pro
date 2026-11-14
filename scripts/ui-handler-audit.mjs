import fs from 'node:fs';

const sourceFiles=['index.html','production-polish.js','compatibility.js','games.js','alwaha-experience.js','alwaha-modal-shell.js','alwaha-kids-room.js','alwaha-local-vault.js','scripts/native-back-handler.mjs'];
const contents=new Map();
for(const file of sourceFiles){if(!fs.existsSync(file))throw new Error(`Missing UI source ${file}`);contents.set(file,fs.readFileSync(file,'utf8'));}
const all=[...contents.values()].join('\n');
const definitions=new Set();
for(const m of all.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g))definitions.add(m[1]);
for(const m of all.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g))definitions.add(m[1]);
for(const m of all.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^\n]*?\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g))definitions.add(m[1]);
const ignored=new Set(['event','this','if','for','while','switch','catch','function','return','setTimeout','setInterval','clearTimeout','clearInterval','confirm','alert','prompt','parseInt','parseFloat','Number','String','Boolean','Math','JSON','Date','Array','Object','Promise','console','encodeURIComponent','decodeURIComponent','stopPropagation','preventDefault','closest','remove','slice','trim','map','filter','forEach','find','includes','join','push','setItem','getItem','removeItem','focus','click','querySelector','querySelectorAll','addEventListener','dispatchEvent','classList','getAttribute','setAttribute','scrollIntoView','toLocaleString','toLocaleTimeString','toLocaleDateString','toISOString','replace','split','match','test','format','toString']);
const html=contents.get('index.html'),references=[];
for(const m of html.matchAll(/\bon(?:click|change|input|submit|keydown|keyup|touchstart|touchend|load|error)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)){
  const expr=m[1]??m[2]??'';
  for(const call of expr.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)){const name=call[1];if(!ignored.has(name))references.push({name,expr:expr.slice(0,130)});}
}
const unique=[...new Map(references.map(x=>[x.name,x])).values()];
const missing=unique.filter(x=>!definitions.has(x.name));
if(missing.length){for(const m of missing)console.error(`FAIL: unresolved inline event function ${m.name}: ${m.expr}`);process.exit(1);}
console.log(`PASS: ${references.length} inline event function calls resolve to ${unique.length} defined names.`);
const forbidden=['toggleFreeMeshShareSystem','free-mode-toggle-main-btn','local-share-file-btn','openAlwahaLocalNetworkPanel'];
for(const marker of forbidden){if(html.includes(marker))throw new Error(`Removed local-network control returned: ${marker}`);}
console.log('PASS: removed local-network controls remain absent.');
const chessEngine=fs.readFileSync('assets/chess.min.js','utf8');
if(/\bexport\s*\{/.test(chessEngine)||!chessEngine.includes("window.Chess=Chess"))throw new Error('Chess engine must expose window.Chess for the classic games runtime.');
console.log('PASS: chess engine is compatible with the classic games runtime.');
