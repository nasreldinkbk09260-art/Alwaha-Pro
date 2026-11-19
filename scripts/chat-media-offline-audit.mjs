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
 ['media attachments are stored in a private bucket, not public media URLs',html.includes("storage.from('chat-media').upload")&&html.includes("createSignedUrl(item.path,3600)")&&!html.includes("getPublicUrl(path)")],
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
 ['offline UI does not claim remote messages or media were sent',html.includes('الإرسال والمزامنة متوقفان دون اتصال')&&html.includes('إرسال الوسائط دون اتصال غير متاح بعد')],
 ['offline auth fallback only reads persisted local session for local display',html.includes('A persisted session may be used only to identify cached local data offline')&&html.includes('supabaseClient.auth.getSession()')]
];
let failures=0;
for(const [name,ok] of checks){if(ok)console.log('PASS:',name);else{failures++;console.error('FAIL:',name);}}
if(failures)process.exit(1);
console.log('CHAT_MEDIA_OFFLINE_AUDIT=PASS ('+checks.length+' checks)');
