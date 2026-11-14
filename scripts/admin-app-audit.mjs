import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const html=read('admin-app/index.html');
const api=read('supabase/functions/admin-api/index.ts');
const cfg=read('supabase/config.toml');
const migration=read('admin-app/supabase/migrations/20261102130000_admin_action_logs_source_recovery.sql');
let checks=0,failed=0;
function check(name,ok){checks++;if(ok)console.log(`PASS: ${name}`);else{failed++;console.error(`FAIL: ${name}`)}}
check('admin app is a separate package identity',read('admin-app/capacitor.config.json').includes('pro.alwaha.admin'));
check('main app identity remains unchanged',read('capacitor.config.json').includes('pro.alwaha.app'));
check('admin frontend invokes the protected Edge Function',html.includes("db.functions.invoke('admin-api'"));
check('admin frontend loads the pinned local Supabase SDK without a runtime CDN dependency',html.includes('<script src="vendor/supabase/supabase.js"></script>')&&!html.includes('cdn.jsdelivr.net/npm/@supabase/supabase-js')&&read('admin-app/build.mjs').includes('adminSupabaseSdkSha256')&&read('admin-app/build.mjs').includes('crypto.createHash'));
check('main app Supabase SDK asset is present for deterministic admin packaging',fs.existsSync('assets/vendor/supabase/supabase.js'));
check('admin frontend does not query privileged tables directly',!(/db\.from\(['"](?:users|verification_requests|admin_action_logs)['"]\)/.test(html)));
check('admin frontend does not embed service-role credentials',!html.includes('SUPABASE_SERVICE_ROLE_KEY')&&!/eyJ[^'"\s]+service_role/.test(html));
check('admin UI includes requests, users and audit-log views',html.includes('requestsPane')&&html.includes('usersPane')&&html.includes('auditPane')&&html.includes("adminApi('list_audit_logs'"));
check('admin UI does not expose local-network controls',!html.includes('شبكة محلية')&&!html.includes('شبكة قريبة')&&!html.includes('toggleFreeMeshShareSystem'));
check('admin API verifies the supplied JWT on the server',api.includes('auth.getUser(token)'));
check('admin API checks users.is_admin server-side',api.includes("select('id,is_admin')")&&api.includes('if (!profile?.is_admin)'));
check('admin API action list is allowlisted and bounded',api.includes('allowedActions')&&api.includes('boundedInteger')&&api.includes('12_000'));
check('admin API records pending/success/denied/error audit outcomes',api.includes("outcome: 'pending'")&&api.includes("finishAudit('success'")&&api.includes("finishAudit('denied'")&&api.includes("finishAudit('error'"));
check('admin Edge Function requires JWT verification in Supabase config',/\[functions\.admin-api\]\s*\nverify_jwt\s*=\s*true/.test(cfg));
check('recovered admin log migration is RLS-locked and service-role-only',migration.includes('ENABLE ROW LEVEL SECURITY')&&migration.includes('REVOKE ALL ON TABLE public.admin_action_logs FROM PUBLIC, anon, authenticated')&&migration.includes('GRANT ALL ON TABLE public.admin_action_logs TO service_role'));
check('admin app build and separate Android workflow exist',fs.existsSync('admin-app/build.mjs')&&fs.existsSync('.github/workflows/build-admin-apk.yml'));
check('admin Android configurator enforces separate package and target API 36',fs.existsSync('admin-app/scripts/configure-android-release.py')&&read('admin-app/scripts/configure-android-release.py').includes('targetSdkVersion')&&read('admin-app/scripts/configure-android-release.py').includes('pro.alwaha.admin'));
check('admin audit-log source migration is included in PostgreSQL CI with privilege regression test',read('scripts/ci-validate-supabase-sql.sh').includes('admin_action_logs_source_recovery.sql')&&fs.existsSync('supabase/tests/20261102130000_admin_action_logs_source_recovery.sql'));

const purgePaths = [...api.matchAll(/"([0-9a-f-]{36}\\/(?:avatars|posts|products|reels)\\/[^"]+)"/g)];
check('test-media cleanup is limited to the exact 18 inventoried orphan paths',purgePaths.length===18);
check('admin cleanup requires a fixed explicit confirmation token',api.includes("body.confirmPurge !== TEST_MEDIA_PURGE_CONFIRMATION")&&api.includes("PURGE_TEST_MEDIA_20261114"));
check('test-media cleanup uses Supabase Storage API, not SQL metadata deletion',api.includes("server.storage.from('media').remove([...TEST_MEDIA_OBJECTS])")&&!/delete\\s+from\\s+storage\\.objects/i.test(api));
check('cleanup stays behind JWT and server-side admin authorization',api.indexOf('auth.getUser(token)')<api.indexOf("server.storage.from('media').remove")&&api.indexOf("if (!profile?.is_admin)")<api.indexOf("server.storage.from('media').remove"));
check('maintenance UI asks for confirmation and calls only the fixed cleanup action',html.includes('purgeTestMedia')&&html.includes('تأكيد نهائي')&&html.includes("adminApi('purge_test_media'"));
check('archive purge and audit-action SQL migrations are committed',fs.existsSync('supabase/migrations/20261114153423_purge_test_legacy_archives_20261114.sql')&&fs.existsSync('supabase/migrations/20261114153527_admin_api_test_media_cleanup_action_20261114.sql'));

console.log(`ADMIN_APP_AUDIT=${failed?'FAIL':'PASS'} (${checks} checks)`);
if(failed)process.exit(1);
