BEGIN;
ALTER TABLE public.admin_action_logs
  DROP CONSTRAINT IF EXISTS admin_action_logs_action_check;
ALTER TABLE public.admin_action_logs
  ADD CONSTRAINT admin_action_logs_action_check
  CHECK (action IN (
    'summary',
    'list_users',
    'list_verification_requests',
    'review_verification',
    'list_content_reports',
    'review_content_report',
    'list_support_tickets',
    'review_support_ticket',
    'list_audit_logs',
    'purge_test_media'
  ));
COMMIT;
