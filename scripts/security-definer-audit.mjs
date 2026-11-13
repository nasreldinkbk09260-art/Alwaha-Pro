import fs from 'node:fs';
import process from 'node:process';

const read=(file)=>fs.readFileSync(file,'utf8');
const migration=read('supabase/migrations/20261113040000_security_definer_api_isolation.sql');
const regression=read('supabase/tests/20261113040000_security_definer_api_isolation.sql');
const triggerMigration=read('supabase/migrations/20261113050000_trigger_definer_empty_search_path.sql');
const triggerRegression=read('supabase/tests/20261113050000_trigger_definer_empty_search_path.sql');
const ci=read('scripts/ci-validate-supabase-sql.sh');
const workflow=read('.github/workflows/build-apk-aab-release.yml');
const html=read('index.html');
const games=read('games.js');
const pkg=JSON.parse(read('package.json'));
let failed=0;
const check=(label,ok)=>{if(ok)console.log('PASS:',label);else{console.error('FAIL:',label);failed++;}};

check('SECURITY DEFINER implementations are isolated in app_private',migration.includes('CREATE SCHEMA IF NOT EXISTS app_private')&&migration.includes('CREATE OR REPLACE FUNCTION app_private.complete_market_sale')&&migration.includes('CREATE OR REPLACE FUNCTION app_private.approve_market_archive_deletion')&&migration.includes('CREATE OR REPLACE FUNCTION app_private.join_game_room'));
check('private schema is not granted to anon or public and is non-creatable by clients',migration.includes('REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated')&&migration.includes('GRANT USAGE ON SCHEMA app_private TO authenticated, service_role'));
check('all private helpers and public wrappers use an empty search_path',((migration.match(/SET search_path TO ''/g)||[]).length)>=11);
check('public business RPCs remain SECURITY INVOKER',migration.includes('CREATE OR REPLACE FUNCTION public.approve_market_archive_deletion')&&migration.includes('CREATE OR REPLACE FUNCTION public.complete_market_sale')&&migration.includes('CREATE OR REPLACE FUNCTION public.join_game_room')&&migration.includes('CREATE OR REPLACE FUNCTION public.can_review_marketplace_product')&&migration.includes('SECURITY INVOKER'));
check('RLS reply and review policies use private helper functions',migration.includes('app_private.can_reply_to_direct_message')&&migration.includes('app_private.can_reply_to_market_message')&&migration.includes('app_private.can_review_marketplace_product'));
check('old public reply helper RPCs are removed',migration.includes('DROP FUNCTION public.can_reply_to_direct_message(bigint,uuid,uuid)')&&migration.includes('DROP FUNCTION public.can_reply_to_market_message(uuid,uuid,uuid)'));
check('SQL regression test blocks exposed SECURITY DEFINER execution',regression.includes('Public SECURITY DEFINER functions remain executable')&&regression.includes('app_private must not be exposed through PostgREST')&&regression.includes('SECURITY INVOKER'));
check('remaining public trigger definer functions also use empty search_path',triggerMigration.includes('ALTER FUNCTION public.handle_auth_user_update() SET search_path TO')&&triggerMigration.includes('ALTER FUNCTION public.sync_reel_like_count() SET search_path TO')&&triggerRegression.includes('Public SECURITY DEFINER functions without empty search_path'));
check('existing frontend RPC entry points remain available',html.includes("supabaseClient.rpc('can_review_marketplace_product'")&&html.includes("rpc/approve_market_archive_deletion")&&html.includes("supabaseClient.rpc('complete_market_sale'")&&games.includes('join_game_room'));
check('Supabase SQL CI applies the migration and regression test',ci.includes('20261113040000_security_definer_api_isolation.sql')&&ci.includes('supabase/tests/20261113040000_security_definer_api_isolation.sql'));
check('Supabase SQL CI applies trigger search_path hardening',ci.includes('20261113050000_trigger_definer_empty_search_path.sql')&&ci.includes('supabase/tests/20261113050000_trigger_definer_empty_search_path.sql')&&workflow.includes('test -s supabase/tests/20261113050000_trigger_definer_empty_search_path.sql'));
check('Android CI validates the migration, test, and audit script',workflow.includes('test -s supabase/migrations/20261113040000_security_definer_api_isolation.sql')&&workflow.includes('test -s supabase/tests/20261113040000_security_definer_api_isolation.sql')&&workflow.includes('test -s scripts/security-definer-audit.mjs'));
check('local release gate runs the security-definer audit',pkg.scripts?.['audit:security-definers']==='node scripts/security-definer-audit.mjs'&&pkg.scripts?.['audit:release']?.includes('audit:security-definers'));

if(failed){console.error('SECURITY_DEFINER_AUDIT=FAIL ('+failed+')');process.exit(1);}
console.log('SECURITY_DEFINER_AUDIT=PASS');
