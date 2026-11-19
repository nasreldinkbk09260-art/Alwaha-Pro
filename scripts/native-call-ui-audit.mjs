import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
const hasVersionedScript=(asset)=>{
 const marker='src="./'+asset+'?v=',pos=html.indexOf(marker);if(pos<0)return false;
 const revision=html.slice(pos+marker.length).split('"')[0];
 return !!revision&&sw.includes("'./"+asset+"?v="+revision+"'")&&sw.includes("'./"+asset+"'");
};
const checks=[
 ['native audio plugin source exists',fs.existsSync('scripts/android/AlwahaAudioRoutePlugin.java')],
 ['Android CI registers native plugin',fs.readFileSync('.github/workflows/build-apk-aab-release.yml','utf8').includes('Register Alwaha native call audio routing plugin')],
 ['native bridge registers plugin',fs.readFileSync('scripts/native-back-handler.mjs','utf8').includes("registerPlugin('AlwahaAudioRoute')")],
 ['native plugin shares the installed APK securely',fs.readFileSync('scripts/android/AlwahaAudioRoutePlugin.java','utf8').includes('FileProvider.getUriForFile')&&fs.readFileSync('.github/workflows/build-apk-aab-release.yml','utf8').includes('alwaha_file_paths.xml')],
 ['call UI exposes speaker toggle',html.includes('onclick="toggleCallSpeaker()"')],
 ['call feedback module is loaded and precached',fs.existsSync('alwaha-call-feedback.js')&&hasVersionedScript('alwaha-call-feedback.js')],
 ['outgoing call starts a local ringback tone',html.includes("AlwahaCallFeedback?.start('ringback')")],
 ['generic call ends normalize to remote-ended while preserving explicit outcomes',html.includes("const endState=['declined','busy','no-answer','unavailable'].includes(data.reason)?data.reason:'remote-ended'")&&html.includes("reason:'declined'")],
 ['cancel before answer immediately stops the incoming ring and closes pending state',html.includes("payload.type==='end'&&this.pendingIncoming?.sessionId===payload.sessionId")&&html.includes('handlePendingIncomingEnd(payload)')],
 ['unauthorized market calls return an unavailable outcome through the market inbox',html.includes("sendCallResult(payload.from,payload.sessionId,'unavailable','market')")],
 ['declined, busy, no-answer and unavailable states are represented', ['declined','busy','no-answer','unavailable'].every(x=>html.includes(x))],
 ['caller and callee have bounded no-answer timers',html.includes('scheduleCallTimeout(this.sessionId,35000)')&&html.includes('scheduleCallTimeout(payload.sessionId,30000,payload)')],
 ['market call results use a separate market inbox channel and result event',html.includes('webrtc-market-call-result')&&html.includes('market-call-inbox-')&&html.includes('const market=mode')],
 ['busy, no-answer and unavailable outcomes preserve market routing',html.includes("'busy',payload.mode==='market'?'market':'online'")&&html.includes("'no-answer',this.mode")&&html.includes("'unavailable','market'")],
 ['call results validate recipient, peer and session identity',html.includes('payload.to!==this.myId||payload.from!==this.peerId')&&html.includes('payload.sessionId!==this.sessionId')],
 ['market/friend call signaling has an executable VM regression test',fs.existsSync('scripts/call-signaling-runtime-test.mjs')&&fs.readFileSync('package.json','utf8').includes('call-signaling-runtime-test.mjs')],
 ['local voice/video WebRTC disables public STUN/TURN and uses host ICE only',html.includes("this.signaling?.localOnly ? { iceServers: [], iceCandidatePoolSize: 0 }")],
 ['local call offers, answers, candidates and results use encrypted mesh packets',html.includes("type:'call-signal'")&&html.includes("type:'call-result'")&&html.includes('handleLocalMeshSignal')&&html.includes('sendToAccount(this.peerId')],
 ['outgoing local calls require a paired peer and active local mode',html.includes("mode==='offline'||mode==='offline-market'")&&html.includes("mesh.getPeerByAccountId(targetId)")&&html.includes("mesh.isEnabled()")],
 ['local calls never call the cloud call-config ICE service',html.includes("this.signaling?.localOnly ? { iceServers: [], iceCandidatePoolSize: 0 }")&&html.includes("this.rtcConfig =")],
 ['local market calls are bound to the active buyer-seller conversation',html.includes("mode==='offline-market'")&&html.includes('currentMarketPeerId')&&html.includes('conversationId')],
 ['call termination clears call feedback and timeout',html.includes('AlwahaCallFeedback?.stop()')&&html.includes('clearCallTimeout()')],
 ['closing an ended call hides the call screen before asynchronous media cleanup',/async function terminateVoiceCall\(\)\s*\{\s*\/\/ Hide the terminal call screen immediately[\s\S]{0,260}modal\.style\.display = 'none'[\s\S]{0,180}await activeCallManager\?\.end\(true\)/.test(html)],
 ['Termux deploy copy preserves native audio plugin',/rel\.parts\[0\].*android/.test(fs.readFileSync('TERMUX-PUSH-3.0.2-R7.5-20261103.sh','utf8'))&&fs.readFileSync('TERMUX-PUSH-3.0.2-R7.5-20261103.sh','utf8').includes("scripts/android/AlwahaAudioRoutePlugin.java")]
];
let failures=0;for(const [label,ok] of checks){if(ok)console.log('PASS:',label);else{console.error('FAIL:',label);failures++;}}
if(failures)process.exit(1);console.log('NATIVE_CALL_UI_AUDIT=PASS');
