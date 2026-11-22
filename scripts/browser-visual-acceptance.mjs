import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const root=path.resolve('dist');
const chromePath=process.env.CHROME_PATH;
const outputDir=path.resolve('artifacts/browser-visual');
if(!fs.existsSync(path.join(root,'index.html')))throw new Error('dist/index.html is missing.');
if(!chromePath||!fs.existsSync(chromePath))throw new Error('CHROME_PATH must point to installed Chrome.');
fs.mkdirSync(outputDir,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg','.woff2':'font/woff2','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
  try{
    const url=new URL(req.url||'/', 'http://127.0.0.1');
    const relative=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/,'');
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html')){res.writeHead(403);res.end('Forbidden');return;}
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'});
    fs.createReadStream(file).pipe(res);
  }catch{res.writeHead(400);res.end('Bad request');}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const sitePort=server.address().port;
const probe=net.createServer();
await new Promise((resolve,reject)=>probe.listen(0,'127.0.0.1',resolve).once('error',reject));
const debugPort=probe.address().port;
await new Promise(resolve=>probe.close(resolve));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'alwaha-chrome-'));
const chrome=spawn(chromePath,[
 '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
 '--disable-background-networking','--disable-component-update','--disable-default-apps',
 '--disable-extensions','--disable-sync','--disable-service-worker','--no-first-run',
 '--no-default-browser-check','--hide-scrollbars','--remote-debugging-port='+debugPort,
 '--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,
 '--window-size=412,915','--force-device-scale-factor=1','about:blank'
],{stdio:['ignore','ignore','pipe']});
let chromeError='';
chrome.stderr.on('data',chunk=>{chromeError+=chunk.toString();if(chromeError.length>12000)chromeError=chromeError.slice(-12000);});
let ws=null,id=0;
const pending=new Map(),handlers=new Map(),unexpectedErrors=[],controlAuditResults=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function getJson(url){const r=await fetch(url);if(!r.ok)throw new Error('HTTP '+r.status+' '+url);return r.json();}
async function waitFor(fn,label,timeout=25000){
 const start=Date.now();
 while(Date.now()-start<timeout){if(await fn())return;if(chrome.exitCode!==null)throw new Error('Chrome exited '+chrome.exitCode+'\n'+chromeError);await sleep(150);}
 throw new Error('Timed out waiting for '+label+'\n'+chromeError);
}
async function connect(){
 const version=await getJson('http://127.0.0.1:'+debugPort+'/json/version');
 const pages=await getJson('http://127.0.0.1:'+debugPort+'/json');
 const page=pages.find(x=>x.type==='page');
 if(!page)throw new Error('Chrome page target not found.');
 ws=new WebSocket(page.webSocketDebuggerUrl||version.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{
  const t=setTimeout(()=>reject(new Error('DevTools WebSocket timeout')),10000);
  ws.addEventListener('open',()=>{clearTimeout(t);resolve();},{once:true});
  ws.addEventListener('error',()=>{clearTimeout(t);reject(new Error('DevTools WebSocket connection error'));},{once:true});
 });
 ws.addEventListener('message',event=>{
  let message;try{message=JSON.parse(event.data);}catch{return;}
  if(message.id&&pending.has(message.id)){const item=pending.get(message.id);pending.delete(message.id);if(message.error)item.reject(new Error(message.error.message||'CDP error'));else item.resolve(message.result||{});}
  else if(message.method){for(const handler of handlers.get(message.method)||[])handler(message.params||{});}
 });
}
function on(method,handler){const list=handlers.get(method)||[];list.push(handler);handlers.set(method,list);}
function send(method,params){
 const command=++id;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(command);reject(new Error('CDP timeout: '+method));},15000);
  pending.set(command,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
  ws.send(JSON.stringify({id:command,method,params}));
 });
}
async function evaluate(expression){
 const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
 if(r.exceptionDetails)throw new Error(r.exceptionDetails.text||'Browser script exception');
 return r.result?r.result.value:undefined;
}
async function screenshot(name){
 const r=await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
 fs.writeFileSync(path.join(outputDir,name),Buffer.from(r.data,'base64'));
}
async function visible(selector,label){
 const result=await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e)return {visible:false,reason:"missing"};const s=getComputedStyle(e),r=e.getBoundingClientRect();const x=Math.max(0,Math.min(innerWidth-1,r.left+r.width/2)),y=Math.max(0,Math.min(innerHeight-1,r.top+r.height/2));const hit=document.elementFromPoint(x,y);const unobscured=!!hit&&(hit===e||e.contains(hit)||hit.contains(e));return {visible:s.display!=="none"&&s.visibility!=="hidden"&&Number(s.opacity)>0&&r.width>0&&r.height>0&&unobscured,unobscured,hit:hit?.id||hit?.className||hit?.tagName||null,display:s.display,visibility:s.visibility,opacity:s.opacity,rect:{x:r.x,y:r.y,width:r.width,height:r.height},bodyClass:document.body.className,privacyDisplay:getComputedStyle(document.getElementById("alwaha-privacy-notice")||document.body).display,activeModals:[...document.querySelectorAll(".game-modal-overlay,.alwaha-fullscreen-layer")].filter(x=>{const z=getComputedStyle(x),b=x.getBoundingClientRect();return z.display!=="none"&&z.visibility!=="hidden"&&b.width>0&&b.height>0}).map(x=>x.id||x.className)}})()');
 assert.equal(result?.visible,true,label+' must be visible and unobscured at mobile viewport. '+JSON.stringify(result));
 console.log('PASS visible: '+label);
}
async function click(selector,label){
 const result=await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e)return false;e.click();return true;})()');
 assert.equal(result,true,label+' exists and can be clicked.');
 await sleep(180);
 console.log('PASS click: '+label);
}
async function exists(selector,label){
 const result=await evaluate('!!document.querySelector('+JSON.stringify(selector)+')');
 assert.equal(result,true,label+' must exist in the DOM.');
 console.log('PASS exists: '+label);
}
async function section(id,label){
 const actual=await evaluate('document.querySelector(".app-section.active-section")?.id||""');
 assert.equal(actual,id,label+' should navigate to '+id+' (got '+actual+').');
 console.log('PASS navigation: '+label);
}
async function auditActiveControls(label,expectedDuplicateScopes=null){
 const result=await evaluate("(()=>{\n const isVisible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!==\"none\"&&s.visibility!==\"hidden\"&&Number(s.opacity)>0&&r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth;};\n const idMap=new Map();\n for(const e of document.querySelectorAll(\"[id]\")){const id=e.id;if(!id)continue;const nodes=idMap.get(id)||[];nodes.push(e);idMap.set(id,nodes);}\n const duplicateIds=[...idMap].filter(([,nodes])=>nodes.length>1).map(([id,nodes])=>({id,count:nodes.length,visible:nodes.filter(isVisible).length,parents:nodes.map(e=>e.parentElement?.id||e.parentElement?.className||e.parentElement?.tagName||\"unknown\")}));\n const controls=[...document.querySelectorAll(\"button,[role=button],input[type=button],input[type=submit]\")].filter(isVisible);\n const labelOf=e=>String(e.getAttribute(\"aria-label\")||e.getAttribute(\"title\")||e.innerText||e.textContent||e.value||[...e.querySelectorAll(\"img[alt]\")].map(x=>x.alt).join(\" \")||\"\").replace(/\\s+/g,\" \").trim();\n const unnamed=controls.filter(e=>!labelOf(e)).map(e=>({id:e.id||\"\",tag:e.tagName,html:e.outerHTML.slice(0,220)}));\n const implicitSubmit=[...document.querySelectorAll(\"form button:not([type])\")].filter(isVisible).map(e=>({id:e.id||\"\",label:labelOf(e),form:e.form?.id||e.form?.getAttribute(\"name\")||\"unnamed-form\"}));\n const cardSelector='[role=\"article\"],[data-notification-id],[data-post-id],[data-reel-id],[data-product-id],.market-product-card,.alwaha-notification-item';\n const semanticById={endCallBtn:\"call.end\",callCloseBtn:\"call.end\"};\n const normalizeArgs=value=>String(value||\"\").replace(/\\s+/g,\" \").trim();\n const functionMemo=new Map();\n function fingerprintFunction(name,depth=0,seen=new Set()){\n   if(depth>6||seen.has(name))return \"function:\"+name;\n   if(functionMemo.has(name))return functionMemo.get(name);\n   const fn=window[name];\n   if(typeof fn!==\"function\")return \"function:\"+name;\n   const source=Function.prototype.toString.call(fn);\n   const open=source.indexOf(\"{\"),close=source.lastIndexOf(\"}\");\n   const body=open>=0&&close>open?source.slice(open+1,close).trim():\"\";\n   const simpleCall=body.match(/^(?:return\\s+)?(?:window\\.)?([A-Za-z_$][\\w$]*)\\s*\\(([\\s\\S]*)\\)\\s*;?$/);\n   let fingerprint;\n   if(simpleCall&&simpleCall[1]!==name){\n     const next=new Set(seen);next.add(name);\n     fingerprint=\"effect:\"+fingerprintFunction(simpleCall[1],depth+1,next)+\"(\"+normalizeArgs(simpleCall[2])+\")\";\n   }else{\n     const normalized=body.replace(/\\/\\*[\\s\\S]*?\\*\\//g,\" \").replace(/\\/\\/[^\\n]*/g,\" \").replace(/\\s+/g,\" \").trim();\n     fingerprint=\"body:\"+normalized;\n   }\n   functionMemo.set(name,fingerprint);\n   return fingerprint;\n }\n function fingerprintHandlerSource(source){\n   const value=String(source||\"\").trim();\n   let bodyMatch=value.match(/^(?:async\\s+)?function(?:\\s+[A-Za-z_$][\\w$]*)?\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*)\\}\\s*$/);\n   if(!bodyMatch)bodyMatch=value.match(/^(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>\\s*\\{([\\s\\S]*)\\}\\s*$/);\n   let body=bodyMatch?bodyMatch[1].trim():\"\";\n   if(!bodyMatch){\n     const expression=value.match(/^(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>\\s*([\\s\\S]+?)\\s*;?\\s*$/);\n     body=expression?expression[1].trim():value;\n   }\n   const simpleCall=body.match(/^(?:return\\s+)?(?:window\\.)?([A-Za-z_$][\\w$]*)\\s*\\(([\\s\\S]*)\\)\\s*;?$/);\n   if(simpleCall)return \"effect:\"+fingerprintFunction(simpleCall[1])+\"(\"+normalizeArgs(simpleCall[2])+\")\";\n   const normalized=body.replace(/\\/\\*[\\s\\S]*?\\*\\//g,\" \").replace(/\\/\\/[^\\n]*/g,\" \").replace(/\\s+/g,\" \").trim();\n   return \"listener-body:\"+normalized;\n }\n function actionFingerprints(e){\n   const keys=[];\n   const inlineHandler=e.getAttribute(\"onclick\");\n   const propertyHandler=!inlineHandler&&typeof e.onclick===\"function\";\n   const expression=inlineHandler||(propertyHandler?String(e.onclick):\"\");\n   const call=expression.match(/^\\s*(?:return\\s+)?(?:window\\.)?([A-Za-z_$][\\w$]*)\\s*\\(([\\s\\S]*)\\)\\s*;?\\s*$/);\n   if(call)keys.push(\"effect:\"+fingerprintFunction(call[1])+\"(\"+normalizeArgs(call[2])+\")\");\n   else if(expression)keys.push(propertyHandler?fingerprintHandlerSource(expression):\"inline:\"+expression.replace(/\\s+/g,\" \").trim());\n   const listeners=e.__alwahaAuditListeners||[];\n   for(const listener of listeners){if(listener.type===\"click\"&&listener.source)keys.push(fingerprintHandlerSource(listener.source));}\n   const controlledTargets=String(e.getAttribute(\"aria-controls\")||\"\").split(/\\s+/).filter(Boolean).sort();
   const targetContext=controlledTargets.length?\"::targets:\"+controlledTargets.join(\",\"):\"\";
   return [...new Set(keys.map(key=>key+targetContext))];\n }\n const globalGroups=new Map(),cardGroups=new Map();\n for(const e of controls){\n   const card=e.closest(cardSelector);\n   const targetGroups=card?(()=>{if(!cardGroups.has(card))cardGroups.set(card,new Map());return cardGroups.get(card);})():globalGroups;\n   const semantic=semanticById[e.id];\n   const keys=semantic?[semantic]:actionFingerprints(e);\n   for(const key of keys){const nodes=targetGroups.get(key)||[];if(!nodes.includes(e))nodes.push(e);targetGroups.set(key,nodes);}\n }\n const describe=(groups,scope)=>[...groups].filter(([,nodes])=>nodes.length>1).map(([action,nodes])=>({scope,action,count:nodes.length,card:scope===\"card\"?(nodes[0].closest(cardSelector)?.id||nodes[0].closest(cardSelector)?.getAttribute(\"data-product-id\")||nodes[0].closest(cardSelector)?.getAttribute(\"data-post-id\")||nodes[0].closest(cardSelector)?.getAttribute(\"data-reel-id\")||nodes[0].closest(cardSelector)?.className||\"anonymous-card\"):null,buttons:nodes.map(e=>({id:e.id||\"\",label:labelOf(e),parent:e.parentElement?.id||e.parentElement?.className||e.parentElement?.tagName||\"unknown\",handler:e.getAttribute(\"onclick\")||e.id||((e.__alwahaAuditListeners||[]).length?\"addEventListener\":\"listener\")}))}));\n const duplicateActions=[...describe(globalGroups,\"global\"),...[...cardGroups.values()].flatMap(groups=>describe(groups,\"card\"))];\n const directClickListenerCount=controls.reduce((sum,e)=>sum+(e.__alwahaAuditListeners||[]).filter(x=>x.type===\"click\").length,0);\n return {controls:controls.length,directClickListenerCount,duplicateIds,unnamed,implicitSubmit,duplicateActions};\n})()");
 if(expectedDuplicateScopes){
  assert.equal(result.duplicateIds.length,0,label+': probe introduced duplicate DOM IDs');
  assert.equal(result.unnamed.length,0,label+': probe introduced unnamed controls');
  assert.equal(result.implicitSubmit.length,0,label+': probe introduced implicit form submits');
  const actual=result.duplicateActions.map(x=>({scope:x.scope,count:x.count})).sort((a,b)=>a.scope.localeCompare(b.scope));
  const expected=[...expectedDuplicateScopes].sort((a,b)=>a.scope.localeCompare(b.scope));
  assert.deepEqual(actual,expected,label+': direct listener / card-scope duplicate self-test did not detect the expected groups: '+JSON.stringify(result.duplicateActions));
  console.log('PASS control-audit self-test: direct listeners and same-card semantic duplicates detected.');
  return result;
 }
 controlAuditResults.push({label,...result});
 assert.equal(result.duplicateIds.length,0,label+': duplicate live DOM IDs '+JSON.stringify(result.duplicateIds));
 assert.equal(result.unnamed.length,0,label+': visible controls without accessible names '+JSON.stringify(result.unnamed));
 assert.equal(result.implicitSubmit.length,0,label+': visible form buttons must declare type=button or type=submit '+JSON.stringify(result.implicitSubmit));
 assert.equal(result.duplicateActions.length,0,label+': duplicate visible semantic actions '+JSON.stringify(result.duplicateActions));
 console.log('PASS control audit: '+label+' ('+result.controls+' visible controls; '+result.directClickListenerCount+' direct click listeners inspected)');
 return result;
}
try{
 await waitFor(async()=>{try{await getJson('http://127.0.0.1:'+debugPort+'/json/version');return true;}catch{return false;}},'Chrome remote debugging endpoint');
 await connect();
 on('Runtime.exceptionThrown',p=>{
  const d=p.exceptionDetails||{},x=d.exception||{},frames=d.stackTrace?.callFrames||[];
  const stack=frames.map(f=>(f.url||'<inline>')+':'+(Number(f.lineNumber||0)+1)+':'+(Number(f.columnNumber||0)+1)+' '+(f.functionName||'<anonymous>')).join('\n');
  unexpectedErrors.push(JSON.stringify({kind:'exception',text:d.text||'',exception:x.description||x.value||'',url:d.url||'',line:d.lineNumber,column:d.columnNumber,stack}));
 });
 on('Log.entryAdded',p=>{
  const e=p.entry||{};
  if(e.level==='error'&&!/ERR_BLOCKED_BY_CLIENT|Failed to load resource|net::ERR/.test(e.text||'')){
   const frames=e.stackTrace?.callFrames||[];
   unexpectedErrors.push(JSON.stringify({kind:'console',text:e.text||'',url:e.url||'',line:e.lineNumber,stack:frames.map(f=>(f.url||'<inline>')+':'+(Number(f.lineNumber||0)+1)+' '+(f.functionName||'<anonymous>')).join('\n')}));
  }
 });
 await send('Page.enable',{});
 const auditBootstrap = String.raw`(()=>{const registry=new WeakMap();const add=EventTarget.prototype.addEventListener;const remove=EventTarget.prototype.removeEventListener;const watched=new Set(['click']);EventTarget.prototype.addEventListener=function(type,listener,options){if(this instanceof Element&&watched.has(type)&&listener){let list=registry.get(this);if(!list){list=[];registry.set(this,list);}const capture=typeof options==='boolean'?options:!!options?.capture;if(!list.some(x=>x.type===type&&x.listener===listener&&x.capture===capture)){const source=typeof listener==='function'?Function.prototype.toString.call(listener):(typeof listener.handleEvent==='function'?Function.prototype.toString.call(listener.handleEvent):'');list.push({type,listener,capture,source});}}return add.call(this,type,listener,options);};EventTarget.prototype.removeEventListener=function(type,listener,options){if(this instanceof Element&&watched.has(type)){const list=registry.get(this);if(list){const capture=typeof options==='boolean'?options:!!options?.capture;for(let i=list.length-1;i>=0;i--)if(list[i].type===type&&list[i].listener===listener&&list[i].capture===capture)list.splice(i,1);}}return remove.call(this,type,listener,options);};Object.defineProperty(Element.prototype,'__alwahaAuditListeners',{configurable:true,get(){return (registry.get(this)||[]).map(x=>({type:x.type,source:x.source}));}});})();`.replaceAll('`',String.fromCharCode(96));
 await send('Page.addScriptToEvaluateOnNewDocument',{source:auditBootstrap});
 await send('Runtime.enable',{});
 await send('Network.enable',{});
 await send('Network.setBlockedURLs',{urls:['https://*.supabase.co/*','https://*.supabase.in/*','wss://*.supabase.co/*','https://*.googleapis.com/*']});
 await send('Emulation.setDeviceMetricsOverride',{width:412,height:915,deviceScaleFactor:1,mobile:true,screenWidth:412,screenHeight:915});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await send('Page.navigate',{url:'http://127.0.0.1:'+sitePort+'/'});
 await waitFor(()=>evaluate('document.readyState==="complete"&&!!document.querySelector(".bottom-nav-bar .nav-item")'),'Alwaha-Pro DOM and navigation',30000);
 await sleep(1800);
 await evaluate('if(typeof deferAlwahaPrivacyNotice==="function")deferAlwahaPrivacyNotice()');
 const bridgeConsent=await evaluate('({present:!!document.querySelector("#alwaha-mesh-bridge-consent"),yes:!!document.querySelector("#alwaha-mesh-bridge-consent [data-mesh-consent=yes]"),no:!!document.querySelector("#alwaha-mesh-bridge-consent [data-mesh-consent=no]"),later:!!document.querySelector("#alwaha-mesh-bridge-consent [data-mesh-consent=later]")})');
 if(bridgeConsent.present){
  assert.deepEqual(bridgeConsent,{present:true,yes:true,no:true,later:true},'first-run bridge consent must offer accept, decline and defer choices');
  await visible('#alwaha-mesh-bridge-consent [data-mesh-consent=later]','defer bridge participation choice');
  await click('#alwaha-mesh-bridge-consent [data-mesh-consent=later]','defer optional bridge participation during general UI acceptance');
  await waitFor(()=>evaluate('!document.querySelector("#alwaha-mesh-bridge-consent")&&!document.body.classList.contains("modal-active")'),'consent dismissal releases the underlying app UI');
  const deferred=await evaluate('localStorage.getItem("alwaha_mesh_bridge_consent_v1")==="snoozed"&&Number(localStorage.getItem("alwaha_mesh_bridge_remind_at_v1")||0)>Date.now()');
  assert.equal(deferred,true,'defer choice is persisted and reminder is postponed');
 }
 await screenshot('00-startup-after-privacy.png');
 assert.equal(await evaluate('document.querySelectorAll(".bottom-nav-bar .nav-item").length'),7,'Seven primary navigation actions must be present.');
 await visible('.bottom-nav-bar','primary navigation');
 await visible('.nav-item.main-home','home navigation button');
 await visible('#home-post-textarea','home post composer');
 await visible('#home-post-publish-btn','publish post button');
 await visible('.nav-item.notification-nav-item','single persistent notification navigation action');
 assert.equal(await evaluate('document.querySelectorAll("#home-section button[onclick*=toggleInternalNotificationCenter]").length'),0,'Home header must not duplicate the persistent notification navigation button.');
 await auditActiveControls('home');
 await screenshot('01-home.png');
 await click('.nav-item.reels','reels navigation');
 await section('reels-section','reels');
 await visible('#reels-section h2','reels section heading');
 await visible('#reels-section button[onclick*="toggleFloatingAddMenu"]','add reels content button');
 await click('#reels-section button[onclick*="toggleFloatingAddMenu"]','open reels content actions');
 await waitFor(()=>evaluate('getComputedStyle(document.getElementById("floating-options-menu")).display==="flex"'),'reels content action menu');
 await visible('#floating-options-menu','reels content action menu');
 await auditActiveControls('reels add menu');
 assert.equal(await evaluate('document.querySelectorAll("#floating-options-menu button[onclick=\\"toggleFloatingAddMenu(false)\\"]").length'),1,'Reels action menu must expose exactly one standalone close action.');
 await click('#floating-options-menu button[onclick="toggleFloatingAddMenu(false)"]','close reels content action menu');
 await waitFor(()=>evaluate('getComputedStyle(document.getElementById("floating-options-menu")).display==="none"'),'reels content menu closes');
 await auditActiveControls('reels');
 await screenshot('02-reels.png');
 await click('.nav-item.games-nav','games navigation');
 await section('games-section','games');
 await visible('#games-section h2','games section heading');
 await exists('#games-list-container','game list host (may be empty without authenticated rooms)');
 await auditActiveControls('games');
 await screenshot('03-games.png');

 // Notifications use a disposable authenticated identity and a read-only empty response.
 await evaluate(`window.__notifySmoke={requireAuthenticatedUser,supabaseFetch};
 requireAuthenticatedUser=async()=>({id:"ci-notify-user"});
 supabaseFetch=async()=>[];
 true;`);
 await click('.nav-item.notification-nav-item','notifications navigation');
 await waitFor(()=>evaluate('!!document.querySelector("#internal-notification-center.alwaha-notifications-open .alwaha-notification-panel")'),'notification center panel');
 await visible('#internal-notification-center','notification center');
 await visible('#internal-notification-center .alwaha-notification-panel','notification panel');
 await auditActiveControls('notifications');
 assert.equal(await evaluate('document.querySelectorAll(".alwaha-notification-panel button[onclick*=toggleInternalNotificationCenter]").length'),0,'Notification panel close must not reuse the navigation toggle action.');
 assert.equal(await evaluate('document.querySelectorAll(".alwaha-notification-panel button[onclick*=closeInternalNotificationCenter]").length'),1,'Notification panel must expose exactly one explicit close action.');
 await screenshot('04-notifications.png');
 await click('.nav-item.notification-nav-item','close notifications');
 await evaluate('Object.assign(window,{requireAuthenticatedUser:window.__notifySmoke.requireAuthenticatedUser,supabaseFetch:window.__notifySmoke.supabaseFetch});delete window.__notifySmoke');

 await click('.nav-item.market-center','market navigation');
 await section('market-section','market');
 await visible('#market-search-input','market search');
 await visible('#market-conversations-open','market conversations');
 await evaluate('switchMarketSubView("sell")');
 await visible('#market-sell-view','market sell form');
 await visible('#market-submit-product-btn','market publish action');
 await auditActiveControls('market sell');
 await screenshot('06-market-sell.png');
 // Verify both buyer and seller listing tabs with an isolated test identity and fixture data.
 await evaluate(`window.__marketTabSmoke={requireAuthenticatedUser,getCurrentAuthUser,supabaseFetch};
 window.__ciMarketOwner={id:"ci-market-owner"};
 window.__ciMarketProducts=[
   {id:"ci-active-product",seller_id:"ci-market-owner",title:"CI Active Listing",price:"100",category:"اختبار",description:"Active fixture",image_url:"",image_urls:[],status:"active",created_at:new Date().toISOString()},
   {id:"ci-archived-product",seller_id:"ci-market-owner",title:"CI Archived Listing",price:"200",category:"اختبار",description:"Archived fixture",image_url:"",image_urls:[],status:"archived",created_at:new Date().toISOString()},
   {id:"ci-sold-product",seller_id:"ci-market-owner",title:"CI Sold Listing",price:"300",category:"اختبار",description:"Sold fixture",image_url:"",image_urls:[],status:"sold",created_at:new Date().toISOString()}
 ];
 requireAuthenticatedUser=async()=>window.__ciMarketOwner;
 getCurrentAuthUser=async()=>window.__ciMarketOwner;
 supabaseFetch=async url=>{
   const path=String(url);
   if(path.startsWith("products?seller_id=eq.ci-market-owner"))return window.__ciMarketProducts;
   if(path.startsWith("market_transactions?select=id&limit=0"))return [];
   if(path.startsWith("market_conversations?select=id"))return [];
   if(path.startsWith("products?"))return [];
   return [];
 };
 true;`);
 await evaluate('switchMarketSubView("buy")');
 await visible('#market-buy-view','market buyer products tab');
 await visible('#market-search-input','market buyer search');
 await auditActiveControls('market buy');
 await evaluate('switchMarketSubView("my-items")');
 await waitFor(()=>evaluate('document.querySelector("#my-market-items-container")?.textContent.includes("CI Active Listing")&&document.querySelector("#my-market-items-container")?.textContent.includes("CI Archived Listing")&&document.querySelector("#my-market-items-container")?.textContent.includes("CI Sold Listing")'),'market seller listing fixtures and statuses');
 await visible('#market-my-items-view','market seller listings tab');
 await auditActiveControls('market my items');
 const listingActions=await evaluate(`({activeEdit:!!document.querySelector('#my-market-items-container button[onclick*="editMyMarketItem"]'),activeArchive:!!document.querySelector('#my-market-items-container button[onclick*="deleteMyMarketItem"]'),activePromotion:!!document.querySelector('#my-market-items-container button[onclick*="promoteMyProduct"]'),archivedRepublish:!!document.querySelector('#my-market-items-container button[onclick*="reactivateMyProduct"]'),soldNoEdit:!document.querySelector('#my-market-items-container article button[onclick*="editMyMarketItem"]')})`);
 assert.deepEqual(listingActions,{activeEdit:true,activeArchive:true,activePromotion:true,archivedRepublish:true,soldNoEdit:true},'Seller listing actions must match active, archived and sold listing states.');
 await evaluate(`switchMarketSubView("buy");Object.assign(window,{requireAuthenticatedUser:window.__marketTabSmoke.requireAuthenticatedUser,getCurrentAuthUser:window.__marketTabSmoke.getCurrentAuthUser,supabaseFetch:window.__marketTabSmoke.supabaseFetch});delete window.__marketTabSmoke;delete window.__ciMarketOwner;delete window.__ciMarketProducts;`);

 // Buyer/seller transaction lifecycle against a disposable in-memory Supabase mock; no production writes.
 const deliverySetup=await evaluate(`window.__deliverySmoke={requireAuthenticatedUser,getCurrentAuthUser,supabaseFetch,prompt:window.prompt,confirm:window.confirm};
 window.__ciDelivery={user:"ci-buyer",method:"pickup",status:"not_requested",recipient:"",phone:"",address:"",instructions:"",fee:null,provider:null,tracking:null,confirmed:false};
 requireAuthenticatedUser=async()=>({id:window.__ciDelivery.user});
 getCurrentAuthUser=async()=>({id:window.__ciDelivery.user});
 supabaseFetch=async(url,options={})=>{
   const path=String(url);
   if(path==="market_transactions?select=id&limit=0"||path.startsWith("market_conversations?select=")||path.startsWith("market_transactions?select=fulfillment_method"))return [];
   if(path.startsWith("market_conversations?"))return [];
   if(path.startsWith("market_transactions?or="))return [{
     id:"ci-transaction",conversation_id:"ci-conversation",product_id:"ci-product",
     buyer_id:"ci-buyer",seller_id:"ci-seller",status:"active",buyer_confirmed_at:window.__ciDelivery.confirmed?new Date().toISOString():null,
     fulfillment_method:window.__ciDelivery.method,delivery_status:window.__ciDelivery.status,
     delivery_recipient_name:window.__ciDelivery.recipient,delivery_recipient_phone:window.__ciDelivery.phone,
     delivery_address:window.__ciDelivery.address,delivery_instructions:window.__ciDelivery.instructions,
     delivery_fee:window.__ciDelivery.fee,delivery_provider:window.__ciDelivery.provider,tracking_reference:window.__ciDelivery.tracking,
     delivery_updated_at:new Date().toISOString(),delivered_at:window.__ciDelivery.status==="delivered"?new Date().toISOString():null,
     listing_snapshot:{title:"إعلان توصيل تجريبي",price:"100",category:"اختبار",description:"معاملة تجريبية غير محفوظة"},guarantee_days:7,sold_at:new Date().toISOString(),guarantee_expires_at:new Date().toISOString(),retention_until:new Date().toISOString()
   }];
   if(path==="rpc/request_market_delivery"){const body=JSON.parse(options.body);Object.assign(window.__ciDelivery,{method:"delivery",status:"requested",recipient:body.p_recipient_name,phone:body.p_recipient_phone,address:body.p_delivery_address,instructions:body.p_delivery_instructions});return [{id:"ci-transaction"}];}
   if(path==="rpc/update_market_delivery"){const body=JSON.parse(options.body);Object.assign(window.__ciDelivery,{status:body.p_delivery_status,fee:body.p_delivery_fee??window.__ciDelivery.fee,provider:body.p_delivery_provider??window.__ciDelivery.provider,tracking:body.p_tracking_reference??window.__ciDelivery.tracking});return [{id:"ci-transaction"}];}
   if(path.startsWith("market_transactions?id=eq.ci-transaction")&&options.method==="PATCH"){Object.assign(window.__ciDelivery,{confirmed:true,status:"delivered",method:"delivery"});return [{id:"ci-transaction"}];}
   if(path.startsWith("market_transactions?id=eq.ci-transaction"))return [{id:"ci-transaction",buyer_confirmed_at:window.__ciDelivery.confirmed?new Date().toISOString():null,fulfillment_method:window.__ciDelivery.method,delivery_status:window.__ciDelivery.status}];
   return [];
 };
 window.__ciPromptQueue=["مستلم تجريبي","01000000000","عنوان اختبار خاص داخل CI","اتصل عند الوصول","35","توصيل تجريبي","CI-TRACK-988"];
 window.prompt=()=>window.__ciPromptQueue.shift()??"";
 window.confirm=()=>true;
 true;`);
 assert.equal(deliverySetup,true,"disposable delivery mock must be installed");
 await click('#market-conversations-open','market transactions entry');
 await visible('#market-conversations-page','market conversations page');
 await auditActiveControls('market conversations');
 await waitFor(()=>evaluate('!!document.querySelector("#market-transactions-container button[onclick*=requestMarketDelivery]")'),'buyer delivery request action');
 await visible('#market-transactions-container button[onclick*=requestMarketDelivery]','buyer request-delivery action');
 await click('#market-transactions-container button[onclick*=requestMarketDelivery]','buyer request delivery');
 await waitFor(()=>evaluate('document.querySelector("#market-transactions-container")?.textContent.includes("طلب توصيل جديد")'),'buyer delivery request status');
 assert.equal(await evaluate('document.querySelector("#market-products-list-container")?.textContent.includes("عنوان اختبار خاص داخل CI")'),false,"Private delivery address must not leak into public marketplace listing.");
 await screenshot('07-buyer-delivery-request.png');

 await evaluate('window.__ciDelivery.user="ci-seller";renderMarketTransactionsList()');
 await waitFor(()=>evaluate('!!document.querySelector("#market-transactions-container button[onclick*=updateMarketDelivery]")'),'seller delivery acceptance action');
 await visible('#market-transactions-container button[onclick*=updateMarketDelivery]','seller delivery status action');
 await click('#market-transactions-container button[onclick*=updateMarketDelivery]','seller accept delivery');
 await waitFor(()=>evaluate('document.querySelector("#market-transactions-container")?.textContent.includes("وافق البائع على التوصيل")'),'accepted delivery status');
 await click('#market-transactions-container button[onclick*=updateMarketDelivery]','seller start preparation');
 await waitFor(()=>evaluate('document.querySelector("#market-transactions-container")?.textContent.includes("يجري تجهيز الطلب")'),'preparing delivery status');
 await click('#market-transactions-container button[onclick*=updateMarketDelivery]','seller mark shipped');
 await waitFor(()=>evaluate('document.querySelector("#market-transactions-container")?.textContent.includes("تم شحن الطلب")'),'shipped delivery status');
 await click('#market-transactions-container button[onclick*=updateMarketDelivery]','seller mark out for delivery');
 await waitFor(()=>evaluate('document.querySelector("#market-transactions-container")?.textContent.includes("خرج الطلب للتسليم")'),'out-for-delivery status');
 await screenshot('08-seller-delivery-progress.png');

 await evaluate('window.__ciDelivery.user="ci-buyer";renderMarketTransactionsList()');
 await waitFor(()=>evaluate('!!document.querySelector("#market-transactions-container button[onclick*=confirmMarketTransactionReceipt]")'),'buyer delivery receipt action');
 await visible('#market-transactions-container button[onclick*=confirmMarketTransactionReceipt]','buyer confirm delivery receipt');
 await click('#market-transactions-container button[onclick*=confirmMarketTransactionReceipt]','buyer confirm delivery receipt');
 await waitFor(()=>evaluate('document.querySelector("#market-transactions-container")?.textContent.includes("تم تأكيد الاستلام")'),'delivered receipt status');
 await screenshot('09-delivery-received.png');
 await evaluate('closeMarketConversationsPage();Object.assign(window,{requireAuthenticatedUser:window.__deliverySmoke.requireAuthenticatedUser,getCurrentAuthUser:window.__deliverySmoke.getCurrentAuthUser,supabaseFetch:window.__deliverySmoke.supabaseFetch,prompt:window.__deliverySmoke.prompt,confirm:window.__deliverySmoke.confirm});delete window.__deliverySmoke;delete window.__ciDelivery');
 await click('.nav-item.chat','chat navigation');
 await section('chat-section','chat lobby');
 await visible('#chat-main-lobby-wrapper','chat lobby');
 await visible('#chat-main-lobby-wrapper button[onclick*="recent"]','recent conversations entry');
 await visible('#chat-main-lobby-wrapper button[onclick*="all-users"]','user directory entry');
 await exists('#conversations-list','empty recent-conversations list host (height may be zero when no user is signed in)');
 await auditActiveControls('chat lobby');
 await screenshot('03-chat-lobby.png');
 await click('#chat-main-lobby-wrapper button[onclick*="all-users"]','user directory entry');
 await visible('#all-users-tab','user directory view');
 await visible('#chat-search-users-input','user directory search');
 // Open the real direct-chat view function so the user directory is closed and the composer is on top.
 await evaluate(`window.__directSmoke={getCurrentAuthUser,subscribeToDirectMessages};
 getCurrentAuthUser=async()=>null;
 subscribeToDirectMessages=async()=>{};
 true;`);
 await evaluate('openTargetUserDirectChat("صديق تجريبي","","ci-peer")');
 // The active direct-chat overlay uses the same 300ms slide-up/fade-in transition.
 await sleep(400);
 await waitFor(()=>evaluate('getComputedStyle(document.getElementById("active-chat-box")).display!=="none"&&getComputedStyle(document.getElementById("all-users-tab")).display==="none"'),'active direct chat layout');
 await visible('#active-chat-box','active direct chat overlay');
 await visible('#direct-chat-voice-button','direct voice-note button in active chat layout');
 await visible('.alwaha-chat-composer button[aria-label="إرسال صورة أو فيديو"]','direct photo/video action button in active chat layout');
 await auditActiveControls('direct chat');
 const directFile=await evaluate('!!document.querySelector("#direct-chat-media-input")&&document.querySelector("#direct-chat-media-input").type==="file"&&document.querySelector("#direct-chat-media-input").hidden');
 assert.equal(directFile,true,'Direct chat file input must exist but remain hidden behind its visible picker button.');
 await screenshot('05-direct-chat-layout.png');

 // Exercise the one-tap local bridge toggle with a fully isolated native mock.
 // The mock never opens Android settings, starts real radios, or displays a peer/device identity.
 const meshToggleSetup=await evaluate(`window.__meshToggleSaved={
   plugin:window.alwahaLocalNetwork,
   mesh:window.AlwahaLocalMesh,
   pin:window.ensureAlwahaMeshPeerPinned
 };
 localStorage.setItem('alwaha_mesh_bridge_consent_v1','accepted');
 window.__meshMockCalls={permissions:0,capabilities:0,start:0,stop:0,wifiPanel:0};
 let meshRequested=false;
 const meshRadios={wifiEnabled:false,bluetoothEnabled:true};
 window.ensureAlwahaMeshPeerPinned=async()=>true;
 window.AlwahaLocalMesh={
   isRequested:()=>meshRequested,
   setMode:async enabled=>{
     meshRequested=!!enabled;
     window.dispatchEvent(new CustomEvent('alwaha:mesh-mode',{detail:{enabled:false,requested:meshRequested,connectedPeers:0}}));
     return true;
   }
 };
 window.alwahaLocalNetwork={
   requestLocalPermissions:async()=>{window.__meshMockCalls.permissions++;return {granted:true};},
   getCapabilities:async()=>{window.__meshMockCalls.capabilities++;return {nearbyConnectionsSupported:true,permissionsGranted:true,notificationsGranted:true,wifiEnabled:meshRadios.wifiEnabled,bluetoothEnabled:meshRadios.bluetoothEnabled};},
   openWifiPanel:async()=>{window.__meshMockCalls.wifiPanel++;meshRadios.wifiEnabled=true;return {opened:true};},
   startNearbyMesh:async()=>{
     window.__meshMockCalls.start++;
     setTimeout(()=>window.dispatchEvent(new CustomEvent('alwaha:mesh-mode',{detail:{enabled:true,requested:true,connectedPeers:1}})),80);
     return {started:true};
   },
   stopNearbyMesh:async()=>{window.__meshMockCalls.stop++;return {stopped:true};},
   stopDiscovery:async()=>({stopped:true}),
   stopPacketTransport:async()=>({stopped:true})
 };
 true;`);
 assert.equal(meshToggleSetup,true,'one-tap bridge mock must install');
 await visible('#active-chat-box [data-alwaha-mesh-toggle]','one-tap free-network toggle in direct chat');
 await click('#active-chat-box [data-alwaha-mesh-toggle]','enable free local network with one tap');
 await visible('#alwaha-mesh-radio-setup [data-enable-wifi]','Wi-Fi activation button appears when Wi-Fi is the only missing radio');
 assert.equal(await evaluate('!document.querySelector("#alwaha-mesh-radio-setup [data-enable-bt]")'),true,'Bluetooth control must not appear when Bluetooth is already active');
 await click('#alwaha-mesh-radio-setup [data-enable-wifi]','open Android Wi-Fi settings panel for missing radio');
 await click('#alwaha-mesh-radio-setup [data-radio-retry]','continue after enabling the missing radio');
 await waitFor(()=>evaluate('document.querySelector("#active-chat-box [data-alwaha-mesh-toggle]")?.getAttribute("aria-pressed")==="true"&&document.querySelector("#active-chat-box [data-alwaha-mesh-toggle]")?.style.color==="rgb(168, 255, 215)"'),'green state only after a mocked verified local peer connects');
 await screenshot('06-one-tap-network-active.png');
 const meshStarted=await evaluate('window.__meshMockCalls');
 assert.deepEqual(meshStarted,{permissions:1,capabilities:2,start:1,stop:0,wifiPanel:1},'one tap requests permissions, offers only the missing radio and starts Nearby exactly once');
 const hiddenBridgeUi=await evaluate('({legacyDialog:!!document.querySelector("#alwaha-local-discovery-modal"),ownFingerprint:!!document.querySelector("#alwaha-mesh-own-code"),pairControls:document.querySelectorAll("[data-pair-peer],[data-copy-identity]").length,peerLists:document.querySelectorAll("#alwaha-local-peers,[data-local-peer-row]").length})');
 assert.deepEqual(hiddenBridgeUi,{legacyDialog:false,ownFingerprint:false,pairControls:0,peerLists:0},'no bridge device identity, alias, fingerprint or peer list is rendered');
 await click('#active-chat-box [data-alwaha-mesh-toggle]','disable free local network with one tap');
 await waitFor(()=>evaluate('document.querySelector("#active-chat-box [data-alwaha-mesh-toggle]")?.getAttribute("aria-pressed")==="false"&&document.querySelector("#active-chat-box [data-alwaha-mesh-toggle]")?.style.color===""'),'second tap stops the bridge');
 const meshStopped=await evaluate('window.__meshMockCalls');
 assert.deepEqual(meshStopped,{permissions:1,capabilities:2,start:1,stop:1,wifiPanel:1},'second tap stops Nearby without additional radio actions');
 await evaluate(`localStorage.removeItem('alwaha_mesh_bridge_consent_v1');
 const saved=window.__meshToggleSaved;
 window.alwahaLocalNetwork=saved.plugin;
 window.AlwahaLocalMesh=saved.mesh;
 if(saved.pin)window.ensureAlwahaMeshPeerPinned=saved.pin;else delete window.ensureAlwahaMeshPeerPinned;
 delete window.__meshToggleSaved;delete window.__meshMockCalls;`);

 await evaluate('closeActiveChatWindow();Object.assign(window,{getCurrentAuthUser:window.__directSmoke.getCurrentAuthUser,subscribeToDirectMessages:window.__directSmoke.subscribeToDirectMessages});delete window.__directSmoke');
  // The old discovery/pairing UI must not be rendered anywhere in the user-facing app.
 const noLegacyBridgeUi=await evaluate('!document.querySelector("#alwaha-local-discovery-modal")&&!document.querySelector("#alwaha-mesh-own-code")&&!document.querySelector("[data-pair-peer]")&&!document.querySelector("[data-copy-identity]")');
 assert.equal(noLegacyBridgeUi,true,'legacy peer list, bridge ID and manual pairing UI must remain absent');
 await evaluate(`window.__uiSmokeSaved={requireAuthenticatedUser, getCurrentAuthUser, supabaseFetch, loadMarketMessages, subscribeToMarketConversation};
 requireAuthenticatedUser=async()=>({id:"ci-buyer"});
 getCurrentAuthUser=async()=>({id:"ci-buyer"});
 supabaseFetch=async()=>[{id:"ci-conversation",buyer_id:"ci-buyer",seller_id:"ci-seller",archived_at:null}];
 loadMarketMessages=async()=>{};
 subscribeToMarketConversation=async()=>{};
 true;`);
 await evaluate('openMarketConversationChat("ci-conversation","عنصر تجريبي","ci-seller")');
 await visible('#market-chat-modal','market chat full-screen conversation');
 await visible('#market-chat-modal [data-alwaha-mesh-toggle]','one-tap free-network toggle in marketplace chat');
 await visible('#market-chat-voice-button','market voice-note button in active chat layout');
 await visible('#market-chat-modal button[aria-label="إرسال صورة أو فيديو للبائع"]','market photo/video action button in active chat layout');
 const marketFile=await evaluate('!!document.querySelector("#market-chat-media-input")&&document.querySelector("#market-chat-media-input").type==="file"&&document.querySelector("#market-chat-media-input").hidden');
 assert.equal(marketFile,true,'Market chat file input must exist behind its visible picker button.');
 await visible('#market-chat-modal button[aria-label="اتصال صوتي بطرف محادثة السوق"]','market seller call action button');
 await auditActiveControls('market chat');
 await screenshot('05-market-chat-layout.png');
 await evaluate('closeMarketConversationChat();Object.assign(window,{requireAuthenticatedUser:window.__uiSmokeSaved.requireAuthenticatedUser,getCurrentAuthUser:window.__uiSmokeSaved.getCurrentAuthUser,supabaseFetch:window.__uiSmokeSaved.supabaseFetch,loadMarketMessages:window.__uiSmokeSaved.loadMarketMessages,subscribeToMarketConversation:window.__uiSmokeSaved.subscribeToMarketConversation});delete window.__uiSmokeSaved;');
 await click('.nav-item.profile-me','profile navigation');
 await section('profile-section','profile');
 await evaluate('document.querySelector("#alwaha-device-suite-menu-button")?.scrollIntoView({block:"center",behavior:"instant"})');
 await sleep(160);
 await visible('#alwaha-device-suite-menu-button','feature/test dashboard entry after scrolling it into the visible profile viewport');
 await click('[onclick*="sub-prof-settings"]','profile settings');
 await visible('.alwaha-theme-grid','theme picker');
 await auditActiveControls('profile settings');
 await screenshot('06-themes.png');
 const baseThemes=await evaluate('document.querySelectorAll(".alwaha-theme-choice").length');
 assert.ok(baseThemes>=3,'The three baseline theme choices must be present.');
 assert.equal(await evaluate('window.registerAlwahaTheme({id:"ci-visual-smoke",name:"فحص مرئي CI",emoji:"🧪",description:"مظهر مؤقت لفحص الواجهة"})'),true,'A valid new theme must be registered.');
 await visible('[data-theme-choice="ci-visual-smoke"]','newly registered theme button');
 await click('[data-theme-choice="ci-visual-smoke"]','new theme selection');
 assert.equal(await evaluate('document.body.dataset.alwahaTheme==="ci-visual-smoke"'),true,'A registered theme must apply.');
 await screenshot('07-new-theme.png');

 // Exercise every profile subpage in isolation, including the authentication and recovery forms.
 const profileSubViews=[
   'sub-prof-register','sub-prof-login','sub-prof-settings','sub-prof-device-suite',
   'sub-prof-recovery','sub-prof-password-change','sub-prof-password-reset',
   'sub-prof-privacy','sub-prof-verify'
 ];
 for(const profileViewId of profileSubViews){
   await evaluate(`openSubProfileView(${JSON.stringify(profileViewId)})`);
   await sleep(400); // Allow the shared 300 ms subview entrance animation to finish before hit-testing.
   await visible('#'+profileViewId,'profile subview '+profileViewId);
   await auditActiveControls('profile subview '+profileViewId);
   const closeCount=await evaluate(`document.querySelectorAll('#'+${JSON.stringify(profileViewId)}+' button[onclick*="closeSubProfileView"]').length`);
   assert.equal(closeCount,1,profileViewId+' must expose exactly one close action.');
   await click('#'+profileViewId+' button[onclick*="closeSubProfileView"]','close profile subview '+profileViewId);
   await waitFor(()=>evaluate(`getComputedStyle(document.getElementById(${JSON.stringify(profileViewId)})).display==="none"`),'close profile subview '+profileViewId);
 }
 await evaluate('document.querySelectorAll(".sub-profile-view-box").forEach(e=>e.style.display="none");document.body.classList.remove("modal-active");showAlwahaPrivacyNotice()');
 await visible('#alwaha-privacy-notice','privacy notice');
 await auditActiveControls('privacy notice');
 await screenshot('08-privacy.png');
 await click('#alwaha-privacy-notice button[onclick="deferAlwahaPrivacyNotice()"]','privacy notice close');
 await evaluate('openVideoCallModeChooser()');
 await visible('#alwaha-video-call-choice','video mode chooser');
 await visible('[data-video-call-mode="normal"]','normal video mode');
 await visible('[data-video-call-mode="kids"]','Kids video mode');
 await auditActiveControls('video mode chooser');
 await screenshot('09-video-chooser.png');
 await click('[data-video-call-cancel]','video chooser close');
 await evaluate('activeCallManager={mediaType:"video"};setCallModal(true);updateCallUi("connected",{target:"CI preview",text:"واجهة مكالمة تجريبية",indicator:"فحص مرئي دون اتصال"})');
 // The real call modal has a 300 ms slide-up/fade-in animation.
 await sleep(400);
 await visible('#voice-call-modal','call modal after its entrance animation');
 await visible('#muteBtn','mute button in connected call');
 await visible('#cameraMuteBtn','camera mute in connected video call');
 await visible('#cameraSwitchBtn','camera switch in connected video call');
 await visible('#kidsModeBtn','Kids Room in connected video call');
 await visible('#endCallBtn','end call in connected call');
 assert.equal(await evaluate('document.getElementById("callCloseBtn")?.style.display'),'none','Call end and close controls must not appear together while connected.');
 await auditActiveControls('connected video call');
 await screenshot('10-call-controls.png');
 await evaluate('updateCallUi("idle")');
 await visible('#callCloseBtn','close call view while idle');
 await evaluate('setCallModal(false);activeCallManager=null');

 await evaluate(`window.__alwahaAuditProbeCore=function(value){return value;};
 window.__alwahaAuditProbeAliasOne=function(value){return window.__alwahaAuditProbeCore(value);};
 window.__alwahaAuditProbeAliasTwo=function(value){return window.__alwahaAuditProbeCore(value);};
 const host=document.createElement('div');host.id='__alwaha-audit-probe-host';host.style.cssText='position:fixed;left:1px;top:1px;z-index:2147483647;display:block;';
 const globalOne=document.createElement('button');globalOne.type='button';globalOne.setAttribute('aria-label','audit probe global action one');globalOne.textContent='probe one';globalOne.addEventListener('click',function(){return window.__alwahaAuditProbeAliasOne('global');});
 const globalTwo=document.createElement('button');globalTwo.type='button';globalTwo.setAttribute('aria-label','audit probe global action two');globalTwo.textContent='probe two';globalTwo.addEventListener('click',()=>window.__alwahaAuditProbeAliasTwo('global'));
 const targetOne=document.createElement('button');targetOne.type='button';targetOne.setAttribute('aria-label','audit probe independent target one');targetOne.setAttribute('aria-controls','probe-input-one');targetOne.addEventListener('click',function(){return window.__alwahaAuditProbeAliasOne('separate-target');});
 const targetTwo=document.createElement('button');targetTwo.type='button';targetTwo.setAttribute('aria-label','audit probe independent target two');targetTwo.setAttribute('aria-controls','probe-input-two');targetTwo.addEventListener('click',()=>window.__alwahaAuditProbeAliasTwo('separate-target'));
 const sameTargetOne=document.createElement('button');sameTargetOne.type='button';sameTargetOne.setAttribute('aria-label','audit probe same target one');sameTargetOne.setAttribute('aria-controls','probe-input-shared');sameTargetOne.addEventListener('click',function(){return window.__alwahaAuditProbeAliasOne('same-target');});
 const sameTargetTwo=document.createElement('button');sameTargetTwo.type='button';sameTargetTwo.setAttribute('aria-label','audit probe same target two');sameTargetTwo.setAttribute('aria-controls','probe-input-shared');sameTargetTwo.addEventListener('click',()=>window.__alwahaAuditProbeAliasTwo('same-target'));
 const card=document.createElement('article');card.id='__alwaha-audit-probe-card';card.setAttribute('role','article');card.style.cssText='display:block;position:fixed;left:10px;top:10px;width:20px;height:20px;';
 const cardOne=document.createElement('button');cardOne.type='button';cardOne.setAttribute('aria-label','audit probe card action one');cardOne.textContent='card one';cardOne.addEventListener('click',function(){return window.__alwahaAuditProbeAliasOne('card');});
 const cardTwo=document.createElement('button');cardTwo.type='button';cardTwo.setAttribute('aria-label','audit probe card action two');cardTwo.textContent='card two';cardTwo.addEventListener('click',event=>window.__alwahaAuditProbeAliasTwo('card'));
 card.append(cardOne,cardTwo);host.append(globalOne,globalTwo,targetOne,targetTwo,sameTargetOne,sameTargetTwo,card);document.body.append(host);`);
 await auditActiveControls('direct-listener-and-card-dedupe-self-test',[{scope:'card',count:2},{scope:'global',count:2},{scope:'global',count:2}]);
 await evaluate(`document.getElementById('__alwaha-audit-probe-host')?.remove();
 delete window.__alwahaAuditProbeCore;delete window.__alwahaAuditProbeAliasOne;delete window.__alwahaAuditProbeAliasTwo;`);
 if(unexpectedErrors.length)throw new Error('Unexpected browser JavaScript errors:\n'+unexpectedErrors.join('\n'));
 fs.writeFileSync(path.join(outputDir,'CONTROL-AUDIT.json'),JSON.stringify(controlAuditResults,null,2)+'\n');
 fs.writeFileSync(path.join(outputDir,'RESULT.txt'),[
  'ALWAHA_BROWSER_VISUAL_ACCEPTANCE=PASS',
  'Viewport: 412x915 CSS pixels, touch emulation enabled.',
  'Backend: Supabase domains blocked; no login credentials and no production writes.',
  'Tested with topmost-pixel visibility and actual hit-test: all seven primary sections, notification center, home, market sell, chat lobby, direct/market chat views, profile settings, dynamic theme registry, privacy notice, video chooser and connected-call controls.',
  'Dynamic control audit checks duplicate live IDs, duplicate semantic actions globally and within each card, accessible names, implicit form submits and direct click listeners; a synthetic self-test verifies listener coverage. See CONTROL-AUDIT.json.',
  'Home notifications use one persistent navigation action; call-end and call-close actions are mutually exclusive.',
  'Application APK-sharing UI and native export method are removed; post and reel sharing remain.',
  'Tested with isolated in-memory mock backend: buyer delivery request, seller accept/prepare/ship/out-for-delivery transitions, buyer receipt confirmation, and private delivery address exclusion from public listing.',
  'Tested UI only with isolated native plugin mock: local discovery, Bluetooth receiver, Wi-Fi Direct group action, Android settings shortcuts and identity display.',
  'Direct and marketplace messaging, call media, delivery and notifications used mock accounts/responses only; no real authenticated production writes were sent.',
  'Not tested: real Bluetooth/Wi-Fi Direct radios or packet transport, real camera/microphone capture, real WebRTC media, or two physical Android phones.'
 ].join('\n')+'\n');
 console.log('BROWSER_VISUAL_ACCEPTANCE=PASS');
}catch(error){
 fs.writeFileSync(path.join(outputDir,'FAILURE.txt'),String(error?.stack||error)+'\n');
 throw error;
}finally{
 try{ws?.close();}catch{}
 try{chrome.kill('SIGTERM');}catch{}
 try{server.close();}catch{}
 try{fs.rmSync(profile,{recursive:true,force:true});}catch{}
}
