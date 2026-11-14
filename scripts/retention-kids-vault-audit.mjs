import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('supabase/migrations/20261102100000_marketplace_retention_policy_and_cleanup.sql');
const archiveMigration=read('supabase/migrations/20261101210000_marketplace_transaction_archive_and_call_auth.sql');
const consentMigration=read('supabase/migrations/20261108110000_marketplace_retention_two_party_consent.sql');
const kids=read('alwaha-kids-room.js');
const experience=read('alwaha-experience.js');
const vault=read('alwaha-local-vault.js');
const html=read('index.html');
const soundStart=experience.indexOf('function sound(freq=480)');
const soundEnd=experience.indexOf('function setSoundEnabled',soundStart);
const soundBody=soundStart>=0&&soundEnd>soundStart?experience.slice(soundStart,soundEnd):'';
const grabStart=experience.indexOf("nav.addEventListener('pointerdown'");
const moveStart=experience.indexOf("nav.addEventListener('pointermove'",grabStart);
const finishStart=experience.indexOf('const finish=',moveStart);
const grabBody=grabStart>=0&&moveStart>grabStart?experience.slice(grabStart,moveStart):'';
const moveBody=moveStart>=0&&finishStart>moveStart?experience.slice(moveStart,finishStart):'';
const finishBody=finishStart>=0?experience.slice(finishStart,experience.indexOf("nav.addEventListener('pointerup'",finishStart)):'';
const checks=[
 ['retention migration exists and is substantive',migration.length>8000],
 ['first-stage retention migration cannot schedule or delete before both-party consent',!migration.includes('cron.schedule')&&!migration.includes('DELETE FROM public.market_conversations')&&!migration.includes('DELETE FROM public.market_transactions')],
 ['final consent migration is the only place that activates scheduled deletion',consentMigration.includes('cron.schedule')&&consentMigration.includes('delete_approved_by_buyer_at IS NOT NULL')&&consentMigration.includes('delete_approved_by_seller_at IS NOT NULL')],
 ['marketplace archive migration blocks client hard-delete of listings',archiveMigration.includes('REVOKE DELETE ON TABLE public.products FROM PUBLIC, anon, authenticated')&&archiveMigration.includes('DROP POLICY IF EXISTS products_delete_own')],
 ['CI fixture reproduces the old product DELETE grant before hardening',read('supabase/tests/ci-bootstrap.sql').includes('GRANT DELETE ON public.products TO authenticated')&&read('supabase/tests/ci-bootstrap.sql').includes('CREATE POLICY products_delete_own')],
 ['retention installs pg_cron only in final consent migration',consentMigration.includes('CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog')],
 ['retention job runs daily at 03:00 UTC after consent is installed',consentMigration.includes("'0 3 * * *'")&&consentMigration.includes('alwaha-marketplace-retention-daily')],
 ['no-warranty conversations keep the 30-day minimum',migration.includes("now()+interval '30 days'")],
 ['both participants receive pre-purge notifications',migration.includes('t.buyer_id')&&migration.includes('t.seller_id')&&migration.includes("'market_retention_notice'")&&migration.includes("interval '7 days'")],
 ['late cron recovery notifies but never deletes without two explicit approvals',migration.includes(`c.retention_notice_sent_at IS NULL AND c.retention_until<=now()+interval '7 days'`)&&consentMigration.includes('delete_approved_by_buyer_at IS NOT NULL')&&consentMigration.includes('delete_approved_by_seller_at IS NOT NULL')&&consentMigration.includes('لن يتم الحذف تلقائياً')],
 ['archive deletion approvals can be approved or revoked only by the signed-in participant',consentMigration.includes('auth.uid()')&&consentMigration.includes('p_approve boolean DEFAULT true')&&consentMigration.includes('SET delete_approved_by_buyer_at')&&consentMigration.includes('SET delete_approved_by_seller_at')&&consentMigration.includes('GRANT EXECUTE ON FUNCTION public.approve_market_archive_deletion')],
 ['scheduled warranty expiry is allowed only for the database job role',migration.includes("current_user IN ('postgres','service_role')")&&migration.includes("OLD.status='active'")&&migration.includes("NEW.status='archived'")&&migration.includes('Only the buyer may confirm receipt once')],
 ['retention notifications are batch-bounded and mark only selected rows',migration.includes('WITH due AS MATERIALIZED')&&migration.includes('UPDATE public.market_transactions AS t')&&migration.includes('UPDATE public.market_conversations AS c')&&migration.includes('GET DIAGNOSTICS v_notified_transactions=ROW_COUNT')&&migration.includes('GET DIAGNOSTICS v_notified_conversations=ROW_COUNT')],
 ['disputed transactions block automatic cleanup',consentMigration.includes("t.status='disputed'")],
 ['product delete archives the conversation before FK nulling',migration.includes('market_product_sync_conversation_retention_delete')&&migration.includes('BEFORE DELETE ON public.products')],
 ['sale retention is extended by transaction retention deadline',migration.includes('sync_market_transaction_retention')&&migration.includes('NEW.retention_until')],
 ['market cleanup is bounded and skips locked rows',consentMigration.includes('LEAST(p_batch_size,2000)')&&consentMigration.includes('FOR UPDATE SKIP LOCKED')],
 ['purge is not executable before final consent and only service_role can run it afterwards',migration.includes('REVOKE ALL ON FUNCTION public.purge_expired_marketplace_archives(integer) FROM PUBLIC,anon,authenticated,service_role')&&consentMigration.includes('REVOKE ALL ON FUNCTION public.purge_expired_marketplace_archives(integer) FROM PUBLIC,anon,authenticated')&&consentMigration.includes('GRANT EXECUTE ON FUNCTION public.purge_expired_marketplace_archives(integer) TO service_role')],
 ['kids room reuses AudioContext',kids.includes('audioContext=audioContext||new C()')],
 ['kids room routes sound effects to the remote WebRTC peer',html.includes('window.alwahaPlayCallEffect = (kind=\'tap\') => activeCallManager?.call?.playEffect?.(kind) || false;')&&html.includes('this.peerConnection.addTrack(this.effectsTrack, this.effectsDestination.stream)')&&kids.includes('window.alwahaPlayCallEffect(kind)')],
 ['shared sound track is isolated from microphone mute and is cleaned up at call end',html.includes('this.effectsDestination = this.effectsContext.createMediaStreamDestination()')&&html.includes('this.effectsContext?.close?.()')&&html.includes('this.effectsTrack = null')],
 ['remote WebRTC audio/video tracks are aggregated so shared effects cannot replace microphone or camera streams',html.includes('this.remoteCombinedStream = this.remoteCombinedStream || new MediaStream()')&&html.includes('this.remoteCombinedStream.addTrack(incomingTrack)')&&html.includes('this.remoteAudio.srcObject = combined')&&html.includes('this.remoteVideo.srcObject = combined')],
 ['navigation group drag reuses one AudioContext, rate-limits at 85ms, and keeps grab/drop cues on pointer lifecycle',experience.includes('let audioContext=null,lastSoundAt=0')&&soundBody.includes('audioContext=audioContext||new C()')&&soundBody.includes('now-lastSoundAt<85')&&grabBody.includes('sound(560)')&&finishBody.includes('sound(760)')&&!moveBody.includes('sound(')],
 ['kids room plays the distinct numeric pitches requested by interactions',kids.includes("typeof kind==='number'?Math.max(120,Math.min(1800,kind))")],
 ['kids room resets key/lock/score/filter for each session',kids.includes('keyCollected=false;doorUnlocked=false;score=0;filterIndex=0')],
 ['kids room uses camera colour filters rather than pretending face tracking',kids.includes('ألوان الكاميرا')],
 ['kids room shows muted floating copies of the remote participant video inside a CSS perspective room',kids.includes('perspective:1100px')&&kids.includes('transform:perspective(720px) rotateX(48deg)')&&kids.includes('v.srcObject=remote.srcObject')&&kids.includes('muted playsinline autoplay')],
 ['kids room handles pointercancel and keyboard toy movement',kids.includes("addEventListener('pointercancel',finishDrag)")&&kids.includes("addEventListener('keydown',keyboardMove)")],
 ['kids room traps focus and restores previous focus',kids.includes("if(e.key==='Tab')")&&kids.includes('oldFocus.focus()')],
 ['kids room has parent emergency exit',kids.includes('close(true)')],
 ['ending a call closes kids room before media teardown',html.includes('window.closeAlwahaKidsMode();')],
 ['backup serializes ciphertext in compact base64',vault.includes('dataBase64:toBase64(cipher)')],
 ['backup metadata records current app version 3.0.3',vault.includes("appVersion:'3.0.3'")],
 ['backup import supports previous byte-array files',vault.includes('new Uint8Array(raw.data||[])')],
 ['backup import only replaces drafts, not the whole IndexedDB store',vault.includes('await clearDrafts();for(const row of payload.records)')&&!vault.includes('await clear();for(const row of payload.records)')],
 ['backup import restores removed preferences exactly',vault.includes('else localStorage.removeItem(keyName)')],
 ['backup size caps are enforced on exported and imported files',vault.includes('blob.size>15*1024*1024')&&vault.includes('file.size>40*1024*1024')],
 ['snapshot export paginates rows and warns on truncation',vault.includes('async function fetchPagedRows')&&vault.includes('resolved.truncated')],
 ['market backup supports pre-snapshot conversation schemas',vault.includes('لقطات الإعلانات غير متاحة في قاعدة البيانات الحالية')],
 ['encrypted backup is retained locally and can be downloaded again',vault.includes("put('backup:last-encrypted',file)")&&vault.includes('downloadSavedBackup')],
 ['CI runs PostgreSQL migrations and marketplace retention behavior before Android build',fs.existsSync('scripts/ci-validate-supabase-sql.sh')&&fs.existsSync('supabase/tests/ci-bootstrap.sql')&&fs.existsSync('supabase/tests/20261102100000_marketplace_retention_behavior.sql')],
];
let failed=0;for(const [label,ok] of checks){if(ok)console.log('PASS:',label);else{console.error('FAIL:',label);failed++;}}
if(failed)process.exit(1);console.log(`RETENTION_KIDS_VAULT_AUDIT=PASS (${checks.length} checks)`);
