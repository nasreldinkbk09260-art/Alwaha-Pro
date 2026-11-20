import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8');
const vault=fs.readFileSync('alwaha-local-vault.js','utf8');
const migration=fs.readFileSync('supabase/migrations/20261119215000_chat_private_media_and_permissions.sql','utf8');
const checks=[
 ['direct chat has image/video file picker',html.includes('id="direct-chat-media-input"')&&html.includes('handleDirectChatFileInput(this)')],
 ['direct chat has a voice-note recorder button',html.includes('id="direct-chat-voice-button"')&&html.includes("toggleChatVoiceRecording('direct')")],
 ['marketplace chat has image/video picker',html.includes('id="market-chat-media-input"')&&html.includes('handleMarketChatFileInput(this)')],
 ['marketplace chat has a voice-note recorder',html.includes('id="market-chat-voice-button"')&&html.includes("toggleChatVoiceRecording('market')")],
 ['voice notes use MediaRecorder and release microphone tracks',html.includes('new MediaRecorder(stream')&&html.includes('recorder.onstop=async()')&&html.includes('stream.getTracks().forEach(track=>track.stop())')],
 ['chat media uploads use the private chat-media bucket and render only participant-scoped signed URLs',html.includes("supabaseClient.storage.from('chat-media').upload(path,file")&&html.includes("supabaseClient.storage.from('chat-media').createSignedUrl(item.path,3600)")&&!html.slice(html.indexOf('async function renderAlwahaChatMessageContent'),html.indexOf('async function uploadPrivateChatMedia')).includes('getPublicUrl(')],
 ['media references preserve legacy text-message rows',html.includes('ALWAHA_MEDIA_V1:')&&html.includes('decodeAlwahaChatMedia')&&html.includes('renderAlwahaChatMessageContent')],
 ['market and direct chat rendering supports audio/video/image messages',html.includes('await renderAlwahaChatMessageContent(m.message)')&&html.includes('await renderAlwahaChatMessageContent(row.message)')],
 ['media upload validates MIME and bounded size',html.includes('file.type.startsWith(\'image/\')')&&html.includes('file.type.startsWith(\'video/\')')&&html.includes('file.size>maxBytes')],
 ['private storage restricts uploads to user folder',migration.includes("bucket_id = 'chat-media'")&&migration.includes("(storage.foldername(name))[1] = (SELECT auth.uid())::text")],
 ['private storage restricts reads to direct or marketplace participants',migration.includes('public.messages AS m')&&migration.includes('public.market_messages AS mm')&&migration.includes('public.market_conversations AS mc')],
 ['private storage bucket is non-public and permits audio/video/image formats',/VALUES \(\s*'chat-media',[\s\S]{0,180}'chat-media',\s*false,\s*52428800/.test(migration)&&migration.includes("'audio/webm'")&&migration.includes("'video/mp4'")&&migration.includes("'image/jpeg'")],
 ['offline cache is encrypted with a non-extractable AES-GCM key',vault.includes("generateKey({name:'AES-GCM',length:256},false")&&vault.includes('crypto:offline-cache-key-v1')&&vault.includes('putEncryptedCache')],
 ['direct and marketplace message caches are user-scoped',vault.includes("'cache:direct:'+String(userId)+':'+String(peerId)")&&vault.includes("'cache:market:'+String(userId)+':'+String(conversationId)")],
 ['offline direct chat list reads local encrypted cache',html.includes('getAllDirectChatCaches?.(me.id)')&&html.includes('نسخة محلية مشفّرة')],
 ['offline marketplace list and chat use locally cached conversation index',html.includes('getMarketConversationIndex?.(me.id)')&&vault.includes("cache:market-index:")],
 ['offline UI distinguishes local encrypted relay queueing from unavailable cloud delivery',html.includes('الإرسال والمزامنة السحابية متوقفان دون اتصال')&&html.includes('إرسال الوسائط دون اتصال غير متاح ما لم تفعل الشبكة الحرة')&&html.includes('حُفظت كحزمة مشفّرة للتمرير المرحّل.')&&html.includes('result.sent?')],
  ['offline account identity fallback is local-only and never becomes a server write credential',html.includes('const cachedLocalIdentity=async()=>')&&html.includes('if(!localOnly())return null;')&&html.includes('alwaha_local_identity:true')&&html.includes('A persisted Auth session may identify the account for local cached reads; it is not a write credential')&&html.includes('supabaseClient.auth.getSession()')&&html.includes('return await cachedLocalIdentity()')],
];
let failures=0;
for(const [name,ok] of checks){if(ok)console.log('PASS:',name);else{failures++;console.error('FAIL:',name);}}
if(failures)process.exit(1);
console.log('CHAT_MEDIA_OFFLINE_AUDIT=PASS ('+checks.length+' checks)');
