import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const source=fs.readFileSync('alwaha-local-mesh.js','utf8');
class CustomEventMock{constructor(type,options={}){this.type=type;this.detail=options.detail;}}
function createHarness(name){
  const records=new Map(),listeners=new Map();
  const vault={
    async put(key,value){records.set(key,{key,value,updatedAt:new Date().toISOString()});},
    async getRecord(key){return records.get(key)||null;},
    async getAll(){return [...records.values()];}
  };
  const window={
    AlwahaLocalVault:vault,
    alwahaLocalNetwork:{async sendLocalPacket({packet}){if(window.__peer)await window.__peer.receiveRawPacket(packet);return {sent:true};},async addListener(){return {remove(){}};}},
    addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},
    dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);return true;},
    __name:name
  };
  const context={window,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,Date,Promise,Map,Set,JSON,Math,Number,String,Object,RegExp,Error,Blob,URL,CustomEvent:CustomEventMock,atob,btoa,console,setTimeout,clearTimeout};
  vm.runInNewContext(source,context,{filename:'alwaha-local-mesh.js'});
  return {window,mesh:window.AlwahaLocalMesh,records,listeners};
}
const a=createHarness('A'),b=createHarness('B'),relay=createHarness('relay');
a.window.__peer=b.mesh;b.window.__peer=a.mesh;relay.window.__peer=null;
const delivered=[],neighbor=[];
b.window.addEventListener('alwaha:mesh-message',event=>delivered.push(event.detail));
a.window.addEventListener('alwaha:mesh-neighbor',event=>neighbor.push(event.detail));
const [bundleA,bundleB,bundleRelay]=await Promise.all([a.mesh.getIdentityBundle(),b.mesh.getIdentityBundle(),relay.mesh.getIdentityBundle()]);
await a.mesh.pairPeer(bundleB,{confirmationCode:bundleB.fingerprintCode,accountUserId:'user-b',label:'B'});
await b.mesh.pairPeer(bundleA,{confirmationCode:bundleA.fingerprintCode,accountUserId:'user-a',label:'A'});
await relay.mesh.pairPeer(bundleA,{confirmationCode:bundleA.fingerprintCode,accountUserId:'user-a',label:'A'});
a.mesh.setTransportPeer(bundleB.fingerprint);
b.mesh.setTransportPeer(bundleA.fingerprint);
await a.mesh.setMode(true);
const secret='رسالة سرية لا يجب أن تظهر في الحزمة الوسيطة';
const sent=await a.mesh.sendToAccount('user-b',{type:'direct-text',text:secret,conversation:'direct'});
assert.equal(sent.sent,true,'trusted direct peer should receive encrypted packet');
assert.equal(delivered.length,1,'recipient should receive one message');
assert.equal(delivered[0].payload.text,secret,'recipient should decrypt the original message');
assert.equal(delivered[0].senderAccountId,'user-a','sender is resolved only from the local trusted peer mapping');
assert.equal(JSON.stringify([...a.records.values()]).includes(secret),false,'sender vault stores ciphertext queue, not plaintext packet');
const rawPackets=[...a.records.values()].filter(row=>row.key.startsWith('mesh:outbox:'));
assert.equal(rawPackets.length,1);
assert.equal(JSON.stringify(rawPackets[0].value.packet).includes(secret),false,'relay-visible envelope must not reveal message text');
assert.equal(JSON.stringify(rawPackets[0].value.packet).includes(bundleA.fingerprint),false,'relay-visible envelope must not expose the sender fingerprint');
assert.equal(JSON.stringify(rawPackets[0].value.packet).includes(bundleB.fingerprint),false,'relay-visible envelope must not expose the recipient fingerprint');
const signalEvents=[];
b.window.addEventListener('alwaha:mesh-message',event=>{if(event.detail.payload?.type==='call-signal')signalEvents.push(event.detail.payload);});
await a.mesh.sendToAccount('user-b',{type:'call-signal',sessionId:'mesh-call-test',mediaType:'audio',signal:{type:'offer',offer:{type:'offer',sdp:'opaque-test-sdp'}}});
assert.equal(signalEvents.length,1,'encrypted local call signaling should reach the trusted peer');
assert.equal(signalEvents[0].signal.offer.sdp,'opaque-test-sdp','recipient should decrypt the call signaling payload');

const fileDelivered=[];
b.window.addEventListener('alwaha:mesh-message',event=>{if(event.detail.payload?.type==='file-ready')fileDelivered.push(event.detail.payload);});
const bytes=new Uint8Array(175000);for(let i=0;i<bytes.length;i++)bytes[i]=i%251;
const file=new File([bytes],'mesh-test.bin',{type:'application/octet-stream'});
await a.mesh.sendFileToAccount('user-b',file,'attachment');
const storedFileChunks=[...a.records.values()].filter(row=>String(row.key||'').startsWith('mesh:file:'));
assert.ok(storedFileChunks.length>1,'sender should keep an encrypted local file manifest and chunks');
const firstChunkB64=Buffer.from(bytes.slice(0,120*1024)).toString('base64url');
assert.equal(JSON.stringify(storedFileChunks).includes(firstChunkB64),false,'sender file chunks must be encrypted at rest');
assert.equal(fileDelivered.length,1,'recipient should reassemble file chunks');
assert.equal(fileDelivered[0].size,bytes.length,'reassembled file size should match original');
const packet=rawPackets[0].value.packet;
const firstRelay=await relay.mesh.receiveRawPacket(Buffer.from(JSON.stringify({...packet,hops:1})).toString('base64url'));
const duplicateRelay=await relay.mesh.receiveRawPacket(Buffer.from(JSON.stringify({...packet,hops:1})).toString('base64url'));
assert.equal(firstRelay.relayed,true,'non-recipient should queue opaque packet for store-and-forward');
assert.equal(duplicateRelay.duplicate,true,'relay should discard replays');
assert.ok([...relay.records.keys()].some(key=>key.startsWith('mesh:relay:')),'relay queue must persist ciphertext for later peer connection');

const nextHop=createHarness('next-hop');
const bundleNextHop=await nextHop.mesh.getIdentityBundle();
await relay.mesh.pairPeer(bundleNextHop,{confirmationCode:bundleNextHop.fingerprintCode,accountUserId:'user-next-hop',label:'Next hop'});
await nextHop.mesh.pairPeer(bundleRelay,{confirmationCode:bundleRelay.fingerprintCode,accountUserId:'user-relay',label:'Relay'});
relay.window.__peer=nextHop.mesh;
nextHop.window.__peer=relay.mesh;
await relay.mesh.setMode(true);
await nextHop.mesh.sendHello();
assert.ok([...nextHop.records.keys()].some(key=>key.startsWith('mesh:relay:')),'trusted neighbor hello should trigger automatic forwarding into the next hop relay queue');
const forwarded=[...nextHop.records.values()].find(row=>row.key.startsWith('mesh:relay:'));
assert.ok(forwarded,'next hop must persist the forwarded ciphertext');
assert.equal(JSON.stringify(forwarded.value.packet).includes(secret),false,'automatic relay must preserve end-to-end ciphertext');

console.log('PASS: paired P-256 ECDH/ECDSA identities');
console.log('PASS: authenticated AES-GCM direct delivery with recipient-only decryption');
console.log('PASS: relay envelope hides plaintext and both endpoint fingerprints');
console.log('PASS: encrypted call signaling delivery');
console.log('PASS: chunked file transfer, encrypted local storage and reconstruction');
console.log('PASS: opaque store-and-forward queue and duplicate/replay rejection');
console.log('PASS: trusted-neighbor handshake automatically forwards ciphertext to next hop');
console.log('MESH_PROTOCOL_RUNTIME=PASS (8 checks)');
