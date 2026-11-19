import fs from 'node:fs';
const html = fs.readFileSync('index.html','utf8');
const experience = fs.readFileSync('alwaha-experience.js','utf8');
const kids = fs.readFileSync('alwaha-kids-room.js','utf8');
const replyMigration=fs.readFileSync('supabase/migrations/20261108120000_real_chat_message_replies.sql','utf8');
const replyTest=fs.readFileSync('supabase/tests/20261108120000_message_reply_scope.sql','utf8');
const friendAcceptMigration=fs.readFileSync('supabase/migrations/20261108130000_friend_request_acceptance_notification.sql','utf8');
const friendAcceptTest=fs.readFileSync('supabase/tests/20261108130000_friend_request_acceptance_notification.sql','utf8');
const marketCallMigration=fs.readFileSync('supabase/migrations/20261101210000_marketplace_transaction_archive_and_call_auth.sql','utf8');
const attachmentMigration=fs.readFileSync('supabase/migrations/20261119190000_private_chat_media_attachments.sql','utf8');
const attachmentTest=fs.readFileSync('supabase/tests/20261119190000_private_chat_media_attachments.sql','utf8');
const checks = [
  ['direct and marketplace chat attachments use a private participant-only bucket and signed URL rendering',attachmentMigration.includes("VALUES (\n  'chat-attachments'")&&attachmentMigration.includes('public=false')&&attachmentMigration.includes('chat_attachments_read_participants')&&attachmentMigration.includes('chat_attachments_upload_own_folder')&&attachmentMigration.includes('attachment_size BETWEEN 1 AND 52428800')&&html.includes("createSignedUrl(row.attachment_path,3600)")&&html.includes("storage.from('chat-attachments').upload(path,file")],
  ['direct and market composers expose media pickers and voice recording controls',html.includes('id="direct-chat-media-file"')&&html.includes('id="market-chat-media-file"')&&html.includes("toggleChatVoiceRecording('direct')")&&html.includes("toggleChatVoiceRecording('market')")&&html.includes('new MediaRecorder')],
  ['attachment policy tests verify sender, recipient and non-participant access',attachmentTest.includes('PRIVATE_CHAT_ATTACHMENTS=PASS')&&attachmentTest.includes('A non-participant read private chat attachments')&&attachmentTest.includes('Anonymous users read private chat attachments')&&attachmentTest.includes('uploaded into another account folder')],
  ['audio action', 'initiateVoiceCall(\'online\')'],
  ['unsupported local network entry points removed', !html.includes('openAlwahaLocalNetworkPanel') && !html.includes('الشبكة الحرة للأصدقاء القريبين') && !html.includes('إعدادات الشبكة القريبة')],
  ['chat header exposes native nearby Wi-Fi/Bluetooth discovery dialog', html.includes('onclick="openAlwahaLocalDiscovery()"') && html.includes('async function openAlwahaLocalDiscovery()') && html.includes('plugin.startDiscovery()') && html.includes('peerDiscovered')],
  ['discovery-only mode does not claim local messaging, files or calls are ready', html.includes('ولا يتم الاتصال بها أو تبادل رسائل أو ملفات أو مكالمات محلية.') && html.includes('لا يوجد اتصال أو نقل بيانات')],
  ['video action opens the normal/Kids mode chooser', html.includes('onclick="openVideoCallModeChooser()"') && html.includes('function openVideoCallModeChooser()') && html.includes('data-video-call-mode="normal"') && html.includes('data-video-call-mode="kids"')],
  ['overflow menu', 'chat-more-menu'],
  ['profile menu action', 'openCurrentChatProfile()'],
  ['message refresh action', 'loadDirectMessages()'],
  ['privacy information action', 'showChatPrivacyInfo()'],
  ['Bluetooth remains honestly disabled', 'المكالمات عبر البلوتوث لم تُنفذ بعد'],
  ['video camera acquisition', 'getUserMedia({ audio: true, video: videoConstraints })'],
  ['video peer capture preserves aggregated remote tracks', 'this.remoteVideo.srcObject = combined'],
  ['camera switch action', 'switchCallCamera()'],
  ['camera mute action', 'toggleCallCamera()'],
  ['earpiece default route', 'setAlwahaCallSpeaker(false,true)'],
  ['speaker toggle control', 'toggleCallSpeaker()'],
  ['audio route reset on hangup', 'resetAlwahaCallAudioRoute()'],
  ['outgoing media type signaling', 'mediaType:this.mediaType'],
  ['incoming media type', 'payload.mediaType === \'video\''],
  ['queued ICE candidate handshake', 'pendingRoomSignalsToSend'],
  ['queued ICE peer ready', "payload.type==='ready'"],
  ['TURN timeout diagnostic', 'call-config timed out'],
  ['feed render single-flight guard', 'window.__alwahaHomeFeedInFlight'],
  ['feed post request deadline', "alwahaUiDeadline(supabaseFetch('posts?select=*&order=created_at.desc&limit=100'), 9500, null)"],
  ['market inbox has its own UI', 'id="market-conversations-panel"'],
  ['market messages have their own table', 'market_messages'],
  ['direct chat persists reply ids and renders source-message context',html.includes('setDirectMessageReply')&&html.includes('payload.reply_to_id=replyTarget.id')&&html.includes('reply_to_id&or=')],
  ['market chat persists replies within the selected conversation only',html.includes('setMarketMessageReply')&&html.includes('payload.reply_to_id=currentMarketReplyTarget.id')&&html.includes('market_messages?select=id,conversation_id,sender_id,message,created_at,read_at,reply_to_id')],
  ['friend request acceptance sends one notification to the original requester',friendAcceptMigration.includes("NEW.status='accepted'")&&friendAcceptMigration.includes("'friend_request_accepted'")&&friendAcceptMigration.includes('friend_requests_accept_notify_trigger')&&friendAcceptTest.includes('FRIEND_REQUEST_ACCEPTED_NOTIFICATION=PASS')],
  ['accepted friend notification opens chat and marks only that notice read',html.includes('friend_request_accepted')&&html.includes("markSingleNotificationRead('${escapeJs(n.id)}');openTargetUserDirectChat")],
  ['reply RLS prevents cross-pair and cross-conversation references',replyMigration.includes('can_reply_to_direct_message')&&replyMigration.includes('can_reply_to_market_message')&&replyMigration.includes('SECURITY DEFINER SET search_path TO')&&replyTest.includes('Cross-chat direct reply unexpectedly passed RLS')&&replyTest.includes('Cross-conversation market reply unexpectedly passed RLS')],
  ['legacy schemas keep normal sending active while hiding reply controls',html.includes('directReplySchemaAvailable=Array.isArray(rows)')&&html.includes('marketReplySchemaAvailable=Array.isArray(rows)')&&html.includes('if(!Array.isArray(rows))rows=await supabaseFetch')],
  ['market has dedicated chat modal', "modal.id='market-chat-modal'"],
  ['market has separate sender', 'async function sendMarketMessage()'],
  ['market conversation is tied to a listing', 'market_conversations?product_id=eq.'],
  ['market seller welcome message is shown after opening chat', 'input.value=`السلام عليكم، هل ما زال المنتج'],
  ['friend message gate remains', 'hasAcceptedAlwahaFriendship(peerId)'],
  ['notification opens do not auto-clear all unread items', 'markSingleNotificationRead'],
  ['friend request notification actions do not bubble to the parent card', 'event.stopPropagation();respondFriendRequest'],
  ['only the resolved friend request notification is marked read', 'markNotificationsReadSilently(notificationIds)'],
  ['market listing deletion archives instead of deleting', "status:'archived'"],
  ['market conversation list supports the live pre-snapshot schema', 'market_conversations?select=id,product_id,buyer_id,seller_id,created_at&${filter}'],
  ['market snapshots are queried as an optional schema extension', 'market_conversations?id=in.(${idFilter})&select=id,listing_snapshot'],
  ['market message success does not wait for secondary list refresh', 'void renderMarketConversationsList();'],
  ['market call entry uses the existing private conversation-scoped call path without friend gating', html.includes("startAlwahaCall('market','audio'") && html.includes('market-call-room-') && html.includes('market-call-inbox-') && html.includes('webrtc-market-incoming') && html.includes('market_conversations?id=eq.') && !html.includes('مكالمات السوق الصوتية قريبًا')],
  ['market detail page call action is active and routed to callMarketSeller', html.includes('onclick="callMarketSeller(') && html.includes('aria-label="اتصال صوتي موثق بالبائع"') && !html.includes('اتصال صوتي بالبائع — قريبًا')],
  ['market call Realtime policies are private and restricted to actual conversation participants', marketCallMigration.includes('alwaha_market_call_channels_receive') && marketCallMigration.includes('alwaha_market_call_channels_send') && marketCallMigration.includes('realtime.topic()') && marketCallMigration.includes('market_conversations')],
  ['market call uses conversation-scoped realtime', 'market-call-room-'],
  ['market transaction snapshot is used', 'market_transactions?conversation_id'],
  ['transaction sale uses atomic server rpc', "rpc('complete_market_sale'"],
  ['warranty and archive retention are displayed with a seven-day warning grace', 'مهلة 7 أيام كاملة بعد الإشعار'],
  ['video mode chooser offers normal video and Kids Room; Kids Room scene remains visible while remote video buffers', html.includes('onclick="openVideoCallModeChooser()"') && html.includes('function openVideoCallModeChooser()') && html.includes('data-video-call-mode="normal"') && html.includes('data-video-call-mode="kids"') && html.includes('onclick="toggleAlwahaKidsMode()"') && html.includes("kidsBtn.style.display=isVideo&&state==='connected'?'inline-block':'none'") && html.includes('kids-video-fallback') && html.includes('غرفة الواحة جاهزة') && !html.includes("!remoteVideo?.srcObject)")],
  ['local encrypted backup module loaded', 'alwaha-local-vault.js'],
  ['home image picker compresses images before preview', 'compressImageFile(original,1400,.82)'],
  ['home image preview is read locally before any network upload', "reader.readAsDataURL(compressed)"],
  ['home post publishing uploads image to the media bucket and stores its URL', "uploadFileToStorage(imageFile,'posts',{maxBytes:8*1024*1024})"],
  ['home post publishing writes an authenticated posts row', "supabaseFetch('posts',{method:'POST',body:JSON.stringify(payload),prefer:'return=representation'})"],
  ['home post draft remains available after upload or publish failure', 'بقيت المسودة الحالية'],
  ['home post publish prevents duplicate requests', 'window.__alwahaHomePostInFlight=true'],
  ['camera beauty effect only claims live light/softness filtering', "brightness(1.06) saturate(1.18) contrast(.96) blur(.35px)"],
  ['camera artistic filter is an actual preview color filter, not AI conversion', "saturate(1.5) contrast(1.18) brightness(1.05)"],
  ['camera still capture applies the active preview filter to the saved image', 'ctx.filter = appliedFilter'],


  ['image themes persist locally', "safeSet('alwaha_theme',theme)"],
  ['floating navigation group position persists', 'safeSet(FREE_POSITION_KEY,JSON.stringify({x:point.x,y:point.y,orientation:pos}))'],
  ['feed retry state', 'إعادة المحاولة'],
  ['feed no network state', 'لا يوجد اتصال بالإنترنت'],
  ['feed request race guard', 'alwahaHomeFeedRequestId'],
  ['feed authentication has a deadline', 'alwahaUiDeadline(getCurrentAuthUser(), 1400, null)'],
  ['API request timeout covers response body', 'const requestPromise = (async () =>'],
  ['legacy WebView has AbortController fallback', "typeof AbortController === 'function' ? new AbortController() : null"],
];
let failures=0;
for(const [label,needle] of checks){const haystack=(label==='image themes persist locally'||label==='floating navigation group position persists')?experience:html;const ok=typeof needle==='boolean'?needle:haystack.includes(needle);if(!ok){console.error('FAIL:',label);failures++;}else console.log('PASS:',label);}
if(!kids.includes('window.toggleAlwahaKidsMode=open')){console.error('FAIL: kids mode exported handler missing');failures++;}else console.log('PASS: kids mode handler exported by bundled module');
const staticMarkup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,'');
const ids=[...staticMarkup.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
const duplicates=ids.filter((id,i)=>ids.indexOf(id)!==i);
if(duplicates.length){console.error('FAIL: duplicate static IDs:',[...new Set(duplicates)].join(', '));failures++;}
else console.log('PASS: no duplicate static IDs');
const marketSendStart=html.indexOf('async function sendMarketMessage()');
const marketSendEnd=html.indexOf('async function subscribeToMarketConversation()',marketSendStart);
if(marketSendStart<0||marketSendEnd<0||html.slice(marketSendStart,marketSendEnd).includes('hasAcceptedAlwahaFriendship')){console.error('FAIL: market sending must not depend on friend requests');failures++;}
const friendSendStart=html.indexOf('async function sendLiveChatMessageFromUI()');
const friendSendEnd=html.indexOf('async function renderConversationsList()',friendSendStart);
if(friendSendStart<0||friendSendEnd<0||!html.slice(friendSendStart,friendSendEnd).includes('hasAcceptedAlwahaFriendship(peerId)')){console.error('FAIL: friend chat accepted-friendship guard missing');failures++;}
if(!html.includes('data-friend-request-id=\"${escapeJs(friendRequestId)}\"') || !html.includes('status=eq.pending')){console.error('FAIL: friend request response must bind to the pending request and its own notification');failures++;}
const marketContactStart=html.indexOf('async function startMarketSellerChatInternal(');
const marketContactEnd=html.indexOf('async function renderConversationsList()',marketContactStart);
const marketContact=html.slice(marketContactStart,marketContactEnd);
if(marketContact.indexOf('input.value=`السلام عليكم')<0 || marketContact.indexOf('return String(conversation.id)')<marketContact.indexOf('input.value=`السلام عليكم')){console.error('FAIL: seller welcome text must be set after opening chat');failures++;}
if(failures)process.exit(1);
console.log(`Alwaha chat/feed candidate audit passed (${checks.length+1} checks).`);
