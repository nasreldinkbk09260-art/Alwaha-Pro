import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('function bindCallControls() {');
const end=html.indexOf('\n        async function openProfessionalCameraView()',start);
assert.ok(start>=0&&end>start,'bindCallControls source block must be present and bounded');
assert.ok(html.includes("safeStartup('call-controls', bindCallControls)"),'call controls must be bound during guarded DOM startup');
assert.ok(html.includes("window.addEventListener('DOMContentLoaded'"),'call-control binding must run after DOM readiness');

const source=html.slice(start,end);
const calls={start:[],accept:0,decline:0,mute:0,end:0,toasts:[]};
let muted=false;
const nodes={
  startCallBtn:{onclick:null},
  acceptCallBtn:{onclick:null},
  declineCallBtn:{onclick:null},
  muteBtn:{onclick:null,innerHTML:''},
  endCallBtn:{onclick:null}
};
const context={
  document:{getElementById(id){return nodes[id]||null;}},
  initiateVoiceCall:async mode=>{calls.start.push(mode);},
  acceptIncomingCall:async()=>{calls.accept++;},
  rejectIncomingCall:async()=>{calls.decline++;},
  activeCallManager:{call:{toggleMute(){muted=!muted;calls.mute++;return muted;}}},
  triggerToastNotification:(message,kind)=>calls.toasts.push({message,kind}),
  terminateVoiceCall:async()=>{calls.end++;}
};
vm.createContext(context);
vm.runInContext(source+'\nthis.bindCallControls=bindCallControls;',context,{filename:'index.html:bindCallControls'});
context.bindCallControls();

for(const id of ['startCallBtn','acceptCallBtn','declineCallBtn','muteBtn','endCallBtn']){
  assert.equal(typeof nodes[id].onclick,'function',id+' must receive a click handler');
}
await nodes.startCallBtn.onclick();
assert.deepEqual(calls.start,['online'],'start call button must request the normal online call path');
await nodes.acceptCallBtn.onclick();
assert.equal(calls.accept,1,'accept button invokes acceptIncomingCall exactly once');
await nodes.declineCallBtn.onclick();
assert.equal(calls.decline,1,'decline button invokes rejectIncomingCall exactly once');
await nodes.muteBtn.onclick();
assert.equal(muted,true,'first mute press toggles the microphone to muted');
assert.match(nodes.muteBtn.innerHTML,/إلغاء الكتم/,'muted button label offers unmute');
assert.deepEqual(calls.toasts.at(-1),{message:'تم كتم الميكروفون.',kind:'info'});
await nodes.muteBtn.onclick();
assert.equal(muted,false,'second mute press restores the microphone');
assert.match(nodes.muteBtn.innerHTML,/كتم الصوت/,'unmuted button label offers mute');
assert.deepEqual(calls.toasts.at(-1),{message:'تم تشغيل الميكروفون.',kind:'info'});
assert.equal(calls.mute,2,'mute action is performed once per press');
await nodes.endCallBtn.onclick();
assert.equal(calls.end,1,'end button invokes terminateVoiceCall exactly once');

console.log('CALL_CONTROLS_RUNTIME=PASS (DOM-ready binding, start, accept, decline, mute/unmute and end action mapping)');
