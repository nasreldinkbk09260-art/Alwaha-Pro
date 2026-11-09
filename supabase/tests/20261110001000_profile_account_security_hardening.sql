BEGIN;

DO $$
DECLARE
  v_insert_check text;
  v_update_check text;
  v_directory_view text;
BEGIN
  IF has_table_privilege('authenticated','public.users','DELETE') THEN
    RAISE EXCEPTION 'Authenticated users must not directly DELETE public.users rows.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='users' AND policyname='users_delete_own'
  ) THEN
    RAISE EXCEPTION 'The incomplete users_delete_own policy must be removed.';
  END IF;

  IF has_column_privilege('authenticated','public.verification_requests','status','INSERT')
     OR has_column_privilege('authenticated','public.verification_requests','created_at','INSERT')
     OR has_column_privilege('authenticated','public.verification_requests','reviewed_at','INSERT')
     OR has_column_privilege('authenticated','public.verification_requests','reviewed_by','INSERT')
     OR has_column_privilege('authenticated','public.verification_requests','id','INSERT') THEN
    RAISE EXCEPTION 'Clients must not set verification status, timestamps, reviewer, or identity.';
  END IF;
  IF NOT has_column_privilege('authenticated','public.verification_requests','user_id','INSERT')
     OR NOT has_column_privilege('authenticated','public.verification_requests','reason','INSERT')
     OR NOT has_column_privilege('authenticated','public.verification_requests','category','INSERT') THEN
    RAISE EXCEPTION 'Authenticated users must retain the required verification request insert fields.';
  END IF;

  SELECT with_check INTO v_insert_check
  FROM pg_policies
  WHERE schemaname='public' AND tablename='verification_requests'
    AND policyname='verification_insert_own' AND cmd='INSERT';
  IF v_insert_check IS NULL
     OR position('pending' in v_insert_check)=0
     OR position('reviewed_at IS NULL' in v_insert_check)=0
     OR position('reviewed_by IS NULL' in v_insert_check)=0 THEN
    RAISE EXCEPTION 'Verification inserts must be own-account pending requests with no review metadata.';
  END IF;

  SELECT qual INTO v_update_check
  FROM pg_policies
  WHERE schemaname='public' AND tablename='verification_requests'
    AND policyname='verification_update_admin' AND cmd='UPDATE';
  IF v_update_check IS NULL OR position('app_private.is_admin()' in v_update_check)=0 THEN
    RAISE EXCEPTION 'Only admins may update verification review status.';
  END IF;

  SELECT pg_get_viewdef('public.user_directory'::regclass,true) INTO v_directory_view;
  IF v_directory_view IS NULL
     OR position('NULL::text AS identifier' in v_directory_view)=0
     OR position('NULL::text AS phone' in v_directory_view)=0
     OR NOT (SELECT coalesce(reloptions @> ARRAY['security_invoker=true'],false)
             FROM pg_class WHERE oid='public.user_directory'::regclass) THEN
    RAISE EXCEPTION 'Public user directory must remain security-invoker and must not expose contact details.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='verification_requests'
      AND indexname='verification_one_pending_per_user_idx'
  ) THEN
    RAISE EXCEPTION 'One-pending-verification-request-per-user index is required.';
  END IF;
END;
$$;

COMMIT;
