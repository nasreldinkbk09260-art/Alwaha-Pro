import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync('alwaha-call-feedback.js','utf8'),listeners=new Map(),intervals=new Map(),storage=new Map();
let nextId=1,started=0;
class FakeAudioContext{
 constructor(){this.state='running';this.currentTime=1;this.destination={};}
 resume(){this.state='running';return Promise.resolve();}
 createGain(){return{gain:{value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
 createOscillator(){return{frequency:{setValueAtTime(){}},connect(){},disconnect(){},start(){started++;},stop(){},type:'sine'};}
}
const sandbox={window:{AudioContext:FakeAudioContext},document:{addEventListener(t,f,o){listeners.set(t,{f,o});}},console,Promise,Set,Map,Number,Math,Object,Array,String,localStorage:{getItem(k){return storage.get(k)||null;}},setTimeout,clearTimeout,setInterval(f,ms){const id=nextId++;intervals.set(id,{f,ms});return id;},clearInterval(id){intervals.delete(id);}};
vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:'alwaha-call-feedback.js'});
const api=sandbox.window.AlwahaCallFeedback;
assert.ok(api);assert.ok(listeners.has('pointerdown')&&listeners.has('touchstart')&&listeners.has('keydown'));
assert.equal(await api.prime(),true);
assert.equal(api.start('ringback'),true);assert.equal(api.diagnostics().activeKind,'ringback');assert.equal(intervals.size,1);
assert.equal(api.start('busy'),true);assert.equal(api.diagnostics().activeKind,'busy');assert.equal(intervals.size,1);
api.stop();assert.equal(intervals.size,0);
assert.equal(api.play('connected'),true);await new Promise(r=>setTimeout(r,200));assert.ok(started>=2);
for(const kind of ['declined','no-answer','unavailable','failed','ended'])assert.equal(api.play(kind),true);
storage.set('alwaha_audio_muted','true');assert.equal(api.start('ringback'),false);assert.equal(api.play('connected'),false);assert.equal(intervals.size,0);api.stop();
console.log('CALL_FEEDBACK_RUNTIME_AUDIT=PASS');
