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
 const result=await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&Number(s.opacity)>0&&r.width>0&&r.height>0;})()');
 assert.equal(result,true,label+' must be visible at mobile viewport.');
 console.log('PASS visible: '+label);
}
async function click(selector,label){
 const result=await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e)return false;e.click();return true;})()');
 assert.equal(result,true,label+' exists and can be clicked.');
 await sleep(180);
 console.log('PASS click: '+label);
}
async function section(id,label){
 const actual=await evaluate('document.querySelector(".app-section.active-section")?.id||""');
 assert.equal(actual,id,label+' should navigate to '+id+' (got '+actual+').');
 console.log('PASS navigation: '+label);
}
try{
 await waitFor(async()=>{try{await getJson('http://127.0.0.1:'+debugPort+'/json/version');return true;}catch{return false;}},'Chrome remote debugging endpoint');
 await connect();
 on('Runtime.exceptionThrown',p=>unexpectedErrors.push(p.exceptionDetails?.text||'JavaScript exception'));
 on('Log.entryAdded',p=>{const e=p.entry;if(e?.level==='error'&&!/ERR_BLOCKED_BY_CLIENT|Failed to load resource|net::ERR/.test(e.text||''))unexpectedErrors.push(e.text);});
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
 await visible('#conversations-list','conversation list host');
 await screenshot('03-chat-lobby.png');
 await evaluate('expandChatSubWindow("all-users")');
 await visible('#all-users-tab','user directory view');
 await evaluate('document.getElementById("active-chat-box").style.display="flex"');
 await visible('#direct-chat-voice-button','direct voice-note button in active chat layout');
 await visible('#direct-chat-media-input','direct photo/video input in active chat layout');
 await screenshot('04-direct-chat-layout.png');
 await evaluate('document.getElementById("active-chat-box").style.display="none"');
 await evaluate('document.getElementById("market-chat-modal").style.display="flex"');
 await visible('#market-chat-voice-button','market voice-note button in active chat layout');
 await visible('#market-chat-media-input','market photo/video input in active chat layout');
 await screenshot('05-market-chat-layout.png');
 await evaluate('document.getElementById("market-chat-modal").style.display="none"');
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
 await visible('#voice-call-modal','call modal');
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
  'Not tested: Bluetooth/Wi-Fi Direct radios, real camera/microphone capture, authenticated buyer/seller transactions, actual WebRTC media, or two physical Android phones.'
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
