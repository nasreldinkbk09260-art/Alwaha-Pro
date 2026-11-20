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
const pending=new Map(),handlers=new Map(),unexpectedErrors=[];
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
 const result=await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e)return {visible:false,reason:"missing"};const s=getComputedStyle(e),r=e.getBoundingClientRect();return {visible:s.display!=="none"&&s.visibility!=="hidden"&&Number(s.opacity)>0&&r.width>0&&r.height>0,display:s.display,visibility:s.visibility,opacity:s.opacity,rect:{x:r.x,y:r.y,width:r.width,height:r.height},bodyClass:document.body.className,privacyDisplay:getComputedStyle(document.getElementById("alwaha-privacy-notice")||document.body).display,activeModals:[...document.querySelectorAll(".game-modal-overlay,.alwaha-fullscreen-layer")].filter(x=>{const z=getComputedStyle(x),b=x.getBoundingClientRect();return z.display!=="none"&&z.visibility!=="hidden"&&b.width>0&&b.height>0}).map(x=>x.id||x.className)}})()');
 assert.equal(result?.visible,true,label+' must be visible at mobile viewport. '+JSON.stringify(result));
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
 await send('Runtime.enable',{});
 await send('Network.enable',{});
 await send('Network.setBlockedURLs',{urls:['https://*.supabase.co/*','https://*.supabase.in/*','wss://*.supabase.co/*','https://*.googleapis.com/*']});
 await send('Emulation.setDeviceMetricsOverride',{width:412,height:915,deviceScaleFactor:1,mobile:true,screenWidth:412,screenHeight:915});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await send('Page.navigate',{url:'http://127.0.0.1:'+sitePort+'/'});
 await waitFor(()=>evaluate('document.readyState==="complete"&&!!document.querySelector(".bottom-nav-bar .nav-item")'),'Alwaha-Pro DOM and navigation',30000);
 await sleep(1800);
 await evaluate('if(typeof deferAlwahaPrivacyNotice==="function")deferAlwahaPrivacyNotice()');
 await screenshot('00-startup-after-privacy.png');
 assert.equal(await evaluate('document.querySelectorAll(".bottom-nav-bar .nav-item").length'),7,'Seven primary navigation actions must be present.');
 await visible('.bottom-nav-bar','primary navigation');
 await visible('.nav-item.main-home','home navigation button');
 await visible('#home-post-textarea','home post composer');
 await visible('#home-post-publish-btn','publish post button');
 await screenshot('01-home.png');
 await click('.nav-item.market-center','market navigation');
 await section('market-section','market');
 await visible('#market-search-input','market search');
 await visible('#market-conversations-open','market conversations');
 await evaluate('switchMarketSubView("sell")');
 await visible('#market-sell-view','market sell form');
 await visible('#market-submit-product-btn','market publish action');
 await screenshot('02-market-sell.png');
 await evaluate('switchMarketSubView("buy")');
 await click('.nav-item.chat','chat navigation');
 await section('chat-section','chat lobby');
 await visible('#chat-main-lobby-wrapper','chat lobby');
 await visible('#chat-main-lobby-wrapper button[onclick*="recent"]','recent conversations entry');
 await visible('#chat-main-lobby-wrapper button[onclick*="all-users"]','user directory entry');
 await exists('#conversations-list','empty recent-conversations list host (height may be zero when no user is signed in)');
 await screenshot('03-chat-lobby.png');
 await click('#chat-main-lobby-wrapper button[onclick*="all-users"]','user directory entry');
 await visible('#all-users-tab','user directory view');
 await visible('#chat-search-users-input','user directory search');
 await evaluate('document.getElementById("active-chat-box").style.display="flex"');
 await visible('#direct-chat-voice-button','direct voice-note button in active chat layout');
 await visible('.alwaha-chat-composer button[aria-label="إرسال صورة أو فيديو"]','direct photo/video action button in active chat layout');
 const directFile=await evaluate('!!document.querySelector("#direct-chat-media-input")&&document.querySelector("#direct-chat-media-input").type==="file"&&document.querySelector("#direct-chat-media-input").hidden');
 assert.equal(directFile,true,'Direct chat file input must exist but remain hidden behind its visible picker button.');
 await screenshot('04-direct-chat-layout.png');
 await evaluate('document.getElementById("active-chat-box").style.display="none"');
 // Isolated native bridge mock: exercise the actual discovery modal and its button handlers without touching Android radios.
 const networkMockSetup=await evaluate(`window.__uiNetworkSaved={requireAuthenticatedUser:requireAuthenticatedUser,plugin:window.alwahaLocalNetwork,mesh:window.AlwahaLocalMesh};
 requireAuthenticatedUser=async()=>({id:"ci-buyer"});
 const listeners={};
 window.alwahaLocalNetwork={
   addListener:async(name,callback)=>{listeners[name]=callback;return {remove:async()=>delete listeners[name]};},
   startDiscovery:async()=>({started:true,message:"بحث تجريبي جاهز"}),
   stopDiscovery:async()=>({stopped:true}),
   startBluetoothPacketServer:async()=>({listening:true}),
   createWifiDirectGroup:async()=>({started:true,message:"مجموعة Wi-Fi Direct تجريبية"}),
   openInternetSettings:async()=>({opened:true}),
   openBluetoothSettings:async()=>({opened:true}),
   getCapabilities:async()=>({wifiDirectSupported:true,wifiEnabled:true,bluetoothEnabled:true}),
   connectBluetoothPeer:async()=>({connected:true}),
   connectWifiDirectPeer:async()=>({started:true}),
   startPacketTransport:async()=>({connected:true})
 };
 window.AlwahaLocalMesh={
   getIdentityBundle:async()=>({fingerprintCode:"ABC123",fingerprint:"ci-fingerprint",publicKey:"ci-public-key"}),
   pairPeer:async()=>({fingerprint:"ci-fingerprint"}),
   flushRelayQueue:async()=>({sent:2})
 };
 true;`);
 assert.equal(networkMockSetup,true,"isolated native bridge mock must be installed");
 await evaluate('openAlwahaLocalDiscovery()');
 await visible('#alwaha-local-discovery-modal','local network discovery dialog');
 for(const [selector,label] of [
   ['[data-start-local]','search nearby devices'],
   ['[data-stop-local]','stop discovery'],
   ['[data-create-group]','create Wi-Fi Direct group'],
   ['[data-bluetooth-server]','start Bluetooth RFCOMM receiver'],
   ['[data-open-internet-settings]','open Android Wi-Fi/mobile data settings'],
   ['[data-open-bluetooth-settings]','open Android Bluetooth settings'],
   ['[data-copy-identity]','copy public device identity'],
   ['[data-pair-peer]','pair/verify another device'],
   ['[data-flush-relay]','flush encrypted relay queue']
 ]) await visible('#alwaha-local-discovery-modal '+selector,label);
 const fingerprint=await evaluate('document.getElementById("alwaha-mesh-own-code").textContent');
 assert.equal(fingerprint,"ABC123","network dialog must render the device fingerprint code");
 await screenshot('06-local-network-controls.png');
 await click('#alwaha-local-discovery-modal [data-bluetooth-server]','mock Bluetooth receiver action');
 assert.ok((await evaluate('document.getElementById("alwaha-local-status").textContent')).includes('بدأ استقبال Bluetooth'),"Bluetooth receiver action must update the status");
 await click('#alwaha-local-discovery-modal [data-open-internet-settings]','mock Internet settings action');
 await click('#alwaha-local-discovery-modal [data-open-bluetooth-settings]','mock Bluetooth settings action');
 await click('#alwaha-local-discovery-modal [data-create-group]','mock Wi-Fi Direct group action');
 await click('#alwaha-local-discovery-modal [data-stop-local]','mock stop-discovery action');
 await evaluate('document.querySelector("#alwaha-local-discovery-modal [data-close-local]").click()');
 await evaluate('Object.assign(window,{requireAuthenticatedUser:window.__uiNetworkSaved.requireAuthenticatedUser,alwahaLocalNetwork:window.__uiNetworkSaved.plugin,AlwahaLocalMesh:window.__uiNetworkSaved.mesh});delete window.__uiNetworkSaved');

 await evaluate(`window.__uiSmokeSaved={requireAuthenticatedUser, getCurrentAuthUser, supabaseFetch, loadMarketMessages, subscribeToMarketConversation};
 requireAuthenticatedUser=async()=>({id:"ci-buyer"});
 getCurrentAuthUser=async()=>({id:"ci-buyer"});
 supabaseFetch=async()=>[{id:"ci-conversation",buyer_id:"ci-buyer",seller_id:"ci-seller",archived_at:null}];
 loadMarketMessages=async()=>{};
 subscribeToMarketConversation=async()=>{};
 true;`);
 await evaluate('openMarketConversationChat("ci-conversation","عنصر تجريبي","ci-seller")');
 await visible('#market-chat-modal','market chat full-screen conversation');
 await visible('#market-chat-voice-button','market voice-note button in active chat layout');
 await visible('#market-chat-modal button[aria-label="إرسال صورة أو فيديو للبائع"]','market photo/video action button in active chat layout');
 const marketFile=await evaluate('!!document.querySelector("#market-chat-media-input")&&document.querySelector("#market-chat-media-input").type==="file"&&document.querySelector("#market-chat-media-input").hidden');
 assert.equal(marketFile,true,'Market chat file input must exist behind its visible picker button.');
 await visible('#market-chat-modal button[aria-label="اتصال صوتي بطرف محادثة السوق"]','market seller call action button');
 await screenshot('05-market-chat-layout.png');
 await evaluate('closeMarketConversationChat();Object.assign(window,{requireAuthenticatedUser:window.__uiSmokeSaved.requireAuthenticatedUser,getCurrentAuthUser:window.__uiSmokeSaved.getCurrentAuthUser,supabaseFetch:window.__uiSmokeSaved.supabaseFetch,loadMarketMessages:window.__uiSmokeSaved.loadMarketMessages,subscribeToMarketConversation:window.__uiSmokeSaved.subscribeToMarketConversation});delete window.__uiSmokeSaved;');
 await click('.nav-item.profile-me','profile navigation');
 await section('profile-section','profile');
 await visible('#alwaha-device-suite-menu-button','feature/test dashboard entry');
 await click('[onclick*="sub-prof-settings"]','profile settings');
 await visible('.alwaha-theme-grid','theme picker');
 await screenshot('06-themes.png');
 const baseThemes=await evaluate('document.querySelectorAll(".alwaha-theme-choice").length');
 assert.ok(baseThemes>=3,'The three baseline theme choices must be present.');
 assert.equal(await evaluate('window.registerAlwahaTheme({id:"ci-visual-smoke",name:"فحص مرئي CI",emoji:"🧪",description:"مظهر مؤقت لفحص الواجهة"})'),true,'A valid new theme must be registered.');
 await visible('[data-theme-choice="ci-visual-smoke"]','newly registered theme button');
 await click('[data-theme-choice="ci-visual-smoke"]','new theme selection');
 assert.equal(await evaluate('document.body.dataset.alwahaTheme==="ci-visual-smoke"'),true,'A registered theme must apply.');
 await screenshot('07-new-theme.png');
 await evaluate('document.querySelectorAll(".sub-profile-view-box").forEach(e=>e.style.display="none");document.body.classList.remove("modal-active");showAlwahaPrivacyNotice()');
 await visible('#alwaha-privacy-notice','privacy notice');
 await screenshot('08-privacy.png');
 await click('#alwaha-privacy-notice button[onclick="deferAlwahaPrivacyNotice()"]','privacy notice close');
 await evaluate('openVideoCallModeChooser()');
 await visible('#alwaha-video-call-choice','video mode chooser');
 await visible('[data-video-call-mode="normal"]','normal video mode');
 await visible('[data-video-call-mode="kids"]','Kids video mode');
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
 await screenshot('10-call-controls.png');
 await evaluate('updateCallUi("idle");setCallModal(false);activeCallManager=null');
 if(unexpectedErrors.length)throw new Error('Unexpected browser JavaScript errors:\n'+unexpectedErrors.join('\n'));
 fs.writeFileSync(path.join(outputDir,'RESULT.txt'),[
  'ALWAHA_BROWSER_VISUAL_ACCEPTANCE=PASS',
  'Viewport: 412x915 CSS pixels, touch emulation enabled.',
  'Backend: Supabase domains blocked; no login credentials and no production writes.',
  'Tested: home, market sell/buy navigation, chat lobby, direct/market chat composer layout, profile settings, theme registration, privacy dialog, video mode chooser, connected-call control layout.',
  'Context note: direct/market composer layouts and connected-call controls were rendered through their real UI state functions; no actual account messaging/call was initiated.',
  'Tested UI only with an isolated native plugin mock: local-network discovery, Bluetooth receiver, Wi-Fi Direct group action, system settings controls and identity display.',
  'Not tested: real Bluetooth/Wi-Fi Direct radios or packet transport, real camera/microphone capture, authenticated buyer/seller writes, actual WebRTC media, or two physical Android phones.'
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
