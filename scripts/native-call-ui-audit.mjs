import fs from 'node:fs';
const checks = [
 ['native audio plugin source exists', fs.existsSync('scripts/android/AlwahaAudioRoutePlugin.java')],
 ['Android CI registers native plugin', fs.readFileSync('.github/workflows/build-apk-aab-release.yml','utf8').includes('Register Alwaha native call audio routing plugin')],
 ['native bridge registers plugin', fs.readFileSync('scripts/native-back-handler.mjs','utf8').includes("registerPlugin('AlwahaAudioRoute')")],
 ['native plugin shares the installed APK securely', fs.readFileSync('scripts/android/AlwahaAudioRoutePlugin.java','utf8').includes('FileProvider.getUriForFile') && fs.readFileSync('.github/workflows/build-apk-aab-release.yml','utf8').includes('alwaha_file_paths.xml')],
 ['call UI exposes speaker toggle', fs.readFileSync('index.html','utf8').includes('onclick="toggleCallSpeaker()"')],
];
let failures=0;
for (const [label,ok] of checks) { if(ok) console.log('PASS:',label); else { console.error('FAIL:',label); failures++; } }
if(failures) process.exit(1);
console.log('NATIVE_CALL_UI_AUDIT=PASS');
