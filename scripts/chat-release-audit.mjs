import fs from 'node:fs';
const html = fs.readFileSync('index.html','utf8');
const checks = [
  ['audio action', 'initiateVoiceCall(\'online\')'],
  ['nearby network action', 'openAlwahaLocalNetworkPanel()'],
  ['video action', 'initiateVideoCall()'],
  ['overflow menu', 'chat-more-menu'],
  ['profile menu action', 'openCurrentChatProfile()'],
  ['message refresh action', 'loadDirectMessages()'],
  ['share summary action', 'shareCurrentChat()'],
  ['privacy information action', 'showChatPrivacyInfo()'],
  ['local network truth statement', 'غير مفعّل بعد'],
  ['network not falsely enabled', 'لن يبدأ التطبيق وضعًا وهميًا'],
  ['Bluetooth remains honestly disabled', 'المكالمات عبر البلوتوث لم تُنفذ بعد'],
  ['video camera acquisition', 'getUserMedia({ audio: true, video: videoConstraints })'],
  ['video peer capture', 'remoteVideo.srcObject = stream'],
  ['camera switch action', 'switchCallCamera()'],
  ['camera mute action', 'toggleCallCamera()'],
  ['earpiece default route', 'setAlwahaCallSpeaker(false,true)'],
  ['speaker toggle control', 'toggleCallSpeaker()'],
  ['audio route reset on hangup', 'resetAlwahaCallAudioRoute()'],
  ['outgoing media type signaling', 'mediaType: this.mediaType'],
  ['incoming media type', 'payload.mediaType === \'video\''],
  ['queued ICE candidate handshake', 'pendingRoomSignalsToSend'],
  ['queued ICE peer ready', "payload.type === 'ready'"],
  ['TURN timeout diagnostic', 'call-config timed out'],
  ['feed retry state', 'إعادة المحاولة'],
  ['feed no network state', 'لا يوجد اتصال بالإنترنت'],
  ['feed request race guard', 'alwahaHomeFeedRequestId'],
  ['feed authentication has a deadline', 'alwahaUiDeadline(getCurrentAuthUser(), 1400, null)'],
  ['API request timeout covers response body', 'const requestPromise = (async () =>'],
  ['legacy WebView has AbortController fallback', "typeof AbortController === 'function' ? new AbortController() : null"],
];
let failures=0;
for(const [label,needle] of checks){if(!html.includes(needle)){console.error('FAIL:',label);failures++;}else console.log('PASS:',label);}
const staticMarkup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,'');
const ids=[...staticMarkup.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
const duplicates=ids.filter((id,i)=>ids.indexOf(id)!==i);
if(duplicates.length){console.error('FAIL: duplicate static IDs:',[...new Set(duplicates)].join(', '));failures++;}
else console.log('PASS: no duplicate static IDs');
if(failures)process.exit(1);
console.log(`Alwaha chat/feed candidate audit passed (${checks.length+1} checks).`);
