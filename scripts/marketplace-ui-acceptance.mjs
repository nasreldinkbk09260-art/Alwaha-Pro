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
];
for(const [label,ok] of checks)ok?pass(label):fail(label);
if(process.exitCode)process.exit(1);
console.log('MARKETPLACE_BUY_SELL_ACCEPTANCE=PASS ('+checks.length+' checks)');
