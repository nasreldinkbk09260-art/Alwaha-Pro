BEGIN;
INSERT INTO auth.users(id,raw_user_meta_data) VALUES('d1111111-1111-4111-8111-111111111111',
 '{"alwaha_terms_version":"2026-11-15","alwaha_privacy_version":"2026-11-15"}'::jsonb);
DO $assert$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_consents WHERE user_id='d1111111-1111-4111-8111-111111111111' AND terms_version='2026-11-15' AND privacy_version='2026-11-15' AND accepted_at IS NOT NULL) THEN RAISE EXCEPTION 'Current terms/privacy consent was not recorded'; END IF;
 IF has_table_privilege('anon','public.user_consents','SELECT') OR has_table_privilege('authenticated','public.user_consents','SELECT') OR NOT has_table_privilege('service_role','public.user_consents','SELECT') THEN RAISE EXCEPTION 'Consent ledger must be server-only'; END IF;
END;
$assert$;
DO $reject$
BEGIN
 BEGIN
  INSERT INTO auth.users(id,raw_user_meta_data) VALUES('d2222222-2222-4222-8222-222222222222','{}'::jsonb);
  RAISE EXCEPTION 'Consent trigger accepted a signup without current policy versions';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Consent trigger accepted a signup without current policy versions' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE 'Alwaha terms and privacy consent are required%' THEN RAISE; END IF;
 END;
END;
$reject$;
ROLLBACK;
SELECT 'ALWAHA_USER_CONSENT_AUDIT=PASS' AS result;
