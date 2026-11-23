import fs from 'node:fs';
const migration=fs.readFileSync('supabase/migrations/20261118180810_split_anon_public_content_policies.sql','utf8');
const test=fs.readFileSync('supabase/tests/20261118180810_split_anon_public_content_policies.sql','utf8');
const fail=m=>{console.error('FAIL:',m);process.exitCode=1;};
const pass=m=>console.log('PASS:',m);
for (const table of ['posts','reels','comments']) {
 const anon=new RegExp('CREATE POLICY '+table+'_select_anon\\s+ON public\\.'+table+'\\s+FOR SELECT TO anon\\s+USING \\(true\\)','i');
 const authed=new RegExp('CREATE POLICY '+table+'_select_authenticated\\s+ON public\\.'+table+'\\s+FOR SELECT TO authenticated[\\s\\S]{0,240}app_private\\.is_user_blocked','i');
 if(anon.test(migration))pass(table+': anon policy has no private helper');else fail(table+': anon policy missing or not public-only');
 if(authed.test(migration))pass(table+': authenticated block filter preserved');else fail(table+': authenticated block filter missing');
}
if(test.includes("has_function_privilege('anon','app_private.is_user_blocked(uuid,uuid)','EXECUTE')")&&test.includes("has_schema_privilege('anon','app_private','USAGE')")&&test.includes('Blocked author post remained visible')&&test.includes('Anonymous role cannot read public posts'))pass('SQL test covers role isolation and actual row visibility');else fail('SQL regression coverage incomplete');
if(migration.includes('GRANT EXECUTE')||migration.includes('GRANT USAGE ON SCHEMA app_private'))fail('No grants to expose the private helper');else pass('No private-schema privilege expansion');
if(process.exitCode)throw new Error('Public content anonymous-policy audit failed.');
console.log('PUBLIC_CONTENT_ANON_POLICY_AUDIT=PASS');
