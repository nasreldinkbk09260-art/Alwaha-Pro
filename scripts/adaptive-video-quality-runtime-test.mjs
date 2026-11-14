import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('class VoiceCall {');
const end = html.indexOf('class CallSignalingManager {', start);
assert.ok(start >= 0 && end > start, 'VoiceCall source block is found');
const source = html.slice(start, end).trim();

let intervalId = 40;
const intervals = new Map();
const cleared = [];
const indicators = [];
const context = {
  console: { debug(){}, info(){}, warn(){}, error(){} },
  window: {},
  document: { getElementById(id) { return id === 'call-method-indicator' ? { set textContent(value){ indicators.push(value); } } : null; } },
  Date,
  setInterval(fn, ms) { const id=++intervalId; intervals.set(id,{fn,ms}); return id; },
  clearInterval(id) { cleared.push(id); intervals.delete(id); }
};
vm.createContext(context);
vm.runInContext(source + '\nthis.VoiceCall = VoiceCall;', context, { filename: 'index.html:VoiceCall' });

function makeStats({lost,received,fractionLost,rtt,candidateRtt,omitInbound=false,omitCandidate=false}={}) {
  const rows = [];
  rows.push({id:'out-video',type:'outbound-rtp',kind:'video',packetsSent:1000});
  if (!omitInbound) {
    const inbound = {id:'remote-video-1',type:'remote-inbound-rtp',kind:'video'};
    if (lost !== undefined) inbound.packetsLost=lost;
    if (received !== undefined) inbound.packetsReceived=received;
    if (fractionLost !== undefined) inbound.fractionLost=fractionLost;
    if (rtt !== undefined) inbound.roundTripTime=rtt;
    rows.push(inbound);
  }
  if (!omitCandidate && candidateRtt !== undefined) {
    rows.push({id:'candidate-pair-1',type:'candidate-pair',state:'succeeded',nominated:true,currentRoundTripTime:candidateRtt});
  }
  return new Map(rows.map(row=>[row.id,row]));
}
function makeCall() {
  const parameterWrites=[];
  const constraintWrites=[];
  const videoTrack={kind:'video',applyConstraints:async value=>constraintWrites.push(value),stop(){}};
  const sender={
    track:videoTrack,
    getParameters:()=>({encodings:[{}]}),
    setParameters:async value=>parameterWrites.push(value)
  };
  const call = new context.VoiceCall({
    signaling:{send:async()=>{}},
    localAudioEl:null,remoteAudioEl:null,localVideoEl:null,remoteVideoEl:null,
    mediaType:'video'
  });
  let nextStats=makeStats({lost:0,received:1000,rtt:0.1,candidateRtt:0.1});
  const pc={
    connectionState:'connected',
    getStats:async()=>nextStats,
    getSenders:()=>[sender],
    close(){this.closed=true;}
  };
  call.peerConnection=pc;
  call.localStream={getVideoTracks:()=>[videoTrack],getTracks:()=>[videoTrack]};
  call.setStats=value=>{nextStats=value;};
  call.parameterWrites=parameterWrites;
  call.constraintWrites=constraintWrites;
  return call;
}

const call=makeCall();
call.startAdaptiveVideoQuality();
await call.adaptiveQualityCheck();
assert.equal(call.qualityTier,'balanced','first cumulative counters sample is baseline only; it cannot promote to high');
assert.equal(context.window.__alwahaVideoQuality.lossKnown,false,'first counter sample does not invent a packet-loss percentage');
assert.equal(call.parameterWrites.length,0,'baseline sample does not rewrite encoder parameters');

call.setStats(makeStats({lost:50,received:1050,rtt:0.6,candidateRtt:0.6}));
await call.adaptiveQualityCheck();
assert.equal(call.qualityTier,'low','large packet-loss delta and RTT degrade video to low tier');
assert.equal(call.parameterWrites.at(-1).encodings[0].maxBitrate,220000,'low tier limits video bitrate');
assert.equal(call.constraintWrites.at(-1).width.ideal,320,'low tier reduces camera capture width');

call.setStats(makeStats({lost:50,received:2050,rtt:0.1,candidateRtt:0.1}));
await call.adaptiveQualityCheck();
assert.equal(call.qualityTier,'balanced','first healthy interval recovers only to balanced');
call.setStats(makeStats({lost:50,received:3050,rtt:0.1,candidateRtt:0.1}));
await call.adaptiveQualityCheck();
assert.equal(call.qualityTier,'balanced','second healthy interval still cannot promote to high');
call.setStats(makeStats({lost:50,received:4050,rtt:0.1,candidateRtt:0.1}));
await call.adaptiveQualityCheck();
assert.equal(call.qualityTier,'high','three healthy delta-based samples promote video to high tier');
assert.equal(call.parameterWrites.at(-1).encodings[0].maxBitrate,850000,'high tier applies the expected encoder bitrate');

call.setStats(makeStats({omitInbound:true,omitCandidate:true}));
await call.adaptiveQualityCheck();
assert.equal(call.qualityTier,'high','missing stats preserve the current tier and are not treated as zero loss/zero RTT');
assert.equal(context.window.__alwahaVideoQuality.tier,'high','missing stats do not publish a false healthy sample');

const noFeedback=makeCall();
noFeedback.setStats(makeStats({omitInbound:true,omitCandidate:true}));
noFeedback.startAdaptiveVideoQuality();
await noFeedback.adaptiveQualityCheck();
assert.equal(noFeedback.qualityTier,'balanced','a call with no network feedback cannot promote above balanced');
assert.equal(noFeedback.parameterWrites.length,0,'missing feedback causes no encoder promotion');

const candidateFallback=makeCall();
candidateFallback.setStats(makeStats({omitInbound:true,candidateRtt:0.7}));
candidateFallback.startAdaptiveVideoQuality();
await candidateFallback.adaptiveQualityCheck();
assert.equal(candidateFallback.qualityTier,'low','selected ICE candidate-pair RTT is used when remote-inbound RTT is unavailable');

const fractionLoss=makeCall();
fractionLoss.setStats(makeStats({fractionLost:0.12,rtt:0.3,candidateRtt:0.3}));
fractionLoss.startAdaptiveVideoQuality();
await fractionLoss.adaptiveQualityCheck();
assert.equal(fractionLoss.qualityTier,'low','fractionLost from remote-inbound stats is honored directly');

const timerId=call.qualityTimer;
call.endCall(false);
assert.ok(cleared.includes(timerId),'ending a call clears the adaptive quality interval');
assert.equal(call.qualityTimer,null,'ended call has no active quality interval');
assert.equal(call.adaptiveQualityCheck,null,'ended call drops the quality sampler reference');

noFeedback.endCall(false);
candidateFallback.endCall(false);
fractionLoss.endCall(false);
console.log('ADAPTIVE_VIDEO_QUALITY_RUNTIME=PASS (delta packet loss, fractionLost, ICE RTT fallback, conservative missing-stats handling, tier hysteresis and timer cleanup)');
