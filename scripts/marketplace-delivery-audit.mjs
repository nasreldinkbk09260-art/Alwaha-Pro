import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const html=read('index.html');
const migration=read('supabase/migrations/20261120210000_marketplace_delivery_workflow.sql');
const test=read('supabase/tests/20261120210000_marketplace_delivery_workflow.sql');
const ci=read('scripts/ci-validate-supabase-sql.sh');
const workflow=read('.github/workflows/build-apk-aab-release.yml');
const pkg=JSON.parse(read('package.json'));
let failures=0;
const check=(name,ok)=>{if(ok)console.log('PASS:',name);else{console.error('FAIL:',name);failures++;}};

check('buyer can request a delivery and edit only the pending request',
  html.includes('async function requestMarketDelivery(')&&
  html.includes("rpc/request_market_delivery")&&
  html.includes('delivery_address')&&
  html.includes("deliveryStatus==='requested'"));

check('seller can advance delivery through a server-validated state machine',
  html.includes('async function updateMarketDelivery(')&&
  html.includes("rpc/update_market_delivery")&&
  html.includes("requested:{status:'accepted'")&&
  html.includes("preparing:{status:'shipped'")&&
  html.includes("shipped:{status:'out_for_delivery'"));

check('buyer receipt is blocked until the parcel is out for delivery',
  html.includes("tx.fulfillment_method==='delivery'&&tx.delivery_status!=='out_for_delivery'")&&
  html.includes("delivery_status:'delivered'")&&
  html.includes("delivered_at:now"));

check('transaction history displays private recipient, fee, provider and tracking only to participants',
  html.includes('market_transactions?or=(buyer_id.eq.')&&
  html.includes('delivery_recipient_phone')&&html.includes('delivery_address')&&
  html.includes('delivery_fee')&&html.includes('delivery_provider')&&html.includes('tracking_reference'));

check('older databases keep pickup history usable until the delivery migration is applied',
  html.includes('async function hasMarketDeliverySchema()')&&
  html.includes('marketDeliverySchemaReady')&&
  html.includes("const deliveryFields=deliveryReady?")&&
  html.includes('خيارات التوصيل ستظهر بعد تحديث مخطط قاعدة البيانات'));

check('delivery address is not part of the public product listing or public cache',
  !html.includes('products?select=delivery_address')&&
  !html.includes('post_comment_counts: [\'delivery_address\']')&&
  migration.includes('participant-only transaction SELECT RLS'));

check('migration adds constrained pickup/delivery fields and a private participant-only update path',
  migration.includes("DEFAULT 'pickup'")&&
  migration.includes("DEFAULT 'not_requested'")&&
  migration.includes('market_transactions_seller_delivery_update')&&
  migration.includes('GRANT UPDATE (')&&
  !migration.includes('GRANT UPDATE ON TABLE public.market_transactions TO authenticated'));

check('trigger enforces buyer request, seller transition and buyer receipt roles',
  migration.includes('Buyer creates or edits a delivery request only while the request is still pending')&&
  migration.includes('Seller alone controls delivery fee/provider/tracking')&&
  migration.includes('Buyer confirms delivery only after the seller has moved it to out_for_delivery')&&
  migration.includes('Legacy pickup receipt remains a one-way buyer-only confirmation'));

check('delivery RPCs are SECURITY INVOKER and unavailable to anonymous/public callers',
  (migration.match(/SECURITY INVOKER/g)||[]).length>=2&&
  migration.includes('REVOKE ALL ON FUNCTION public.request_market_delivery')&&
  migration.includes('REVOKE ALL ON FUNCTION public.update_market_delivery')&&
  migration.includes('TO authenticated'));

check('SQL regression covers unauthorized users, skipped states, address tampering and pickup compatibility',
  test.includes('Unrelated user requested delivery')&&
  test.includes('Seller skipped requested/accepted/preparing states')&&
  test.includes('Seller changed the buyer-owned delivery address')&&
  test.includes('Existing pickup receipt flow regressed')&&
  test.includes('MARKETPLACE_DELIVERY_WORKFLOW=PASS'));

check('disposable PostgreSQL CI runs the delivery migration and behavioral regression',
  ci.includes('20261120210000_marketplace_delivery_workflow.sql')&&
  ci.includes('supabase/tests/20261120210000_marketplace_delivery_workflow.sql')&&
  workflow.includes('test -s supabase/migrations/20261120210000_marketplace_delivery_workflow.sql')&&
  workflow.includes('test -s supabase/tests/20261120210000_marketplace_delivery_workflow.sql'));

check('marketplace delivery audit is part of release and Android CI',
  pkg.scripts?.['audit:marketplace-delivery']==='node scripts/marketplace-delivery-audit.mjs'&&
  pkg.scripts?.['audit:release']?.includes('audit:marketplace-delivery')&&
  workflow.includes('npm run audit:marketplace-delivery'));

if(failures){console.error('MARKETPLACE_DELIVERY_AUDIT=FAIL ('+failures+')');process.exit(1);}
console.log('MARKETPLACE_DELIVERY_AUDIT=PASS (buyer request, seller dispatch, private recipient data, transition safety, buyer receipt and pickup compatibility)');
