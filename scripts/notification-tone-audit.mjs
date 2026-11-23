import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(path,'utf8');
const source=read('scripts/generate-notification-tones.mjs');
const polish=read('production-polish.js');
const app=read('index.html');
const feedback=read('alwaha-call-feedback.js');
const worker=read('sw.js');
const vault=read('alwaha-local-vault.js');
const workflow=read('.github/workflows/build-apk-aab-release.yml');

assert.ok(source.includes("name:'message_chime.wav'")&&source.includes("name:'notification_chime.wav'"),'independent original one-shot chimes are generated alongside two full-length call ringtones');
assert.ok(feedback.includes("message:[{delay:0")&&feedback.includes("notification:[{delay:0"),'message and notification are one-shot sounds');
assert.ok(feedback.includes('function playAmbient(kind)')&&feedback.includes('playAmbient,diagnostics:')&&feedback.includes('Math.min(3000'),'message sounds do not stop live call ringback and support bright bell harmonics');
assert.ok(app.includes('alwaha-message-sounds-enabled')&&app.includes('alwaha-notification-sounds-enabled')&&app.includes('alwaha_message_sounds_enabled')&&app.includes('alwaha_notification_sounds_enabled'),'users can independently toggle and preview both sounds');
assert.ok(app.includes('playAlwahaInboundSound(kind)')&&app.includes('playAmbient?.(kind)'),'incoming one-shot sounds are independent of the active call-progress ringtone');
assert.ok(workflow.includes('alwaha_message_chime.wav')&&workflow.includes('alwaha_notification_chime.wav'),'Android build copies both WAV resources into res/raw');
assert.ok(app.includes("playAlwahaInboundSound('message')")&&app.includes("playAlwahaInboundSound('notification')"),'incoming messages and notifications are wired to the one-shot sounds');
assert.ok(worker.includes('./assets/sounds/message_chime.wav')&&worker.includes('./assets/sounds/notification_chime.wav'),'both sounds are precached for offline playback');
assert.ok(polish.includes("safeGet('alwaha_call_ringtone_choice_version') !== '4'")&&polish.includes("safeSet('alwaha_call_ringtone_choice_version', '4')")&&polish.includes("safeSet('alwaha_ringtone_choice', 'marimba_bloom')"),'Marimba Bloom is the one-time default call ringtone migration');
assert.ok(polish.includes("alwaha_ringtone_user_selected")&&polish.includes("explicitlySelected")&&polish.includes("if (userInitiated) safeSet('alwaha_ringtone_user_selected', 'true')"),'explicit user ringtone choices are distinguished from automatic defaults and survive updates');
for(const key of ['alwaha_call_ringtone_choice_version','alwaha_ringtone_user_selected','alwaha_call_ringtone_enabled','alwaha_message_sounds_enabled','alwaha_notification_sounds_enabled'])assert.ok(vault.includes("'"+key+"'"),'encrypted backup must preserve '+key);
assert.ok(app.includes('النغمة الافتراضية المشرقة الهادئة')&&app.includes('رنين بلوري واحد قصير'),'settings UI describes the selected default and the distinct one-shot message tone');
assert.ok(polish.includes("./assets/sounds/saffron_tide.mp3")&&polish.includes("./assets/sounds/marimba_bloom.mp3")&&polish.includes('audio.loop = !preview'),'the two full-length call ringtones remain local and loop only for incoming calls');

assert.ok(workflow.includes('npm run prebuild')&&readPackageScript(),'CI generates original tone resources before release audits');

function readPackageScript(){
  const pkg=JSON.parse(read('package.json'));
  return typeof pkg.scripts?.prebuild==='string'&&pkg.scripts.prebuild.includes('scripts/generate-notification-tones.mjs');
}

console.log('NOTIFICATION_TONE_AUDIT=PASS (original one-shot chimes, persistent Marimba Bloom default, user selection preservation, offline precache and Android resource generation)');
