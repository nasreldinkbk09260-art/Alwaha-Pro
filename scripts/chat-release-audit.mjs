import fs from 'node:fs';
const html = fs.readFileSync('index.html','utf8');
const experience = fs.readFileSync('alwaha-experience.js','utf8');
const kids = fs.readFileSync('alwaha-kids-room.js','utf8');
const replyMigration=fs.readFileSync('supabase/migrations/20261108120000_real_chat_message_replies.sql','utf8');
const replyTest=fs.readFileSync('supabase/tests/20261108120000_message_reply_scope.sql','utf8');
const checks = [
  ['audio action', 'initiateVoiceCall(\'online\')'],
  ['unsupported local network entry points removed', !html.includes('openAlwahaLocalNetworkPanel') && !html.includes('الشبكة الحرة للأصدقاء القريبين') && !html.includes('إعدادات الشبكة القريبة')],
  ['video action', 'initiateVideoCall()'],
  ['overflow menu', 'chat-more-menu'],
  ['profile menu action', 'openCurrentChatProfile()'],
  ['message refresh action', 'loadDirectMessages()'],
  ['share summary action', 'shareCurrentChat()'],
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
  ['direct chat persists reply ids and renders source-message context',html.includes('setDirectMessageReply')&&html.includes('payload.reply_to_id=currentDirectReplyTarget.id')&&html.includes('reply_to_id&or=')],
  ['market chat persists replies within the selected conversation only',html.includes('setMarketMessageReply')&&html.includes('payload.reply_to_id=currentMarketReplyTarget.id')&&html.includes('market_messages?select=id,conversation_id,sender_id,message,created_at,read_at,reply_to_id')],
  ['reply RLS prevents cross-pair and cross-conversation references',replyMigration.includes('parent.receiver_id=messages.receiver_id')&&replyMigration.includes('parent.conversation_id=market_messages.conversation_id')&&replyTest.includes('Cross-chat direct reply unexpectedly passed RLS')&&replyTest.includes('Cross-conversation market reply unexpectedly passed RLS')],
  ['legacy schemas keep normal sending active while hiding reply controls',html.includes('directReplySchemaAvailable=Array.isArray(rows)')&&html.includes('marketReplySchemaAvailable=Array.isArray(rows)')&&html.includes('if(!Array.isArray(rows))rows=await supabaseFetch')],
  ['market has dedicated chat modal', "modal.id='market-chat-modal'"],
  ['market has separate sender', 'async function sendMarketMessage()'],
  ['market conversation is tied to a listing', 'market_conversations?product_id=eq.'],
  ['market seller welcome message is shown after opening chat', 'input.value=`السلام عليكم، هل ما زال المنتج'],
  ['friend message gate remains', 'hasAcceptedAlwahaFriendship(currentChatUserId)'],
  ['notification opens do not auto-clear all unread items', 'markSingleNotificationRead'],
  ['friend request notification actions do not bubble to the parent card', 'event.stopPropagation();respondFriendRequest'],
  ['only the resolved friend request notification is marked read', 'markNotificationsReadSilently(notificationIds)'],
  ['market listing deletion archives instead of deleting', "status:'archived'"],
  ['market conversation list supports the live pre-snapshot schema', 'market_conversations?select=id,product_id,buyer_id,seller_id,created_at&or='],
  ['market snapshots are queried as an optional schema extension', 'market_conversations?id=in.(${idFilter})&select=id,listing_snapshot'],
  ['market message success does not wait for secondary list refresh', 'void renderMarketConversationsList();'],
  ['market audio call has independent mode', "startAlwahaCall('market','audio'"],
  ['market call uses conversation-scoped realtime', 'market-call-room-'],
  ['market transaction snapshot is used', 'market_transactions?conversation_id'],
  ['transaction sale uses atomic server rpc', "rpc('complete_market_sale'"],
  ['warranty and archive retention are displayed with a seven-day warning grace', 'مهلة 7 أيام كاملة بعد الإشعار'],
  ['kids mode only shown on connected video call', 'kidsModeBtn'],
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
if(friendSendStart<0||friendSendEnd<0||!html.slice(friendSendStart,friendSendEnd).includes('hasAcceptedAlwahaFriendship(currentChatUserId)')){console.error('FAIL: friend chat accepted-friendship guard missing');failures++;}
if(!html.includes('data-friend-request-id=\"${escapeJs(friendRequestId)}\"') || !html.includes('status=eq.pending')){console.error('FAIL: friend request response must bind to the pending request and its own notification');failures++;}
const marketContactStart=html.indexOf('async function startMarketSellerChatInternal(');
const marketContactEnd=html.indexOf('async function renderConversationsList()',marketContactStart);
const marketContact=html.slice(marketContactStart,marketContactEnd);
if(marketContact.indexOf('input.value=`السلام عليكم')<0 || marketContact.indexOf('return String(conversation.id)')<marketContact.indexOf('input.value=`السلام عليكم')){console.error('FAIL: seller welcome text must be set after opening chat');failures++;}
if(failures)process.exit(1);
console.log(`Alwaha chat/feed candidate audit passed (${checks.length+1} checks).`);
