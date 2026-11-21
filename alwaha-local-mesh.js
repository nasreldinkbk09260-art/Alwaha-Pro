(() => {
  'use strict';
  const VERSION=1, PREFIX='ALWAHA_MESH_V1', MAX_PACKET_BYTES=262144, MAX_HOPS=12;
  const MAX_AGE_MS=72*60*60*1000, ROUTE_DAYS=3, FILE_CHUNK_BYTES=120*1024;
  const enc=new TextEncoder(), dec=new TextDecoder();
  let identityPromise=null, transportHandles=[], transportPeerFingerprint='', transportType='', modeEnabled=false;
  let transportGeneration=0, receiveQueue=Promise.resolve(), pendingReceiveCount=0;
  const transportEndpoints=new Map(), inboundTraffic=new Map();
  const MAX_PENDING_RECEIVE=256;
  const queued=new Map(), seen=new Map(), peers=new Map(), fileUrls=new Map();

  function vault(){return window.AlwahaLocalVault;}
  function bytesToB64(bytes){let raw='';for(let i=0;i<bytes.length;i+=0x8000)raw+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  function b64ToBytes(value){const raw=atob(String(value||'').replace(/-/g,'+').replace(/_/g,'/'));const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
  async function sha(bytes){return new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));}
  function hex(bytes){return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');}
  function utcDay(date=Date.now()){return new Date(date).toISOString().slice(0,10);}
  async function deriveRouteHmacKey(privateKey,publicKey){
    const shared=await crypto.subtle.deriveBits({name:'ECDH',public:publicKey},privateKey,256);
    const material=await crypto.subtle.importKey('raw',shared,'HKDF',false,['deriveKey']);
    return crypto.subtle.deriveKey(
      {name:'HKDF',hash:'SHA-256',salt:enc.encode('AlwahaMeshRouteSaltV1'),info:enc.encode('AlwahaMeshRouteHmacV1')},
      material,{name:'HMAC',hash:'SHA-256',length:256},false,['sign']
    );
  }
  async function routeTokensForPair(privateKey,publicKey,now=Date.now()){
    const routeKey=await deriveRouteHmacKey(privateKey,publicKey),values=[];
    for(let shift=-1;shift<ROUTE_DAYS;shift++){
      const d=new Date(now);d.setUTCDate(d.getUTCDate()+shift);
      const digest=await crypto.subtle.sign('HMAC',routeKey,enc.encode('AlwahaMeshRouteV1|'+utcDay(d)));
      values.push(bytesToB64(new Uint8Array(digest)));
    }
    return values;
  }
  async function fingerprintFor(ecdhPublicKey,signingPublicKey){
    const material=new Uint8Array(b64ToBytes(ecdhPublicKey).length+b64ToBytes(signingPublicKey).length);
    material.set(b64ToBytes(ecdhPublicKey),0);material.set(b64ToBytes(signingPublicKey),b64ToBytes(ecdhPublicKey).length);
    return hex(await sha(material));
  }
  async function generatePair(algorithm,usages){
    // Public keys remain exportable; private keys are stored non-extractable in IndexedDB.
    const pair=await crypto.subtle.generateKey(algorithm,false,usages);
    return {privateKey:pair.privateKey,publicKey:pair.publicKey};
  }
  async function getIdentity(){
    if(identityPromise)return identityPromise;
    identityPromise=(async()=>{
      if(!crypto?.subtle||!vault()?.getRecord||!vault()?.put)throw new Error('Secure WebCrypto or the local vault is unavailable.');
      const row=await vault().getRecord('mesh:identity-v1');
      if(row?.value?.ecdh?.privateKey&&row?.value?.signing?.privateKey)return row.value;
      const [ecdh,signing]=await Promise.all([
        generatePair({name:'ECDH',namedCurve:'P-256'},['deriveBits']),
        generatePair({name:'ECDSA',namedCurve:'P-256'},['sign'])
      ]);
      const [ecdhRaw,signingRaw]=await Promise.all([
        crypto.subtle.exportKey('raw',ecdh.publicKey),
        crypto.subtle.exportKey('raw',signing.publicKey)
      ]);
      const ecdhPublicKey=bytesToB64(new Uint8Array(ecdhRaw)),signingPublicKey=bytesToB64(new Uint8Array(signingRaw));
      const fingerprint=await fingerprintFor(ecdhPublicKey,signingPublicKey);
      const identity={version:VERSION,ecdh,signing,ecdhPublicKey,signingPublicKey,fingerprint,createdAt:new Date().toISOString()};
      await vault().put('mesh:identity-v1',identity);
      return identity;
    })().catch(error=>{identityPromise=null;throw error;});
    return identityPromise;
  }
  async function getIdentityBundle(){
    const id=await getIdentity();
    return {protocol:PREFIX,version:VERSION,ecdhPublicKey:id.ecdhPublicKey,signingPublicKey:id.signingPublicKey,fingerprint:id.fingerprint,fingerprintCode:id.fingerprint.slice(-6).toUpperCase()};
  }
  async function validateBundle(bundle){
    if(!bundle||bundle.protocol!==PREFIX||bundle.version!==VERSION||typeof bundle.ecdhPublicKey!=='string'||typeof bundle.signingPublicKey!=='string')throw new Error('صيغة هوية الجهاز غير صحيحة.');
    const fingerprint=await fingerprintFor(bundle.ecdhPublicKey,bundle.signingPublicKey);
    if(fingerprint!==bundle.fingerprint)throw new Error('بصمة هوية الجهاز لا تطابق مفاتيحه؛ رفضنا الاقتران.');
    await crypto.subtle.importKey('raw',b64ToBytes(bundle.ecdhPublicKey),{name:'ECDH',namedCurve:'P-256'},false,[]);
    await crypto.subtle.importKey('raw',b64ToBytes(bundle.signingPublicKey),{name:'ECDSA',namedCurve:'P-256'},false,[]);
    return fingerprint;
  }
  async function pairPeer(bundle,{confirmationCode,accountUserId='',label='جهاز موثوق'}={}){
    const fingerprint=await validateBundle(bundle),expected=fingerprint.slice(-6).toUpperCase();
    if(String(confirmationCode||'').trim().toUpperCase()!==expected)throw new Error('رمز التحقق لا يطابق بصمة الجهاز الآخر.');
    const own=await getIdentity();if(fingerprint===own.fingerprint)throw new Error('لا يمكن اقتران الجهاز بنفسه.');
    const record={...bundle,fingerprint,accountUserId:String(accountUserId||''),label:String(label||'جهاز موثوق').slice(0,80),pairedAt:new Date().toISOString(),trusted:true};
    await vault().put('mesh:peer:'+fingerprint,record);peers.set(fingerprint,record);
    window.dispatchEvent(new CustomEvent('alwaha:mesh-peer-paired',{detail:{fingerprint,label:record.label}}));
    await sendHello();await flushRelayQueue();
    return {fingerprint,code:expected};
  }
  async function getTrustedPeers(){
    const rows=await vault().getAll(),out=[];
    for(const row of rows||[])if(typeof row.key==='string'&&row.key.startsWith('mesh:peer:')&&row.value?.trusted){peers.set(row.value.fingerprint,row.value);out.push(row.value);}
    return out;
  }
  async function getPeerByAccountId(accountUserId){
    const all=await getTrustedPeers();return all.find(peer=>peer.accountUserId&&peer.accountUserId===String(accountUserId))||null;
  }
  async function importEcdhPublic(b64){return crypto.subtle.importKey('raw',b64ToBytes(b64),{name:'ECDH',namedCurve:'P-256'},false,[]);}
  async function deriveAesKey(privateKey,publicKey,salt,context){
    const shared=await crypto.subtle.deriveBits({name:'ECDH',public:publicKey},privateKey,256);
    const material=await crypto.subtle.importKey('raw',shared,'HKDF',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt,info:enc.encode(context)},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  function associatedData(packet){return enc.encode(JSON.stringify({v:packet.v,id:packet.id,toRoutes:packet.toRoutes,fromRoute:packet.fromRoute,createdAt:packet.createdAt,expiresAt:packet.expiresAt,ephemeralPublicKey:packet.ephemeralPublicKey}));}
  function signablePacket(packet){return {v:packet.v,id:packet.id,toRoutes:packet.toRoutes,fromRoute:packet.fromRoute,createdAt:packet.createdAt,expiresAt:packet.expiresAt,hopLimit:packet.hopLimit,ephemeralPublicKey:packet.ephemeralPublicKey,salt:packet.salt,iv:packet.iv,ciphertext:packet.ciphertext};}
  function packetBytes(packet){return enc.encode(JSON.stringify(packet));}
  function encodeNativePacket(packet){const bytes=packetBytes(packet);if(bytes.byteLength>MAX_PACKET_BYTES)throw new Error('حزمة الشبكة أكبر من حد النقل المحلي 256 كيلوبايت.');return bytesToB64(bytes);}
  async function createEnvelope(recipient,payload){
    const sender=await getIdentity(),recipientPublic=await importEcdhPublic(recipient.ecdhPublicKey),ephemeral=await generatePair({name:'ECDH',namedCurve:'P-256'},['deriveBits']);
    const now=Date.now(),createdAt=new Date(now).toISOString(),expiresAt=new Date(now+MAX_AGE_MS).toISOString(),id=crypto.randomUUID();
    const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    const context='AlwahaMeshV1|'+sender.fingerprint+'|'+recipient.fingerprint+'|'+id;
    const key=await deriveAesKey(ephemeral.privateKey,recipientPublic,salt,context);
    const ephemeralPub=bytesToB64(new Uint8Array(await crypto.subtle.exportKey('raw',ephemeral.publicKey)));
    const toRoutes=await routeTokensForPair(sender.ecdh.privateKey,recipientPublic,now),fromRoute=bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
    const packet={v:VERSION,id,toRoutes,fromRoute,createdAt,expiresAt,hopLimit:MAX_HOPS,hops:0,ephemeralPublicKey:ephemeralPub,salt:bytesToB64(salt),iv:bytesToB64(iv),ciphertext:''};
    const plain={protocol:PREFIX,senderFingerprint:sender.fingerprint,senderSigningPublicKey:sender.signingPublicKey,recipientFingerprint:recipient.fingerprint,payload};
    packet.ciphertext=bytesToB64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:associatedData(packet)},key,enc.encode(JSON.stringify(plain)))));
    const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},sender.signing.privateKey,packetBytes(signablePacket(packet)));
    packet.signature=bytesToB64(new Uint8Array(signature));
    return packet;
  }
  async function isForThisDevice(packet,identity){
    if(!Array.isArray(packet.toRoutes)||!packet.toRoutes.length)return false;
    const trusted=await getTrustedPeers();
    for(const peer of trusted){
      const publicKey=await importEcdhPublic(peer.ecdhPublicKey);
      const tokens=await routeTokensForPair(identity.ecdh.privateKey,publicKey);
      if(packet.toRoutes.some(token=>tokens.includes(token)))return true;
    }
    return false;
  }
  async function saveSeen(packet,sourceFingerprint=''){
    const key='mesh:seen:'+packet.id,exists=await vault().getRecord(key);if(exists)return false;
    await vault().put(key,{expiresAt:packet.expiresAt,sourceFingerprint,seenAt:new Date().toISOString()});
    seen.set(packet.id,true);return true;
  }
  async function enqueueRelay(packet,lastHopFingerprint=''){
    if(Number(packet.hops||0)>=Math.min(Number(packet.hopLimit||MAX_HOPS),MAX_HOPS))return false;
    const key='mesh:relay:'+packet.id,row=await vault().getRecord(key);if(row)return false;
    const all=await vault().getAll(),relayCount=all.filter(item=>typeof item.key==='string'&&item.key.startsWith('mesh:relay:')).length;
    if(relayCount>=300)throw new Error('طابور التمرير المحلي ممتلئ مؤقتًا؛ أفرغ الحزم إلى جار موثوق قبل إضافة المزيد.');
    const relay={...packet,hops:Math.min(MAX_HOPS,Number(packet.hops||0)+1)};
    await vault().put(key,{packet:relay,lastHopFingerprint,queuedAt:new Date().toISOString()});
    queued.set(packet.id,relay);window.dispatchEvent(new CustomEvent('alwaha:mesh-relay-queued',{detail:{id:packet.id,hops:relay.hops}}));
    return true;
  }
  async function decryptEnvelope(packet,identity){
    const senderEcdh=await importEcdhPublic(packet.ephemeralPublicKey);
    const salt=b64ToBytes(packet.salt),iv=b64ToBytes(packet.iv);
    const provisionalContext='AlwahaMeshV1|'; 
    // Sender fingerprint is encrypted, so try only explicitly paired peers and verify the result.
    const trusted=await getTrustedPeers();
    for(const peer of trusted){
      const context=provisionalContext+peer.fingerprint+'|'+identity.fingerprint+'|'+packet.id;
      try{
        const key=await deriveAesKey(identity.ecdh.privateKey,senderEcdh,salt,context);
        const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:associatedData(packet)},key,b64ToBytes(packet.ciphertext));
        const data=JSON.parse(dec.decode(plaintext));
        if(data.protocol!==PREFIX||data.recipientFingerprint!==identity.fingerprint||data.senderFingerprint!==peer.fingerprint||data.senderSigningPublicKey!==peer.signingPublicKey)continue;
        const signingKey=await crypto.subtle.importKey('raw',b64ToBytes(peer.signingPublicKey),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
        const ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},signingKey,b64ToBytes(packet.signature),packetBytes(signablePacket(packet)));
        if(!ok)throw new Error('توقيع حزمة الشبكة غير صالح؛ رفضنا الرسالة.');
        return {peer,payload:data.payload};
      }catch(error){if(error?.message?.includes('توقيع'))throw error;}
    }
    throw new Error('تعذر فك الحزمة: لم نعثر على جهاز موثوق يطابق هوية المرسل.');
  }
  async function handlePacket(packet,sourceFingerprint=transportPeerFingerprint,generation=transportGeneration){
    if(!packet||packet.v!==VERSION||packet.protocol===PREFIX||typeof packet.id!=='string'||!Array.isArray(packet.toRoutes))return {ignored:true};
    const now=Date.now(),expiry=Date.parse(packet.expiresAt||'');
    if(!Number.isFinite(expiry)||expiry<now||expiry>now+MAX_AGE_MS+60000)return {expired:true};
    if(Number(packet.hops||0)>MAX_HOPS||Number(packet.hopLimit||MAX_HOPS)>MAX_HOPS)return {invalid:true};
    const existing=await vault().getRecord('mesh:seen:'+packet.id);if(existing)return {duplicate:true};
    const identity=await getIdentity();
    if(generation!==transportGeneration)return {ignored:true,reason:'stale-transport'};
    if(await isForThisDevice(packet,identity)){
      const opened=await decryptEnvelope(packet,identity);
      if(generation!==transportGeneration)return {ignored:true,reason:'stale-transport'};
      if(!await saveSeen(packet,sourceFingerprint))return {duplicate:true};
      const detail={id:packet.id,senderFingerprint:opened.peer.fingerprint,senderAccountId:opened.peer.accountUserId||'',payload:opened.payload,receivedAt:new Date().toISOString(),local:true};
      if(opened.payload?.type==='file-chunk'){
        const chunk=opened.payload,base='mesh:file:'+String(chunk.fileId||''),key=base+':'+String(chunk.index);
        if(!chunk.fileId||!Number.isInteger(chunk.index)||!Number.isInteger(chunk.total)||chunk.total<1||chunk.total>512||chunk.index<0||chunk.index>=chunk.total)throw new Error('Invalid local file chunk metadata.');
        await storeLocalEncrypted(key,{chunk:chunk.chunk,receivedAt:new Date().toISOString()});
        const parts=[];
        for(let i=0;i<chunk.total;i++){const row=await readLocalEncrypted(base+':'+i);if(!row?.chunk)return {delivered:true,fileProgress:{fileId:chunk.fileId,received:i,total:chunk.total}};parts.push(b64ToBytes(row.chunk));}
        const blob=new Blob(parts,{type:String(chunk.mime||'application/octet-stream')});
        if(blob.size>25*1024*1024)throw new Error('Reassembled local file exceeds the 25 MB limit.');
        await storeLocalEncrypted(base+':meta',{total:chunk.total,name:String(chunk.name||'offline-file'),mime:blob.type,size:blob.size,kind:chunk.kind||'file',context:chunk.context||null});
        const url=URL.createObjectURL(blob);
        fileUrls.set(chunk.fileId,url);
        detail.payload={type:'file-ready',fileId:chunk.fileId,name:String(chunk.name||'offline-file'),mime:blob.type,size:blob.size,url,kind:chunk.kind||'file',context:chunk.context||null};
      }
      window.dispatchEvent(new CustomEvent('alwaha:mesh-message',{detail}));
      return {delivered:true};
    }
    if(generation!==transportGeneration)return {ignored:true,reason:'stale-transport'};
    const alreadySeen=await vault().getRecord('mesh:seen:'+packet.id);
    if(alreadySeen)return {duplicate:true};
    // Persist the relay payload before the dedup marker so a temporarily full queue
    // cannot permanently mark an undelivered packet as processed.
    const relayed=await enqueueRelay(packet,sourceFingerprint);
    await saveSeen(packet,sourceFingerprint);
    return {relayed};
  }
  async function sendRawPacket(packet,endpointId=''){
    const native=window.alwahaLocalNetwork;
    if(!native?.sendLocalPacket)throw new Error('لا يوجد اتصال محلي لنقل الحزمة.');
    const args={packet:encodeNativePacket(packet)};
    if(endpointId)args.endpointId=endpointId;
    await native.sendLocalPacket(args);
  }
  async function sendHello(endpointId=''){
    const native=window.alwahaLocalNetwork;if(!native?.sendLocalPacket)return false;
    const bundle=await getIdentityBundle();
    const hello={type:'hello',protocol:PREFIX,version:VERSION,bundle};
    try{
      const bytes=enc.encode(JSON.stringify(hello));if(bytes.length>MAX_PACKET_BYTES)return false;
      const args={packet:bytesToB64(bytes)};if(endpointId&&endpointId!=='legacy')args.endpointId=endpointId;
      await native.sendLocalPacket(args);return true;
    }catch{return false;}
  }
  function emitPacketState(result){
    window.dispatchEvent(new CustomEvent('alwaha:mesh-packet-state',{detail:result}));
  }
  async function processRawPacket(encoded,generation,endpointId=''){
    try{
      if(generation!==transportGeneration)return {ignored:true,reason:'stale-transport'};
      const bytes=b64ToBytes(encoded);if(bytes.length>MAX_PACKET_BYTES)throw new Error('Oversized mesh frame');
      const trafficKey=String(endpointId||'legacy'),now=Date.now();
      let traffic=inboundTraffic.get(trafficKey);
      if(!traffic||now-traffic.startedAt>=60000){traffic={startedAt:now,packets:0,bytes:0};inboundTraffic.set(trafficKey,traffic);}
      traffic.packets++;traffic.bytes+=bytes.length;
      if(traffic.packets>300||traffic.bytes>30*1024*1024){
        const limited={ignored:true,reason:'neighbor-rate-limit'};
        emitPacketState(limited);
        return limited;
      }
      const message=JSON.parse(dec.decode(bytes));
      if(message?.type==='hello'&&message.protocol===PREFIX){
        const fingerprint=await validateBundle(message.bundle);
        if(generation!==transportGeneration)return {ignored:true,reason:'stale-transport'};
        const endpointKey=String(endpointId||'legacy');
        transportEndpoints.set(endpointKey,{fingerprint,transport:endpointId?'nearby-connections':(transportType||'legacy'),relayAllowed:true,verifiedAt:Date.now()});
        transportPeerFingerprint=fingerprint;
        const trusted=(await getTrustedPeers()).some(peer=>peer.fingerprint===fingerprint);
        const result={fingerprint,code:fingerprint.slice(-6).toUpperCase(),trusted,relayAllowed:true,endpointId:endpointId||''};
        window.dispatchEvent(new CustomEvent('alwaha:mesh-neighbor',{detail:result}));
        // A consenting Alwaha bridge may forward opaque ciphertext without being trusted
        // as a direct chat contact. Decryption is still restricted to an explicitly paired sender.
        if(modeEnabled)await flushRelayQueue(endpointKey);
        emitModeState();
        return {hello:true,trusted,relayAllowed:true};
      }
      const endpointKey=String(endpointId||'legacy');
      const neighbor=transportEndpoints.get(endpointKey);
      const sourceFingerprint=neighbor?.fingerprint||(endpointId?'' : transportPeerFingerprint);
      if(!sourceFingerprint){
        const result={ignored:true,reason:'neighbor-not-identified'};
        emitPacketState(result);
        return result;
      }
      const trusted=(await getTrustedPeers()).some(peer=>peer.fingerprint===sourceFingerprint);
      if(generation!==transportGeneration)return {ignored:true,reason:'stale-transport'};
      if(!trusted&&!neighbor?.relayAllowed){
        const result={ignored:true,reason:'untrusted-neighbor'};
        emitPacketState(result);
        return result;
      }
      const result=await handlePacket(message,sourceFingerprint,generation);
      emitPacketState(result);
      if(result?.relayed&&modeEnabled)await flushRelayQueue();
      return result;
    }catch(error){
      console.warn('[Alwaha Mesh] rejected local frame:',error);
      window.dispatchEvent(new CustomEvent('alwaha:mesh-error',{detail:{message:error.message}}));
      return {error:true,message:String(error?.message||'Invalid local packet')};
    }
  }
  function receiveRawPacket(encoded,endpointId=''){
    if(pendingReceiveCount>=MAX_PENDING_RECEIVE){
      const result={ignored:true,reason:'receive-queue-full',limit:MAX_PENDING_RECEIVE};
      emitPacketState(result);
      window.dispatchEvent(new CustomEvent('alwaha:mesh-error',{detail:{message:'وصلت حزم الشبكة المحلية أسرع من قدرة المعالجة؛ تم رفض الحزمة الزائدة لحماية الذاكرة.'}}));
      return Promise.resolve(result);
    }
    pendingReceiveCount++;
    const generation=transportGeneration;
    const task=receiveQueue.then(
      ()=>processRawPacket(encoded,generation,endpointId),
      ()=>processRawPacket(encoded,generation,endpointId)
    );
    receiveQueue=task.catch(error=>{
      console.warn('[Alwaha Mesh] receive queue recovered after an unexpected error:',error);
    });
    return task.finally(()=>{pendingReceiveCount=Math.max(0,pendingReceiveCount-1);});
  }
  async function installTransportListeners(){
    const native=window.alwahaLocalNetwork;if(!native?.addListener||transportHandles.length)return;
    transportHandles.push(await native.addListener('localPacketReceived',event=>{void receiveRawPacket(event?.packet||'',String(event?.endpointId||''));}));
    transportHandles.push(await native.addListener('transportState',event=>{
      const state=String(event?.state||'');
      const endpointId=String(event?.endpointId||'');
      if(state==='nearby-advertising-failed'||state==='nearby-discovery-failed'||state==='nearby-accept-failed'||state==='nearby-request-failed'){
        window.dispatchEvent(new CustomEvent('alwaha:mesh-transport-error',{detail:event}));
      }
      if(state==='nearby-peer-connected'&&endpointId){
        transportType='nearby-connections';
        void sendHello(endpointId);
        window.dispatchEvent(new CustomEvent('alwaha:mesh-transport',{detail:event}));
      }else if(state==='nearby-peer-disconnected'&&endpointId){
        const disconnectedFingerprint=transportEndpoints.get(endpointId)?.fingerprint||'';
        transportEndpoints.delete(endpointId);
        if(transportPeerFingerprint===disconnectedFingerprint)transportPeerFingerprint=[...transportEndpoints.values()].map(peer=>peer.fingerprint).filter(Boolean).pop()||'';
        if(!transportEndpoints.size&&!transportPeerFingerprint)transportType='';
        emitModeState();
        window.dispatchEvent(new CustomEvent('alwaha:mesh-transport',{detail:event}));
      }else if(state==='nearby-mesh-stopped'){
        transportGeneration++;
        transportEndpoints.clear();
        transportPeerFingerprint='';
        transportType='';
        emitModeState();
        window.dispatchEvent(new CustomEvent('alwaha:mesh-transport',{detail:event}));
      }else if(state==='packet-transport-connected'){
        transportGeneration++;
        transportPeerFingerprint='';
        transportType=String(event.transport||'unknown');
        void sendHello('');
        window.dispatchEvent(new CustomEvent('alwaha:mesh-transport',{detail:event}));
      }else if(state==='packet-transport-disconnected'||state==='packet-transport-closed'){
        transportGeneration++;
        transportEndpoints.delete('legacy');
        if(transportEndpoints.size===0){transportType='';transportPeerFingerprint='';}
        emitModeState();
        window.dispatchEvent(new CustomEvent('alwaha:mesh-transport',{detail:event}));
      }
    }));
  }
  async function sendToAccount(accountUserId,payload){
    if(!isEnabled())throw new Error('وضع الشبكة الحرة غير مفعل في هذه المحادثة.');
    const peer=await getPeerByAccountId(accountUserId);if(!peer)throw new Error('لم تقترن بهذا الحساب بجهاز موثوق بعد.');
    const packet=await createEnvelope(peer,payload);
    const key='mesh:outbox:'+packet.id;await vault().put(key,{packet,recipientFingerprint:peer.fingerprint,createdAt:packet.createdAt});
    if(window.alwahaLocalNetwork?.sendLocalPacket){
      const direct=[...transportEndpoints.entries()].find(([,neighbor])=>neighbor?.fingerprint===peer.fingerprint);
      if(direct){await sendRawPacket(packet,direct[0]);return {sent:true,id:packet.id,route:'direct'};}
      if(transportEndpoints.size||transportPeerFingerprint){
        await enqueueRelay(packet,'');
        const forwarded=await flushRelayQueue();
        return {sent:forwarded.sent>0,queued:true,id:packet.id,route:'relay-hop'};
      }
    }
    await enqueueRelay(packet,'');
    return {sent:false,queued:true,id:packet.id,route:'store-and-forward'};
  }
  async function getLocalCacheKey(){
    const row=await vault().getRecord('mesh:local-at-rest-key-v1');
    if(row?.value?.type==='secret'&&row.value.algorithm?.name==='AES-GCM')return row.value;
    const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    await vault().put('mesh:local-at-rest-key-v1',key);return key;
  }
  async function storeLocalEncrypted(keyName,value){
    const key=await getLocalCacheKey(),iv=crypto.getRandomValues(new Uint8Array(12));
    const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(value)));
    await vault().put(keyName,{version:1,iv:bytesToB64(iv),cipher:bytesToB64(new Uint8Array(cipher))});
  }
  async function readLocalEncrypted(keyName){
    const row=await vault().getRecord(keyName),value=row?.value;
    if(!value||value.version!==1||!value.iv||!value.cipher)return null;
    try{const key=await getLocalCacheKey(),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(value.iv)},key,b64ToBytes(value.cipher));return JSON.parse(dec.decode(plain));}catch(error){console.warn('[Alwaha Mesh] local encrypted file cache unavailable:',error);return null;}
  }
  async function restoreFile(fileId){
    if(fileUrls.has(fileId))return fileUrls.get(fileId);
    const meta=await readLocalEncrypted('mesh:file:'+fileId+':meta');
    if(!meta||!Number.isInteger(meta.total)||meta.total<1||meta.total>512)return null;
    const parts=[];
    for(let index=0;index<meta.total;index++){const chunk=await readLocalEncrypted('mesh:file:'+fileId+':'+index);if(!chunk?.chunk)return null;parts.push(b64ToBytes(chunk.chunk));}
    const blob=new Blob(parts,{type:meta.mime||'application/octet-stream'});if(blob.size>25*1024*1024)return null;
    const url=URL.createObjectURL(blob);fileUrls.set(fileId,url);return url;
  }
  async function sendFileToAccount(accountUserId,file,kind='file',context={}){
    if(!file||!Number.isFinite(file.size)||file.size<=0)throw new Error('الملف غير صالح.');
    if(file.size>25*1024*1024)throw new Error('حد الملف المحلي 25 ميجابايت في هذه المرحلة.');
    const peer=await getPeerByAccountId(accountUserId),fileId=crypto.randomUUID(),total=Math.ceil(file.size/FILE_CHUNK_BYTES);
    if(!peer)throw new Error('الجهاز المقصود غير مقترن.');
    const meta={total,name:String(file.name||'offline-file'),mime:file.type||'application/octet-stream',size:file.size,kind,context};
    await storeLocalEncrypted('mesh:file:'+fileId+':meta',meta);
    for(let index=0;index<total;index++){
      const bytes=new Uint8Array(await file.slice(index*FILE_CHUNK_BYTES,Math.min(file.size,(index+1)*FILE_CHUNK_BYTES)).arrayBuffer());
      await storeLocalEncrypted('mesh:file:'+fileId+':'+index,{chunk:bytesToB64(bytes)});
      await sendToAccount(accountUserId,{type:'file-chunk',fileId,index,total,name:meta.name,mime:meta.mime,size:file.size,kind,context,chunk:bytesToB64(bytes)});
    }
    fileUrls.set(fileId,URL.createObjectURL(file));
    return {queued:true,fileId,chunks:total,name:meta.name,mime:meta.mime,size:meta.size,kind};
  }
  async function pruneExpiredState(){
    const now=Date.now(),rows=await vault().getAll();
    let removed=0;
    for(const row of rows||[]){
      if(typeof row.key!=='string')continue;
      if(row.key.startsWith('mesh:seen:')){
        const expiry=Date.parse(row.value?.expiresAt||'');
        if(!Number.isFinite(expiry)||expiry<now){await vault().removeRecord(row.key);removed++;}
      }else if(row.key.startsWith('mesh:relay:')){
        const expiry=Date.parse(row.value?.packet?.expiresAt||'');
        if(!Number.isFinite(expiry)||expiry<now){await vault().removeRecord(row.key);removed++;}
      }else if(row.key.startsWith('mesh:outbox:')){
        const created=Date.parse(row.value?.createdAt||'');
        if(!Number.isFinite(created)||now-created>MAX_AGE_MS){await vault().removeRecord(row.key);removed++;}
      }
    }
    return removed;
  }
  async function flushRelayQueue(preferredEndpointId=''){
    if(!window.alwahaLocalNetwork?.sendLocalPacket)return {sent:0};
    const neighbors=[...transportEndpoints.entries()].filter(([id,peer])=>peer?.relayAllowed&&(!preferredEndpointId||id===preferredEndpointId));
    if(!neighbors.length&&transportPeerFingerprint)neighbors.push(['legacy',{fingerprint:transportPeerFingerprint,relayAllowed:true}]);
    if(!neighbors.length)return {sent:0,waiting:true};
    await pruneExpiredState();
    const rows=await vault().getAll(),out=[];
    for(const row of rows||[]){
      if(typeof row.key!=='string'||!row.key.startsWith('mesh:relay:')||!row.value?.packet)continue;
      const packet=row.value.packet,expires=Date.parse(packet.expiresAt||'');
      if(!Number.isFinite(expires)||expires<Date.now()){await vault().removeRecord?.('mesh:relay:'+packet.id);await vault().put('mesh:expired:'+packet.id,{expiredAt:new Date().toISOString()});continue;}
      for(const [endpointId,peer] of neighbors){
        if(row.value.lastHopFingerprint===peer.fingerprint)continue;
        try{await sendRawPacket(packet,endpointId);out.push({id:packet.id,endpointId});}
        catch(error){console.warn('[Alwaha Mesh] relay send failed:',error);break;}
      }
    }
    window.dispatchEvent(new CustomEvent('alwaha:mesh-relay-flushed',{detail:{count:out.length}}));
    return {sent:out.length,ids:out.map(item=>item.id)};
  }
  async function setMode(enabled){
    modeEnabled=Boolean(enabled);
    try{await vault().put('mesh:mode-enabled-v1',{enabled:modeEnabled,updatedAt:new Date().toISOString()});}catch(error){console.warn('[Alwaha Mesh] mode preference could not be saved:',error);}
    await installTransportListeners();
    if(!modeEnabled){transportEndpoints.clear();transportPeerFingerprint='';transportType='';}
    emitModeState();
    return isEnabled();
  }
  async function restoreMode(){
    // Radio use is session-scoped. The user's bridge consent persists, but discovery
    // never silently restarts after an app restart without a fresh tap.
    modeEnabled=false;
    try{localStorage.removeItem('alwaha_mesh_mode_enabled_v1');await vault()?.put?.('mesh:mode-enabled-v1',{enabled:false,updatedAt:new Date().toISOString()});}
    catch(error){console.warn('[Alwaha Mesh] mode preference reset failed:',error);}
    emitModeState();
    return false;
  }
  function isEnabled(){
    // The global app remains online while the bridge is merely available.
    // Local-only application behavior is selected only after the Internet is actually offline.
    return modeEnabled && (typeof navigator==='undefined' || navigator.onLine===false);
  }
  function isBridgeActive(){return modeEnabled&&(transportEndpoints.size>0||Boolean(transportPeerFingerprint));}
  async function canRouteToAccount(accountUserId){
    if(!modeEnabled||!(transportEndpoints.size>0||transportPeerFingerprint))return false;
    return Boolean(await getPeerByAccountId(accountUserId));
  }
  function getTransportPeer(){return transportPeerFingerprint;}
  function getTransportType(){return transportType;}
  function getTransportPeerForAccount(accountUserId){
    const peer=peers.get(String(accountUserId||''));if(!peer)return '';
    for(const neighbor of transportEndpoints.values())if(neighbor.fingerprint===peer.fingerprint)return peer.fingerprint;
    return '';
  }
  function hasDirectTransportTo(fingerprint){return [...transportEndpoints.values()].some(peer=>peer?.fingerprint===String(fingerprint||''));}
  function getTransportTypeForPeer(fingerprint){
    const found=[...transportEndpoints.values()].find(peer=>peer?.fingerprint===String(fingerprint||''));return found?.transport||'';
  }
  function emitModeState(){
    const active=modeEnabled&&(transportEndpoints.size>0||Boolean(transportPeerFingerprint));
    window.dispatchEvent(new CustomEvent('alwaha:mesh-mode',{detail:{enabled:active,requested:modeEnabled,connectedPeers:transportEndpoints.size}}));
  }
  function isRequested(){return modeEnabled;}
  function setTransportPeer(fingerprint){
    const next=String(fingerprint||'');
    if(next!==transportPeerFingerprint)transportGeneration++;
    transportPeerFingerprint=next;
    if(next)transportEndpoints.set('legacy',{fingerprint:next,transport:transportType||'legacy',relayAllowed:true,verifiedAt:Date.now()});
    else transportEndpoints.delete('legacy');
    emitModeState();
  }
  function destroy(){
    transportGeneration++;transportPeerFingerprint='';transportType='';transportEndpoints.clear();modeEnabled=false;
    transportHandles.forEach(handle=>Promise.resolve(handle.remove()).catch(()=>{}));
    transportHandles=[];modeEnabled=false;
  }
  window.AlwahaLocalMesh={version:VERSION,getIdentityBundle,pairPeer,getTrustedPeers,getPeerByAccountId,sendToAccount,sendFileToAccount,receiveRawPacket,sendHello,flushRelayQueue,pruneExpiredState,setMode,isEnabled,isBridgeActive,canRouteToAccount,isRequested,getTransportPeer,getTransportType,getTransportPeerForAccount,hasDirectTransportTo,getTransportTypeForPeer,setTransportPeer,restoreFile,getFileUrl:fileId=>fileUrls.get(fileId)||null,destroy};
  window.addEventListener('DOMContentLoaded',()=>{void Promise.all([restoreMode(),installTransportListeners()]).catch(error=>console.warn('[Alwaha Mesh] startup restore failed:',error));});
})();
