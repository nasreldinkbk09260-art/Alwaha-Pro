import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('class CallSignalingManager {');
const marker='\n        }\n\n        async function startAlwahaCall';
const close=html.indexOf(marker,start);
assert.ok(start>=0&&close>start,'CallSignalingManager source block is found');
const classSource=html.slice(start,close+'\n        }'.length);
const sent=[],topics=[],removed=[],tones=[],ui=[];
const context={
  supabaseClient:{},
  sanitizeChannelPart:value=>String(value).replace(/[^A-Za-z0-9_-]/g,'_'),
  console,
  currentChatUser:'المتصل المتوقع',
  window:{AlwahaCallFeedback:{play(kind){tones.push(kind);}}},
  updateCallUi:(state,meta)=>ui.push({state,meta}),
  setCallModal:open=>ui.push({modal:open})
};
vm.createContext(context);
vm.runInContext(classSource+'\nthis.CallSignalingManager=CallSignalingManager;',context,{filename:'index.html:CallSignalingManager'});
const manager=new context.CallSignalingManager();
manager.myId='recipient-1';manager.peerId='peer-2';manager.sessionId='session-1';
manager.client={
  channel(topic,options){topics.push({topic,options});return {send:async payload=>{sent.push(payload);return 'ok';}};},
  removeChannel:async channel=>{removed.push(channel);}
};
manager.subscribeChannel=async()=>{};

await manager.sendCallResult('peer-2','market-session','busy','market');
assert.equal(topics[0].topic,'market-call-inbox-peer-2','market result uses the market inbox topic');
assert.equal(sent[0].event,'webrtc-market-call-result','market result uses its own broadcast event');
assert.equal(sent[0].payload.mode,'market','market mode is preserved in payload');
assert.equal(sent[0].payload.status,'busy','market busy outcome is preserved');

await manager.sendCallResult('peer-2','friend-session','declined');
assert.equal(topics[1].topic,'call-inbox-peer-2','friend result stays on friend inbox');
assert.equal(sent[1].event,'webrtc-call-result','friend result uses friend broadcast event');
assert.equal(sent[1].payload.mode,'online','friend result mode is explicit');
assert.equal(removed.length,2,'temporary result channels are always removed');

let ended=0;
manager.end=async notify=>{ended++;assert.equal(notify,false);};
await manager.handleIncomingCallResult({to:'someone-else',from:'peer-2',sessionId:'session-1',status:'busy'});
await manager.handleIncomingCallResult({to:'recipient-1',from:'spoofed-peer',sessionId:'session-1',status:'busy'});
await manager.handleIncomingCallResult({to:'recipient-1',from:'peer-2',sessionId:'stale-session',status:'busy'});
assert.equal(ended,0,'wrong recipient, peer and stale session results are ignored');
await manager.handleIncomingCallResult({to:'recipient-1',from:'peer-2',sessionId:'session-1',status:'busy',mode:'market'});
assert.equal(ended,1,'valid expected peer result ends the pending outgoing call');
assert.equal(ui.filter(x=>x.state==='idle').length,1,'valid result displays the terminal state');
assert.ok(ui.some(x=>x.meta?.text==='الطرف مشغول حالياً.'),'busy state displays the correct Arabic message');
assert.equal(tones.at(-1),'busy','busy state plays its distinct tone');

console.log('CALL_SIGNALING_RUNTIME_AUDIT=PASS (market/friend routing, payload mode, cleanup, recipient/peer/session validation and busy UI state)');