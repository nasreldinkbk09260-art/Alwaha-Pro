import fs from 'node:fs';

const read=(file)=>{if(!fs.existsSync(file))throw new Error('Missing UI source: '+file);return fs.readFileSync(file,'utf8');};
const sourceFiles=[
  'index.html','production-polish.js','compatibility.js','games.js',
  'alwaha-experience.js','alwaha-modal-shell.js','alwaha-kids-room.js',
  'alwaha-local-vault.js','alwaha-smart-assistant.js','alwaha-profile-editor.js',
  'scripts/native-back-handler.mjs'
];
const sources=new Map(sourceFiles.map(file=>[file,read(file)]));
const all=[...sources.values()].join('\n');
const html=sources.get('index.html');
const definitions=new Set();
for(const m of all.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g))definitions.add(m[1]);
for(const m of all.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g))definitions.add(m[1]);
for(const m of all.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^\n]*?\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g))definitions.add(m[1]);

const ignored=new Set([
  'event','this','if','for','while','switch','catch','function','return',
  'setTimeout','setInterval','clearTimeout','clearInterval','confirm','alert','prompt',
  'parseInt','parseFloat','Number','String','Boolean','Math','JSON','Date','Array',
  'Object','Promise','console','encodeURIComponent','decodeURIComponent',
  'stopPropagation','preventDefault','closest','remove','slice','trim','map','filter',
  'forEach','find','includes','join','push','setItem','getItem','removeItem','focus',
  'click','getElementById','querySelector','querySelectorAll','addEventListener',
  'dispatchEvent','classList','getAttribute','setAttribute','scrollIntoView',
  'toLocaleString','toLocaleTimeString','toLocaleDateString','toISOString',
  'replace','split','match','test','format','toString'
]);
const buttons=[...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button\s*>/gi)].map((m,index)=>{
  const full=m[0],open=full.match(/^<button\b[^>]*>/i)?.[0]||'';
  const attr=(name)=>{
    const lower=open.toLowerCase(),needle=name.toLowerCase();
    let at=lower.indexOf(needle);
    while(at>=0){
      const before=at===0?' ':open[at-1],after=open[at+needle.length]||' ';
      if(!/[a-z0-9_:-]/i.test(before)&&!/[a-z0-9_:-]/i.test(after)){
        let i=at+needle.length;
        while(/\s/.test(open[i]||''))i++;
        if(open[i++]!=='='){at=lower.indexOf(needle,at+needle.length);continue;}
        while(/\s/.test(open[i]||''))i++;
        const quote=open[i++];if(quote!==String.fromCharCode(34)&&quote!==String.fromCharCode(39))return '';
        const end=open.indexOf(quote,i);return end<0?'':open.slice(i,end);
      }
      at=lower.indexOf(needle,at+needle.length);
    }
    return '';
  };
  const onclick=attr('onclick'),type=attr('type')||'button';
  const label=attr('aria-label')||attr('title')||full
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ').replace(/\$\{[^}]*\}/g,' dynamic action ')
    .replace(/&nbsp;|&#160;/gi,' ').replace(/&times;/gi,'×')
    .replace(/\s+/g,' ').trim();
  const line=html.slice(0,m.index).split('\n').length;
  return {index:index+1,full,open,id:attr('id'),type,onclick,label,line};
});
const failures=[];
let inlineCount=0,formCount=0,boundCount=0;
const need=(condition,message)=>{if(!condition)failures.push(message);};

for(const b of buttons){
  need(!!b.label,'Button #'+b.index+' at line '+b.line+' has no accessible name (id='+b.id+').');
  if(b.onclick){
    inlineCount++;
    const calls=[...b.onclick.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]).filter(name=>!ignored.has(name));
    need(calls.length>0,'Button #'+b.index+' at line '+b.line+' has an onclick but no recognized action call.');
    for(const name of calls)need(definitions.has(name),'Button #'+b.index+' at line '+b.line+' calls undefined handler '+name+'.');
    continue;
  }
  if(b.type==='submit'){
    formCount++;
    if(b.id==='verification-submit-button')
      need(html.includes('<form id="verification-request-form" onsubmit="submitAccountVerificationRequest(event)"'),'Verification submit button must submit through submitAccountVerificationRequest.');
    else if(b.id==='home-post-edit-save-btn')
      need(html.includes('<form id="home-post-edit-form"')&&html.includes('onsubmit="saveEditedHomePost(event)"'),'Home edit save button must submit through saveEditedHomePost.');
    else if(b.id==='market-action-submit')
      need(html.includes("modal.querySelector('#market-action-form')?.addEventListener('submit',submitMarketActionForm)")&&html.includes('async function submitMarketActionForm(event)'),'Marketplace action submit button must route through submitMarketActionForm.');
    else need(false,'Unclassified submit button #'+b.index+' at line '+b.line+' has no explicit form route.');
    continue;
  }
  boundCount++;
  if(b.id==='alwaha-smart-assistant-action'){
    need(sources.get('alwaha-smart-assistant.js').includes("action?.addEventListener('click', () => runAction(action.dataset.action || ''))"),'Smart assistant action must bind its click listener.');
  }else if(['startCallBtn','acceptCallBtn','declineCallBtn','muteBtn','endCallBtn'].includes(b.id)){
    const binding={
      startCallBtn:"startBtn.onclick = () => initiateVoiceCall('online')",
      acceptCallBtn:'acceptBtn.onclick = () => acceptIncomingCall()',
      declineCallBtn:'declineBtn.onclick = () => rejectIncomingCall()',
      muteBtn:'muteBtn.onclick = () => {',
      endCallBtn:'endBtn.onclick = () => terminateVoiceCall()'
    }[b.id];
    need(html.includes('function bindCallControls()')&&html.includes(binding),'Call button '+b.id+' must be bound by bindCallControls.');
  }else{
    const text=b.full;
    if(text.includes('data-mesh-consent="yes"'))need(html.includes("overlay.querySelector('[data-mesh-consent=\"yes\"]').addEventListener('click'"),'Mesh consent accept button must be bound.');
    else if(text.includes('data-mesh-consent="no"'))need(html.includes("overlay.querySelector('[data-mesh-consent=\"no\"]').addEventListener('click'"),'Mesh consent decline button must be bound.');
    else if(text.includes('data-mesh-consent="later"'))need(html.includes("overlay.querySelector('[data-mesh-consent=\"later\"]').addEventListener('click'"),'Mesh consent defer button must be bound.');
    else if(text.includes('data-enable-bt'))need(html.includes("overlay.querySelector('[data-enable-bt]')?.addEventListener('click'"),'Bluetooth enable action must be bound.');
    else if(text.includes('data-enable-wifi'))need(html.includes("overlay.querySelector('[data-enable-wifi]')?.addEventListener('click'"),'Wi-Fi panel action must be bound.');
    else if(text.includes('data-radio-retry'))need(html.includes("overlay.querySelector('[data-radio-retry]').addEventListener('click'"),'Radio retry action must be bound.');
    else if(text.includes('data-radio-cancel'))need(html.includes("overlay.querySelector('[data-radio-cancel]').addEventListener('click'"),'Radio cancel action must be bound.');
    else if(text.includes('data-video-call-mode="normal"'))need(html.includes("overlay.querySelector('[data-video-call-mode=\"normal\"]').addEventListener('click'"),'Normal video mode action must be bound.');
    else if(text.includes('data-video-call-mode="kids"'))need(html.includes("overlay.querySelector('[data-video-call-mode=\"kids\"]').addEventListener('click'"),'Kids video mode action must be bound.');
    else if(text.includes('data-video-call-cancel'))need(html.includes("overlay.querySelector('[data-video-call-cancel]').addEventListener('click', finish)"),'Video chooser cancel action must be bound.');
    else if(text.includes('data-market-action-close'))need(html.includes("modal.querySelector('[data-market-action-close]')?.addEventListener('click',()=>closeMarketActionForm())"),'Marketplace modal close action must be bound.');
    else need(false,'Unclassified button without inline handler: #'+b.index+' at line '+b.line+' id='+b.id+'.');
  }
}
const eventAttributes=[...html.matchAll(/\bon(?:click|change|input|submit|keydown|keyup|touchstart|touchend|load|error)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)];
for(const m of eventAttributes){
  const expr=m[1]??m[2]??'';
  for(const call of expr.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)){
    const name=call[1];
    if(!ignored.has(name))need(definitions.has(name),'Inline event refers to undefined handler '+name+': '+expr.slice(0,120));
  }
}
need(buttons.length>=200,'Static button inventory unexpectedly shrank below 200; review parser or source changes.');
need(inlineCount+formCount+boundCount===buttons.length,'Button route categories do not sum to the complete inventory.');
if(failures.length){
  for(const failure of failures)console.error('FAIL:',failure);
  console.error('BUTTON_ROUTE_INVENTORY=FAIL ('+failures.length+' failures; '+buttons.length+' buttons)');
  process.exit(1);
}
console.log('PASS: every static button has an accessible name.');
console.log('PASS: every inline button handler resolves to a declared function.');
console.log('PASS: every form submit button maps to its owning form submit handler.');
console.log('PASS: all non-inline call, assistant, consent, radio, video and marketplace controls have explicit event bindings.');
console.log('BUTTON_ROUTE_INVENTORY=PASS ('+buttons.length+' buttons; '+inlineCount+' inline; '+formCount+' form-submit; '+boundCount+' bound)');
