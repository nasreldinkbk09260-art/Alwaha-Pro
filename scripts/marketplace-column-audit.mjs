import fs from 'node:fs';
const fail=(m)=>{console.error('FAIL:',m);process.exitCode=1;};
const html=fs.readFileSync('index.html','utf8');
const grants=fs.readFileSync('supabase/migrations/20261029035135_marketplace_lifecycle_reviews.sql','utf8');
const snapshot=fs.readFileSync('supabase/migrations/20261101210000_marketplace_transaction_archive_and_call_auth.sql','utf8');
const privacy=fs.readFileSync('supabase/migrations/20261102150000_products_seller_email_privacy.sql','utf8');
const workflow=fs.readFileSync('.github/workflows/build-apk-aab-release.yml','utf8');
const runner=fs.readFileSync('scripts/ci-validate-supabase-sql.sh','utf8');
const bootstrap=fs.readFileSync('supabase/tests/ci-bootstrap.sql','utf8');
const grantMatch=grants.match(/GRANT\s+SELECT\s*\(([^)]+)\)\s+ON\s+TABLE\s+public\.products\s+TO\s+anon,\s*authenticated/i);
if(!grantMatch)fail('Explicit product read-column allowlist was not found.');
const allowed=new Set(grantMatch[1].split(',').map(x=>x.trim()).filter(Boolean));
const queries=[...html.matchAll(/products\?[^`"']*?select=([^&`"']+)/g)];
if(!queries.length)fail('No explicit products REST SELECT queries were found.');
for(const [i,m] of queries.entries()){
 const fields=m[1].split(',').map(x=>decodeURIComponent(x.trim()));
 if(fields.includes('*'))fail(`products query ${i+1} requests SELECT *.`);
 for(const field of fields)if(!allowed.has(field))fail(`products query ${i+1} requests ungranted column: ${field}`);
}
for(const forbidden of ['seller_email','archived_at','sold_at','sold_to']){
 const selectPattern=new RegExp(`products\\?[^\\x60"']*?select=[^&\\x60"']*\\b${forbidden}\\b`,'i');
 if(selectPattern.test(html))fail(`Frontend requests restricted product column ${forbidden}.`);
}
if(!privacy.includes('UPDATE public.products SET seller_email=')||!privacy.includes('NEW.seller_email :=')||!privacy.includes('SECURITY INVOKER')||!privacy.includes("SET search_path TO ''"))fail('Seller email privacy migration is incomplete or uses an elevated trigger.');
if(!privacy.includes('REVOKE SELECT (seller_email)'))fail('seller_email column read privilege is not explicitly revoked.');
const snapshotTrigger=snapshot.slice(snapshot.indexOf('CREATE OR REPLACE FUNCTION public.capture_market_conversation_snapshot()'),snapshot.indexOf('CREATE TABLE IF NOT EXISTS public.market_transactions'));
if(!snapshotTrigger||/SELECT\s+\*\s+INTO\s+v_product\s+FROM\s+public\.products/i.test(snapshotTrigger))fail('Invoker listing snapshot trigger uses SELECT * on a column-restricted table.');
for(const col of ['p.id','p.seller_id','p.title','p.price','p.category','p.description','p.image_url','p.image_urls','p.location_label','p.created_at'])if(!snapshot.includes(col))fail(`Listing snapshot does not explicitly select ${col}.`);
if(/GRANT\s+SELECT\s+ON\s+public\.products\s+TO\s+anon,authenticated/i.test(bootstrap))fail('CI bootstrap incorrectly grants full-table product SELECT.');
if(!bootstrap.includes('seller_email text NOT NULL DEFAULT'))fail('CI product fixture lacks the legacy seller_email column.');
for(const test of ['20261102150000_products_seller_email_privacy.sql','20261102160000_marketplace_snapshot_column_privileges.sql'])if(!runner.includes(test))fail(`PostgreSQL CI runner omits ${test}.`);
if(!workflow.includes('npm run audit:marketplace-columns'))fail('Marketplace column permission audit is not wired into release CI.');
if(process.exitCode)process.exit(1);
console.log(`MARKETPLACE_COLUMN_AUDIT=PASS (${queries.length} products queries; explicit least-privilege read allowlist)`);
