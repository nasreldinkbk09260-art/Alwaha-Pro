import fs from 'node:fs';
const fail=(message)=>{console.error('FAIL:',message);process.exitCode=1;};
const pass=(message)=>console.log('PASS:',message);
const html=fs.readFileSync('index.html','utf8');
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
            ['market product edits do not rewrite seller identity and reactivation does not write server-owned sale fields',html.includes("const isEditing=!!editingMarketProductId;\n            const payload={title:name,price,category,description:desc,image_url:imageUrls[0]||''};")&&html.includes('if(!isEditing)payload.seller_id=user.id;')&&!html.includes("status:'active',archived_at:null,sold_at:null,sold_to:null")],
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
 ['my listings display an honest coming-soon state when transaction and warranty schema is absent',html.includes('const marketTransactionsReady=await detectMarketTransactionSchema()')&&html.includes('تسجيل البيع قريبًا')&&html.includes('الضمان قريبًا')],
 ['sale registration fails closed when live transaction schema is absent',html.includes("if(!(await detectMarketTransactionSchema()))return triggerToastNotification('تسجيل البيع والضمان قريبًا")],
 ['sale form rechecks transaction schema before calling the server-authoritative RPC',html.includes("if(!(await detectMarketTransactionSchema()))return triggerToastNotification('تسجيل البيع والضمان قريبًا")&&html.includes("supabaseClient.rpc('complete_market_sale'")],
 ['transaction history displays coming soon instead of a misleading schema error',html.includes("سجل المعاملات والضمان قريبًا. سيظهر بعد اكتمال تحديث قاعدة السوق واعتماد صلاحياته.")],
 ['receipt confirmation and archive consent are gated until their live schema exists',html.includes("تأكيد الاستلام قريبًا حتى يكتمل تحديث سجل المعاملات")&&html.includes("موافقة حذف الأرشيف قريبًا بعد اكتمال تحديث سياسة الاحتفاظ")],
 ['market inbox is a dedicated full-screen modal that blocks the background',html.includes("page.setAttribute('aria-modal','true')")&&html.includes("page.className='alwaha-fullscreen-layer'")&&html.includes("document.body.classList.add('modal-active')")],
 ['market conversation list revalidates the signed-in participant after parallel reads',html.includes('const activeUser=await getCurrentAuthUser();')&&html.includes('activeUser?.id!==me.id')],
 ['opening a market chat revalidates the signed-in participant against the conversation row',html.includes("if(!c||(c.buyer_id!==me.id&&c.seller_id!==me.id))")],
 ['market message sending is single-flight and preserves the draft on failed requests',html.includes('if(marketMessageSendInFlight)return;')&&html.includes('marketMessageSendInFlight=true')&&html.includes("if(input)input.value=''")&&html.includes('بقي النص في خانة الكتابة')],
 ['market realtime subscription is scoped to the active conversation id',html.includes('market-conversation-\${id}')&&html.includes('currentMarketConversationId===id')],
 ['market seller call is explicitly deferred until production Realtime authorization is deployed',html.includes('اتصال صوتي بالبائع — قريبًا')&&html.includes('disabled aria-disabled="true"')&&(()=>{const a=html.indexOf('async function callMarketSeller'),b=html.indexOf('async function updateMarketProductLifecycle',a),s=a>=0&&b>a?html.slice(a,b):'';return s.includes('مكالمات السوق الصوتية قريبًا')&&!s.includes('startAlwahaCall(');})()],
 ['market archive remains a reversible status update, not a frontend hard delete',html.includes("body:JSON.stringify({status:'archived',archived_at:new Date().toISOString()})")&&html.includes('async function reactivateMyProduct')]

];
for(const [label,ok] of checks)ok?pass(label):fail(label);
if(process.exitCode)process.exit(1);
console.log('MARKETPLACE_BUY_SELL_ACCEPTANCE=PASS ('+checks.length+' checks)');
