/* Alwaha-Pro local call progress and outcome tones. */
(() => {
 'use strict';
 const REPEATING={ringback:{period:4000,duration:.95,frequencies:[440,480],volume:.022},busy:{period:1000,duration:.43,frequencies:[480,620],volume:.024}};
 const ONE_SHOTS={
  connected:[{delay:0,duration:.12,frequencies:[660],volume:.026},{delay:145,duration:.18,frequencies:[880],volume:.026}],
  declined:[{delay:0,duration:.18,frequencies:[540],volume:.024},{delay:230,duration:.24,frequencies:[360],volume:.022}],
  'no-answer':[{delay:0,duration:.14,frequencies:[490],volume:.022},{delay:210,duration:.14,frequencies:[390],volume:.021},{delay:420,duration:.25,frequencies:[300],volume:.020}],
  busy:[{delay:0,duration:.32,frequencies:[480,620],volume:.024},{delay:430,duration:.32,frequencies:[480,620],volume:.024}],
  unavailable:[{delay:0,duration:.12,frequencies:[520],volume:.021},{delay:170,duration:.12,frequencies:[420],volume:.021},{delay:340,duration:.22,frequencies:[320],volume:.020}],
  failed:[{delay:0,duration:.20,frequencies:[390],volume:.022},{delay:260,duration:.20,frequencies:[300],volume:.020}],
  ended:[{delay:0,duration:.13,frequencies:[520],volume:.018},{delay:170,duration:.18,frequencies:[390],volume:.018}]
 };
 let context=null,repeatTimer=null,scheduled=new Set(),activeKind=null;
 function isMuted(){try{return localStorage.getItem('alwaha_audio_muted')==='true';}catch(_){return false;}}
 function getContext(){
  
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
  try{if(!context||context.state==='closed')context=new C();if(context.state==='suspended')context.resume().catch(()=>{});return context;}
  catch(error){console.debug('[Alwaha Call Feedback] Audio unavailable:',error);return null;}
 }
 function prime(){const ctx=getContext();if(!ctx)return Promise.resolve(false);try{return Promise.resolve(ctx.resume?.()).then(()=>true).catch(()=>false);}catch(_){return Promise.resolve(false);}}
 function tone(freqs,duration,volume){
   if(isMuted())return false;
  const ctx=getContext();if(!ctx||!Array.isArray(freqs)||!freqs.length)return false;
  try{
   const start=ctx.currentTime+.02,master=ctx.createGain();master.gain.value=1;master.connect(ctx.destination);
   for(const frequency of freqs){
    const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';
    osc.frequency.setValueAtTime(Math.max(180,Math.min(1200,Number(frequency)||440)),start);
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.001,Number(volume)||.02),start+.018);
    gain.gain.exponentialRampToValueAtTime(.0001,start+Math.max(.06,duration));
    osc.connect(gain);gain.connect(master);osc.start(start);osc.stop(start+Math.max(.06,duration)+.02);
    osc.onended=()=>{try{osc.disconnect();gain.disconnect();}catch(_){}};
   }return true;
  }catch(error){console.debug('[Alwaha Call Feedback] Tone playback failed:',error);return false;}
 }
 function clearScheduled(){for(const id of scheduled)clearTimeout(id);scheduled.clear();}
 function stop(){if(repeatTimer!==null)clearInterval(repeatTimer);repeatTimer=null;clearScheduled();activeKind=null;}
 function sequence(steps){if(!Array.isArray(steps))return false;let ok=false;for(const step of steps){const id=setTimeout(()=>{scheduled.delete(id);tone(step.frequencies,step.duration,step.volume);},Math.max(0,Number(step.delay)||0));scheduled.add(id);ok=true;}return ok;}
 function start(kind='ringback'){stop();const p=REPEATING[kind];if(!p||isMuted())return false;activeKind=kind;tone(p.frequencies,p.duration,p.volume);repeatTimer=setInterval(()=>{if(activeKind===kind&&!isMuted())tone(p.frequencies,p.duration,p.volume);},p.period);return true;}
 function play(kind){stop();if(isMuted())return false;const steps=ONE_SHOTS[kind];if(!steps)return false;activeKind=kind;return sequence(steps);}
 const unlock=()=>{void prime();};
 document.addEventListener('pointerdown',unlock,{once:true,capture:true,passive:true});
 document.addEventListener('touchstart',unlock,{once:true,capture:true,passive:true});
 document.addEventListener('keydown',unlock,{once:true,capture:true});
 window.AlwahaCallFeedback=Object.freeze({prime,start,stop,play,diagnostics:()=>({activeKind,repeating:repeatTimer!==null,contextState:context?.state||'unavailable'})});
})();
