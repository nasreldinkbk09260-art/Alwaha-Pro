import fs from 'node:fs';
const fail=(message)=>{console.error('FAIL:',message);process.exitCode=1;};
const pass=(message)=>console.log('PASS:',message);
const html=fs.readFileSync('index.html','utf8');
const writeMigration=fs.readFileSync('supabase/migrations/20261113030000_marketplace_chat_notification_column_privileges.sql','utf8');
const writeTest=fs.readFileSync('supabase/tests/20261113030000_marketplace_chat_notification_column_privileges.sql','utf8');
const signStart=html.indexOf('async function signOutAlwaha()');
const signEnd=html.indexOf('async function hydrateAuthProfile',signStart);
const signSlice=signStart>=0&&signEnd>signStart?html.slice(signStart,signEnd):'';
const checks=[
 ['buy view has a live text search and explicit distance filter',html.includes('id="market-search-input"')&&html.includes('oninput="searchProducts()"')&&html.includes('id="market-radius-select"')&&html.includes('onchange="searchProducts(true)"')],
 ['changing the distance filter forces a fresh filtered list rather than hiding existing cards',html.includes('function searchProducts(forceRefresh = false)')&&html.includes('if (forceRefresh || !cards.length)')],
 ['product list responses use a generation guard before the primary result is painted',html.includes('let marketProductsRenderRequestId = 0;')&&html.includes('const requestId=++marketProductsRenderRequestId;')&&html.includes('if(requestId!==marketProductsRenderRequestId)return;')],
 ['legacy market schema fallback also discards stale responses',html.includes('if(requestId!==marketProductsRenderRequestId)return;\n                if(Array.isArray(products))')],
 ['optional buyer location remains opt-in and session-scoped',html.includes('لن تتم مشاركة موقعك إلا إذا اخترت ذلك.')&&html.includes('تم تحديد موقعك لهذه الجلسة فقط')],
 ['product detail, seller contact, call, report and review controls remain connected',html.includes('function openMarketProductDetails')&&html.includes('function contactMarketSeller')&&html.includes('function callMarketSeller')&&html.includes('function reportMarketplaceItem')&&html.includes('function submitMarketplaceReview')],
 ['seller form labels are associated and input lengths are bounded',html.includes('for="prod-name"')&&html.includes('id="prod-name" maxlength="120"')&&html.includes('for="prod-price"')&&html.includes('id="prod-price" maxlength="40"')&&html.includes('for="prod-desc-location"')&&html.includes('maxlength="2000"')],
 ['seller form rejects overlong values before uploads or database writes',html.includes('if(name.length>120||price.length>40||desc.length>2000)')],
 ['image picker limits the gallery to six image files and reports compression failure',html.includes('const remaining=Math.max(0,6-marketMultiFilesArray.length)')&&html.includes("file.type.startsWith('image/')")&&html.includes('Promise.all(candidates.slice(0,remaining)')&&html.includes('تعذر ضغط الصور للرفع')],
 ['seller submit is single-flight and restores button state in finally',html.includes('window.__alwahaMarketProductSubmitInFlight=true')&&html.includes('finally{')&&html.includes('window.__alwahaMarketProductSubmitInFlight=false')],
            ['market product edits do not rewrite seller identity and reactivation does not write server-owned sale fields',html.includes("const isEditing=!!editingMarketProductId;\n            const payload={title:name,price,category,description:desc,image_url:imageUrls[0]||''};")&&html.includes('if(!isEditing)payload.seller_id=user.id;')&&html.includes('if(!isEditing)corePayload.seller_id=user.id;')&&!html.includes('const corePayload={seller_id:user.id')&&!html.includes("status:'active',archived_at:null,sold_at:null,sold_to:null")],
 ['private seller listings guard stale responses and re-check the signed-in user before rendering',html.includes('let marketMyItemsRenderRequestId = 0;')&&html.includes('const requestId=++marketMyItemsRenderRequestId;')&&html.includes('const activeUser=await getCurrentAuthUser();')&&html.includes('activeUser?.id!==me.id')],
 ['sold listings cannot be edited from the seller edit action',html.includes("if(product.status==='sold')return triggerToastNotification('لا يمكن تعديل إعلان تم بيعه")],
 ['seller listing deletion is archival only and requires a confirmation',html.includes("if(!window.confirm('سيتم إخفاء الإعلان من السوق وأرشفته.")&&html.includes("body:JSON.stringify({status:'archived',archived_at:new Date().toISOString()})")],
 ['sold listing snapshot, guarantee and buyer receipt stay in the transaction history',html.includes("rpc('complete_market_sale'")&&html.includes('market_transactions?or=')&&html.includes('confirmMarketTransactionReceipt')],
 ['market chat remains independent from friend-chat gating',(()=>{const start=html.indexOf('async function sendMarketMessage()'),end=html.indexOf('async function subscribeToMarketConversation()',start);return start>=0&&end>start&&!html.slice(start,end).includes('hasAcceptedAlwahaFriendship');})()],
 ['local buyer search includes the product price',html.includes("data-search=\"${escapeHtml(`${prod.title||''} ${prod.price||''}")],
 ['private seller item view clears old results before authentication is checked',html.includes("container.innerHTML='<div style=\"text-align:center;color:#9fb1c8;font-size:11px;padding:10px;\">جارٍ التحقق من حسابك...</div>'")],
 ['sign-out invalidates pending private market requests and clears seller listings',html.includes('marketMyItemsRenderRequestId++;')&&html.includes("privateMarketItems.innerHTML='';")],
 ['seller has one archive action instead of duplicate delete/archive controls',html.includes('إخفاء وأرشفة')&&!html.includes('onclick=\"archiveMyProduct(')],
 ['sold and archived seller controls are status-specific',html.includes("product.status==='sold'?'':`")&&html.includes("product.status==='active'?`")&&html.includes('إعادة نشر')],
 ['sign-out invalidates every pending private market list/message request',signSlice.includes('marketMyItemsRenderRequestId++')&&signSlice.includes('marketConversationsRenderRequestId++')&&signSlice.includes('marketTransactionsRenderRequestId++')&&signSlice.includes('marketMessagesRequestId++')],
 ['sign-out closes the market conversation overlay and full-screen inbox',signSlice.includes('closeMarketConversationChat()')&&signSlice.includes('closeMarketConversationsPage()')],
 ['sign-out clears private market messages, inbox, transactions and seller listings',signSlice.includes("'market-conversations-container'")&&signSlice.includes("'market-transactions-container'")&&signSlice.includes("'market-chat-messages'")&&signSlice.includes("'my-market-items-container'")],
 ['market inbox re-checks current account after parallel data requests',html.includes('const activeUser=await getCurrentAuthUser();\n            if(requestId!==marketConversationsRenderRequestId||activeUser?.id!==me.id)return;')],
 ['market transaction list re-checks current account after the data request',html.includes('if(requestId!==marketTransactionsRenderRequestId||activeUser?.id!==me.id)return;')],
 ['market chat verifies the current account before opening a participant thread',html.includes('if(activeUser?.id!==me.id)return;\n            if(!c||(c.buyer_id!==me.id&&c.seller_id!==me.id))')],
 ['market message list re-checks the account before marking incoming messages read',html.includes('activeUser?.id!==me.id)return;\n            currentMarketMessages=rows;')],
 ['sale registration uses an in-app form instead of browser prompt or confirm',html.includes('function openMarketActionForm')&&html.includes('async function submitMarketActionForm')&&(()=>{const a=html.indexOf('async function markMyProductSold'),b=html.indexOf('async function archiveMyProduct',a),s=html.slice(a,b);return !s.includes('window.prompt')&&!s.includes('window.confirm')&&s.includes("openMarketActionForm('sale'");})()],
 ['sale form only offers buyers with a conversation tied to the seller product',html.includes('market_conversations?product_id=eq.')&&html.includes('data-conversation-id=')&&html.includes('sellerId:me.id')],
 ['sale form validates warranty and keeps server-authoritative completion RPC',html.includes('market-action-guarantee')&&html.includes('guaranteeDays>3650')&&html.includes("rpc('complete_market_sale'")],
 ['reporting uses an in-app form with bounded reason and no browser prompt',(()=>{const a=html.indexOf('async function reportMarketplaceItem'),b=html.indexOf('async function submitMarketplaceReview',a),s=html.slice(a,b);return html.includes('market-action-report-reason')&&s.includes("openMarketActionForm('report'")&&!s.includes('window.prompt');})()],
 ['market action form supports Android back, safe close, and sign-out cancellation',html.includes("const marketActionForm=document.getElementById('market-action-form-modal')")&&html.includes('closeMarketActionForm(true)')&&html.includes('marketActionFormRequestId++')],

 ['seller items list uses seller-scoped explicit columns and guards stale/account-switched responses',html.includes('products?seller_id=eq.')&&html.includes('marketMyItemsRenderRequestId')&&html.includes('activeUser?.id!==me.id')],
 ['sold listings cannot be edited and active listings expose archive rather than hard-delete',html.includes("if(product.status==='sold')return triggerToastNotification('لا يمكن تعديل إعلان تم بيعه")&&html.includes("body:JSON.stringify({status:'archived',archived_at:new Date().toISOString()})")],
 ['archived listings can be republished through the lifecycle update path',html.includes('async function reactivateMyProduct')&&html.includes("status:'active',archived_at:null")],
 ['promotion is scoped through the seller-owned lifecycle update path',html.includes('async function promoteMyProduct')&&html.includes('async function updateMarketProductLifecycle')&&html.includes('seller_id=eq.')],
 ['market transaction schema is probed before sale and retention controls are enabled',html.includes('async function detectMarketTransactionSchema()')&&html.includes("market_transactions?select=id&limit=0")&&html.includes('listing_snapshot,archived_at,retention_until,retention_notice_sent_at')],
 ['my listings keep sale controls visible even when transaction schema checks fail',html.includes('const marketTransactionsReady=await detectMarketTransactionSchema()')&&html.includes('data-transaction-schema=')&&html.includes('تسجيل البيع')&&html.includes('تعذر التحقق من الضمان')&&!/disabled aria-disabled="true"[^>]*onclick="markMyProductSold/.test(html)],
 ['sale registration remains fail-closed with a visible, explicit service error when schema validation fails',html.includes("if(!(await detectMarketTransactionSchema()))return triggerToastNotification('تعذر التحقق من مخطط سجل المعاملات؛ لم يتم تسجيل البيع.','info')")],
 ['sale form rechecks transaction schema before the server-authoritative RPC and explains failure without hiding the action',html.includes("if(!(await detectMarketTransactionSchema()))return triggerToastNotification('تعذر التحقق من مخطط سجل المعاملات؛ لم يتم تسجيل البيع.','info')")&&html.includes("supabaseClient.rpc('complete_market_sale'")],
 ['transaction history stays visible and reports schema validation failure without a coming-soon placeholder',html.includes('id="market-transactions-container"')&&html.includes('تعذر التحقق من مخطط سجل المعاملات. لم يتم تحميل السجل')&&!html.includes('قريبًا')],
 ['receipt confirmation and archive consent keep fail-closed guards with explicit non-success errors',html.includes("تعذر التحقق من مخطط سجل المعاملات؛ لم يتم تأكيد الاستلام.")&&html.includes("تعذر التحقق من مخطط سياسة الاحتفاظ؛ لم يتم تغيير موافقة الأرشيف.")],
 ['market inbox is a dedicated full-screen modal that blocks the background',html.includes("page.setAttribute('aria-modal','true')")&&html.includes("page.className='alwaha-fullscreen-layer'")&&html.includes("document.body.classList.add('modal-active')")],
 ['market conversation list revalidates the signed-in participant after parallel reads',html.includes('const activeUser=await getCurrentAuthUser();')&&html.includes('activeUser?.id!==me.id')],
 ['opening a market chat revalidates the signed-in participant against the conversation row',html.includes("if(!c||(c.buyer_id!==me.id&&c.seller_id!==me.id))")],
 ['market message sending is single-flight and preserves the draft on failed requests',html.includes('if(marketMessageSendInFlight)return;')&&html.includes('marketMessageSendInFlight=true')&&html.includes("if(input)input.value=''")&&html.includes('بقي النص في خانة الكتابة')],
 ['market realtime subscription is scoped to the active conversation id',html.includes('market-conversation-\${id}')&&html.includes('currentMarketConversationId===id')],
 ['market seller call is enabled only through a verified conversation and the authenticated market call path',(()=>{const a=html.indexOf('async function callMarketSeller'),b=html.indexOf('async function updateMarketProductLifecycle',a),s=a>=0&&b>a?html.slice(a,b):'';return s.includes("startAlwahaCall('market','audio'")&&s.includes('market_conversations?')&&s.includes('archived_at=is.null')&&!s.includes('مكالمات السوق الصوتية قريبًا')&&!/disabled aria-disabled="true"[^>]*>[^<]*اتصال صوتي بالبائع/.test(html);})()],
 ['market seller call button is enabled and invokes authenticated handler',html.includes('onclick="callMarketSeller(')&&html.includes('aria-label="اتصال صوتي موثق بالبائع"')&&!html.includes('اتصال صوتي بالبائع — قريبًا')&&!/disabled aria-disabled="true"[^>]*اتصال صوتي بالبائع/.test(html)],
 ['market archive remains a reversible status update, not a frontend hard delete',html.includes("body:JSON.stringify({status:'archived',archived_at:new Date().toISOString()})")&&html.includes('async function reactivateMyProduct')],
 ['friend request creation relies on the database pending default rather than client-controlled status',html.includes("JSON.stringify({requester_id:user.id,target_id:targetId})")&&!html.includes("JSON.stringify({requester_id:user.id,target_id:targetId,status:'pending'})")],
 ['market conversation and message inserts are limited to participant/content columns',writeMigration.includes('REVOKE INSERT ON TABLE public.market_conversations')&&writeMigration.includes('GRANT INSERT (product_id, buyer_id, seller_id)')&&writeMigration.includes('REVOKE INSERT ON TABLE public.market_messages')&&writeMigration.includes('GRANT INSERT (conversation_id, sender_id, message, reply_to_id)')&&writeTest.includes("has_column_privilege('authenticated','public.market_conversations','listing_snapshot','INSERT')")&&writeTest.includes("has_column_privilege('authenticated','public.market_messages','read_at','INSERT')")],
 ['marketplace reports and reviews cannot self-assign moderation or creation timestamps',writeMigration.includes('GRANT INSERT (product_id, seller_id, reporter_id, reason)')&&writeMigration.includes('GRANT INSERT (product_id, seller_id, reviewer_id, rating, review)')&&writeTest.includes("has_column_privilege('authenticated','public.marketplace_reports','status','INSERT')")&&writeTest.includes("has_column_privilege('authenticated','public.marketplace_reviews','created_at','INSERT')")],
 ['notifications can only update the read flag while participant policies remain in place',writeMigration.includes('GRANT UPDATE (is_read) ON TABLE public.notifications TO authenticated')&&writeTest.includes("has_column_privilege('authenticated','public.notifications','title','UPDATE')")&&writeTest.includes("notifications_update_own")]


];


const visibilityChecks = [
 ['profile section starts with the profile menu and puts Waha test tools behind a separate bottom menu action',html.indexOf('id="alwaha-device-suite-menu-button"')>html.indexOf('id="profile-section"')&&html.indexOf('id="alwaha-device-suite"')>html.indexOf('id="alwaha-device-suite-menu-button"')&&html.includes("openSubProfileView('sub-prof-device-suite')")],
 ['the seven-day feature coverage board exposes incomplete and unverified work instead of hiding it',html.includes('id="alwaha-test-coverage-board"')&&['local-pairing-transfer','local-calls','kids-room-safety','share-button-policy','friend-requests-notifications','ringtone-audio','kids-call-room','privacy-account-safety','official-page-video','test-data-retention'].every(id=>html.includes('data-feature-id="'+id+'"'))],
 ['no Arabic coming-soon placeholders remain in the test branch UI',!html.includes('قريبًا')&&!html.includes('قريباً')]
];

const marketCallStart=html.indexOf('async function callMarketSeller(');
const marketCallEnd=html.indexOf('async function updateMarketProductLifecycle(',marketCallStart);
const marketCallBody=marketCallStart>=0&&marketCallEnd>marketCallStart?html.slice(marketCallStart,marketCallEnd):'';
const startCallStart=html.indexOf('async function startAlwahaCall(');
const startCallEnd=html.indexOf('async function initiateVoiceCall(',startCallStart);
const startCallBody=startCallStart>=0&&startCallEnd>startCallStart?html.slice(startCallStart,startCallEnd):'';
const outgoingStart=html.indexOf('async startOutgoing(peerId, mode=');
const outgoingEnd=html.indexOf('async sendCallResult(',outgoingStart);
const outgoingBody=outgoingStart>=0&&outgoingEnd>outgoingStart?html.slice(outgoingStart,outgoingEnd):'';
const inboxStart=html.indexOf('async sendToPeerInbox(payload)');
const inboxEnd=html.indexOf('async startOutgoing(peerId, mode=',inboxStart);
const inboxBody=inboxStart>=0&&inboxEnd>inboxStart?html.slice(inboxStart,inboxEnd):'';
const incomingStart=html.indexOf('async handleIncomingOffer(payload)');
const incomingEnd=html.indexOf('async acceptIncoming()',incomingStart);
const incomingBody=incomingStart>=0&&incomingEnd>incomingStart?html.slice(incomingStart,incomingEnd):'';
const marketCallChecks=[
 ['market call queries a non-archived conversation linked to the selected product and exact buyer/seller pair',marketCallBody.includes('product_id=eq.')&&marketCallBody.includes('archived_at=is.null')&&marketCallBody.includes('buyer_id.eq.')&&marketCallBody.includes('seller_id.eq.')&&marketCallBody.includes('select=id,buyer_id,seller_id,archived_at')],
 ['market call rejects self-calls, stale-account results, missing conversations and participant mismatches',marketCallBody.includes('peerId===me.id')&&marketCallBody.includes('activeUser?.id!==me.id')&&marketCallBody.includes('if(!conversation)')&&marketCallBody.includes('participantId)!==peerId')],
 ['market call starts the existing authenticated market-audio signaling path without friendship gating',marketCallBody.includes("startAlwahaCall('market','audio'")&&startCallBody.includes('const marketMode=mode===\'market\'')&&startCallBody.includes('if (marketMode)')&&startCallBody.includes('else if (!(await hasAcceptedAlwahaFriendship(targetId)))')],
 ['outgoing market offers use the private market inbox event and conversation ID',outgoingBody.includes('mode:market?\'market\':\'online\'')&&outgoingBody.includes('conversationId:this.conversationId||undefined')&&inboxBody.includes("market?'webrtc-market-incoming':'webrtc-incoming'")],
 ['incoming market offers verify both conversation participants before ringing',incomingBody.includes("payload.mode==='market'")&&incomingBody.includes('market_conversations?id=eq.')&&incomingBody.includes('c.buyer_id===this.myId&&c.seller_id===payload.from')],
 ['the disabled market-call placeholder has been removed',!marketCallBody.includes('مكالمات السوق الصوتية قريبًا')&&!html.includes('اتصال صوتي بالبائع — قريبًا')]
];
for(const [label,ok] of marketCallChecks)ok?pass(label):fail(label);

for(const [label,ok] of checks)ok?pass(label):fail(label);
for(const [label,ok] of visibilityChecks)ok?pass(label):fail(label);
if(process.exitCode)process.exit(1);
console.log('MARKETPLACE_BUY_SELL_ACCEPTANCE=PASS ('+checks.length+' checks)');
