-- Add the narrowly scoped test-media cleanup operation to the admin audit action allowlist.
-- The Edge Function hard-codes the 18 orphaned test object paths and requires a JWT + users.is_admin.
ALTER TABLE public.admin_action_logs
  DROP CONSTRAINT IF EXISTS admin_action_logs_action_check;

ALTER TABLE public.admin_action_logs
  ADD CONSTRAINT admin_action_logs_action_check
  CHECK (action = ANY (ARRAY[
    'summary'::text,
    'list_users'::text,
    'list_verification_requests'::text,
    'review_verification'::text,
    'list_audit_logs'::text,
    'purge_test_media'::text
  ]));
