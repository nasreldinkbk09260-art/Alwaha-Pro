BEGIN;
INSERT INTO public.app_settings(key,value)
VALUES ('initial_admin_email','owner-admin@example.invalid')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
VALUES (
 'a7000000-0000-4000-8000-000000000001',
 'owner-admin@example.invalid',NULL,
 '{"alwaha_terms_version":"2026-11-15","alwaha_privacy_version":"2026-11-15","username":"admin_gate_pending"}'::jsonb
);
DO $pending$
BEGIN
 IF (SELECT is_admin FROM public.users WHERE id='a7000000-0000-4000-8000-000000000001') IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'Configured but unconfirmed email was granted admin privileges';
 END IF;
END
$pending$;
UPDATE auth.users SET email_confirmed_at=now()
WHERE id='a7000000-0000-4000-8000-000000000001';
DO $confirmed$
BEGIN
 IF (SELECT is_admin FROM public.users WHERE id='a7000000-0000-4000-8000-000000000001') IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Confirmed configured admin email was not granted admin privileges';
 END IF;
END
$confirmed$;
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
VALUES (
 'a7000000-0000-4000-8000-000000000002',
 'ordinary-user@example.invalid',now(),
 '{"alwaha_terms_version":"2026-11-15","alwaha_privacy_version":"2026-11-15","username":"admin_gate_ordinary"}'::jsonb
);
DO $ordinary$
BEGIN
 IF (SELECT is_admin FROM public.users WHERE id='a7000000-0000-4000-8000-000000000002') IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'Ordinary confirmed email was granted admin privileges';
 END IF;
END
$ordinary$;
UPDATE auth.users SET phone='+15551234567'
WHERE id='a7000000-0000-4000-8000-000000000001';
DO $sticky$
BEGIN
 IF (SELECT is_admin FROM public.users WHERE id='a7000000-0000-4000-8000-000000000001') IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Existing admin privilege was unexpectedly removed';
 END IF;
END
$sticky$;
ROLLBACK;
SELECT 'INITIAL_ADMIN_EMAIL_VERIFICATION=PASS' AS result;
