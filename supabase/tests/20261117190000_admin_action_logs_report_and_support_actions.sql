BEGIN;
DO $$
DECLARE v_definition text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_definition
  FROM pg_constraint
  WHERE conrelid='public.admin_action_logs'::regclass
    AND conname='admin_action_logs_action_check'
    AND contype='c';
  IF v_definition IS NULL THEN RAISE EXCEPTION 'admin action audit allowlist constraint is missing'; END IF;
  FOREACH v_definition IN ARRAY ARRAY[
    'summary','list_users','list_verification_requests','review_verification',
    'list_content_reports','review_content_report','list_support_tickets',
    'review_support_ticket','list_audit_logs','purge_test_media'
  ] LOOP
    IF position(quote_literal(v_definition) IN (
      SELECT pg_get_constraintdef(oid) FROM pg_constraint
      WHERE conrelid='public.admin_action_logs'::regclass AND conname='admin_action_logs_action_check'
    )) = 0 THEN
      RAISE EXCEPTION 'admin audit allowlist is missing action %', v_definition;
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM public.admin_action_logs
    WHERE action NOT IN ('summary','list_users','list_verification_requests','review_verification',
      'list_content_reports','review_content_report','list_support_tickets','review_support_ticket',
      'list_audit_logs','purge_test_media')
  ) THEN RAISE EXCEPTION 'existing admin audit action is outside the supported allowlist'; END IF;
END $$;
ROLLBACK;
