BEGIN;
DO $$
DECLARE
  v_reason_ok boolean;
  v_priority_ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.content_reports'::regclass
      AND conname='content_reports_reason_check'
      AND pg_get_constraintdef(oid) LIKE '%child_safety%'
  ) INTO v_reason_ok;
  IF NOT v_reason_ok THEN RAISE EXCEPTION 'child_safety report reason is not accepted'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='content_reports'
      AND column_name='priority' AND is_nullable='NO'
  ) INTO v_priority_ok;
  IF NOT v_priority_ok THEN RAISE EXCEPTION 'content report priority is missing'; END IF;
END $$;
ROLLBACK;
