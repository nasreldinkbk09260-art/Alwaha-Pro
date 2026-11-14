-- Verification submissions may contain only user-provided fields; review state stays server/admin controlled.
DO $test$
BEGIN
  IF has_table_privilege('authenticated', 'public.verification_requests', 'INSERT') THEN
    RAISE EXCEPTION 'verification_requests must not expose table-wide INSERT';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.verification_requests', 'user_id', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.verification_requests', 'reason', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.verification_requests', 'phone', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.verification_requests', 'category', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.verification_requests', 'profile_url', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.verification_requests', 'extra_details', 'INSERT')
     OR has_column_privilege('authenticated', 'public.verification_requests', 'status', 'INSERT')
     OR has_column_privilege('authenticated', 'public.verification_requests', 'reviewed_at', 'INSERT')
     OR has_column_privilege('authenticated', 'public.verification_requests', 'reviewed_by', 'INSERT')
     OR has_column_privilege('authenticated', 'public.verification_requests', 'created_at', 'INSERT')
     OR has_column_privilege('authenticated', 'public.verification_requests', 'id', 'INSERT') THEN
    RAISE EXCEPTION 'verification_requests INSERT column grants are not least-privilege';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='verification_requests'
      AND policyname='verification_insert_own'
      AND cmd='INSERT'
  ) THEN
    RAISE EXCEPTION 'verification_insert_own RLS policy is missing';
  END IF;
END;
$test$;
