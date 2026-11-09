import fs from 'node:fs';
const fail=(message)=>{console.error('FAIL:',message);process.exitCode=1;};
const pass=(message)=>console.log('PASS:',message);
const html=fs.readFileSync('index.html','utf8');
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
];
for(const [label,ok] of checks)ok?pass(label):fail(label);
if(process.exitCode)process.exit(1);
console.log('MARKETPLACE_BUY_SELL_ACCEPTANCE=PASS ('+checks.length+' checks)');
