import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
const checks=[
 ['native audio plugin source exists',fs.existsSync('scripts/android/AlwahaAudioRoutePlugin.java')],
 ['Android CI registers native plugin',fs.readFileSync('.github/workflows/build-apk-aab-release.yml','utf8').includes('Register Alwaha native call audio routing plugin')],
 ['native bridge registers plugin',fs.readFileSync('scripts/native-back-handler.mjs','utf8').includes("registerPlugin('AlwahaAudioRoute')")],
 ['native plugin shares the installed APK securely',fs.readFileSync('scripts/android/AlwahaAudioRoutePlugin.java','utf8').includes('FileProvider.getUriForFile')&&fs.readFileSync('.github/workflows/build-apk-aab-release.yml','utf8').includes('alwaha_file_paths.xml')],
 ['call UI exposes speaker toggle',html.includes('onclick="toggleCallSpeaker()"')],
 ['call feedback module is loaded and precached',fs.existsSync('alwaha-call-feedback.js')&&html.includes('src="./alwaha-call-feedback.js"')&&sw.includes("'./alwaha-call-feedback.js'")],
 ['outgoing call starts a local ringback tone',html.includes("AlwahaCallFeedback?.start('ringback')")],
 ['generic call ends normalize to remote-ended while preserving explicit outcomes',html.includes("const endState=['declined','busy','no-answer','unavailable'].includes(data.reason)?data.reason:'remote-ended'")&&html.includes("reason:'declined'")],
 ['cancel before answer immediately stops the incoming ring and closes pending state',html.includes("payload.type==='end'&&this.pendingIncoming?.sessionId===payload.sessionId")&&html.includes('handlePendingIncomingEnd(payload)')],
 ['unauthorized market calls return an unavailable outcome',html.includes("sendCallResult(payload.from,payload.sessionId,'unavailable')")],
 ['declined, busy, no-answer and unavailable states are represented', ['declined','busy','no-answer','unavailable'].every(x=>html.includes(x))],
 ['caller and callee have bounded no-answer timers',html.includes('scheduleCallTimeout(this.sessionId,35000)')&&html.includes('scheduleCallTimeout(payload.sessionId,30000,payload)')],
 ['call termination clears call feedback and timeout',html.includes('AlwahaCallFeedback?.stop()')&&html.includes('clearCallTimeout()')],
 ['Termux deploy copy preserves native audio plugin',/rel\.parts\[0\].*android/.test(fs.readFileSync('TERMUX-PUSH-3.0.2-R7.5-20261103.sh','utf8'))&&fs.readFileSync('TERMUX-PUSH-3.0.2-R7.5-20261103.sh','utf8').includes("scripts/android/AlwahaAudioRoutePlugin.java")]
];
let failures=0;for(const [label,ok] of checks){if(ok)console.log('PASS:',label);else{console.error('FAIL:',label);failures++;}}
if(failures)process.exit(1);console.log('NATIVE_CALL_UI_AUDIT=PASS');
