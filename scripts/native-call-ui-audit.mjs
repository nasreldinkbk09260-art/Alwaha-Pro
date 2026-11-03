import fs from 'node:fs';
const checks = [
 ['native audio plugin source exists', fs.existsSync('scripts/android/AlwahaAudioRoutePlugin.java')],
 ['Android CI registers native plugin', fs.readFileSync('.github/workflows/build-apk-aab-release.yml','utf8').includes('Register Alwaha native call audio routing plugin')],
 ['native bridge registers plugin', fs.readFileSync('scripts/native-back-handler.mjs','utf8').includes("registerPlugin('AlwahaAudioRoute')")],
 ['native plugin shares the installed APK securely', fs.readFileSync('scripts/android/AlwahaAudioRoutePlugin.java','utf8').includes('FileProvider.getUriForFile') && fs.readFileSync('.github/workflows/build-apk-aab-release.yml','utf8').includes('alwaha_file_paths.xml')],
 ['call UI exposes speaker toggle', fs.readFileSync('index.html','utf8').includes('onclick="toggleCallSpeaker()"')],
 ['Termux deploy copy preserves scripts/android native plugin', /rel\.parts\[0\].*android/.test(fs.readFileSync('TERMUX-PUSH-3.0.2-R7.4-20261102.sh','utf8')) && fs.readFileSync('TERMUX-PUSH-3.0.2-R7.4-20261102.sh','utf8').includes("scripts/android/AlwahaAudioRoutePlugin.java")],
];
let failures=0;
for (const [label,ok] of checks) { if(ok) console.log('PASS:',label); else { console.error('FAIL:',label); failures++; } }
if(failures) process.exit(1);
console.log('NATIVE_CALL_UI_AUDIT=PASS');
