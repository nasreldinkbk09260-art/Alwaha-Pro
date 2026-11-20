import fs from 'node:fs';
import path from 'node:path';

const outputDir=path.resolve('assets/sounds');
fs.mkdirSync(outputDir,{recursive:true});

function renderBell({name,rootHz,durationMs,volume,partials}) {
  const sampleRate=44100,frames=Math.round(sampleRate*durationMs/1000),channels=1,bits=16;
  const dataBytes=frames*channels*(bits/8),buffer=Buffer.alloc(44+dataBytes);
  buffer.write('RIFF',0);buffer.writeUInt32LE(36+dataBytes,4);buffer.write('WAVE',8);
  buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);
  buffer.writeUInt16LE(channels,22);buffer.writeUInt32LE(sampleRate,24);
  buffer.writeUInt32LE(sampleRate*channels*(bits/8),28);buffer.writeUInt16LE(channels*(bits/8),32);
  buffer.writeUInt16LE(bits,34);buffer.write('data',36);buffer.writeUInt32LE(dataBytes,40);
  for(let i=0;i<frames;i++){
    const t=i/sampleRate,progress=i/frames;
    const attack=Math.min(1,t/.012);
    const decay=Math.exp(-t/(durationMs/1000*.30));
    const release=progress>.88?Math.max(0,(1-progress)/.12):1;
    const envelope=attack*decay*release;
    let sample=0;
    for(const partial of partials){
      const hz=rootHz*partial.multiplier;
      sample+=Math.sin(2*Math.PI*hz*t)*partial.weight;
    }
    sample=Math.max(-1,Math.min(1,sample*envelope*volume));
    buffer.writeInt16LE(Math.round(sample*32767),44+i*2);
  }
  fs.writeFileSync(path.join(outputDir,name),buffer);
  console.log('Generated original notification tone:',name,buffer.length,'bytes');
}

renderBell({
  name:'message_chime.wav',rootHz:880,durationMs:560,volume:.76,
  partials:[{multiplier:1,weight:.68},{multiplier:2,weight:.24},{multiplier:3,weight:.08}]
});
renderBell({
  name:'notification_chime.wav',rootHz:740,durationMs:780,volume:.72,
  partials:[{multiplier:1,weight:.70},{multiplier:2,weight:.22},{multiplier:3,weight:.08}]
});
