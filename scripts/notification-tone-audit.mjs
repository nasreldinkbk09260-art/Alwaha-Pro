import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(path,'utf8');
const source=read('scripts/generate-notification-tones.mjs');
const app=read('index.html');
const feedback=read('alwaha-call-feedback.js');
const worker=read('sw.js');
const workflow=read('.github/workflows/build-apk-aab-release.yml');

assert.ok(source.includes("name:'message_chime.wav'")&&source.includes("name:'notification_chime.wav'"),'two original notification sound files are generated');
assert.ok(feedback.includes("message:[{delay:0")&&feedback.includes("notification:[{delay:0"),'message and notification are one-shot sounds');
assert.ok(feedback.includes('function playAmbient(kind)')&&feedback.includes('playAmbient,diagnostics:')&&feedback.includes('Math.min(3000'),'message sounds do not stop live call ringback and support bright bell harmonics');
assert.ok(app.includes('alwaha-message-sounds-enabled')&&app.includes('alwaha-notification-sounds-enabled')&&app.includes('alwaha_message_sounds_enabled')&&app.includes('alwaha_notification_sounds_enabled'),'users can independently toggle and preview both sounds');
assert.ok(app.includes('playAlwahaInboundSound(kind)')&&app.includes('playAmbient?.(kind)'),'incoming one-shot sounds are independent of the active call-progress ringtone');
assert.ok(workflow.includes('alwaha_message_chime.wav')&&workflow.includes('alwaha_notification_chime.wav'),'Android build copies both WAV resources into res/raw');
assert.ok(app.includes("playAlwahaInboundSound('message')")&&app.includes("playAlwahaInboundSound('notification')"),'incoming messages and notifications are wired to the one-shot sounds');
assert.ok(worker.includes('./assets/sounds/message_chime.wav')&&worker.includes('./assets/sounds/notification_chime.wav'),'both sounds are precached for offline playback');
assert.ok(workflow.includes('npm run prebuild')&&readPackageScript(),'CI generates original tone resources before release audits');

function readPackageScript(){
  const pkg=JSON.parse(read('package.json'));
  return typeof pkg.scripts?.prebuild==='string'&&pkg.scripts.prebuild.includes('scripts/generate-notification-tones.mjs');
}

console.log('NOTIFICATION_TONE_AUDIT=PASS (original one-shot chimes, offline precache, Android resource generation)');
