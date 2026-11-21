BEGIN;

INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
VALUES
 ('c4100000-0000-4000-8000-000000000001','mesh-a@example.invalid',now(),'{}'::jsonb),
 ('c4100000-0000-4000-8000-000000000002','mesh-b@example.invalid',now(),'{}'::jsonb);

DO $schema$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname='public' AND tablename='alwaha_mesh_public_keys'
  ) THEN
    RAISE EXCEPTION 'Mesh public key directory table is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='alwaha_mesh_public_keys' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Mesh public key directory must enforce RLS';
  END IF;
  IF has_table_privilege('anon','public.alwaha_mesh_public_keys','SELECT')
     OR has_table_privilege('anon','public.alwaha_mesh_public_keys','INSERT')
     OR has_table_privilege('anon','public.alwaha_mesh_public_keys','UPDATE')
     OR has_table_privilege('authenticated','public.alwaha_mesh_public_keys','UPDATE')
     OR has_table_privilege('authenticated','public.alwaha_mesh_public_keys','DELETE')
     OR NOT has_table_privilege('authenticated','public.alwaha_mesh_public_keys','SELECT')
     OR NOT has_table_privilege('authenticated','public.alwaha_mesh_public_keys','INSERT')
     OR NOT has_column_privilege('authenticated','public.alwaha_mesh_public_keys','ecdh_public_key','UPDATE')
     OR NOT has_column_privilege('authenticated','public.alwaha_mesh_public_keys','signing_public_key','UPDATE')
     OR has_column_privilege('authenticated','public.alwaha_mesh_public_keys','user_id','UPDATE') THEN
    RAISE EXCEPTION 'Mesh public key directory grants are not least-privilege';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='alwaha_mesh_public_keys'
      AND policyname='alwaha_mesh_public_keys_select_authenticated'
      AND cmd='SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='alwaha_mesh_public_keys'
      AND policyname='alwaha_mesh_public_keys_insert_own'
      AND cmd='INSERT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='alwaha_mesh_public_keys'
      AND policyname='alwaha_mesh_public_keys_update_own'
      AND cmd='UPDATE'
  ) THEN
    RAISE EXCEPTION 'Mesh public key directory RLS policies are missing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='alwaha_mesh_public_keys'
      AND column_name IN ('email','phone','device_name','device_id','private_key','bridge_name','bridge_fingerprint')
  ) THEN
    RAISE EXCEPTION 'Mesh public key directory must not store PII, device metadata or private keys';
  END IF;
END;
$schema$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','c4100000-0000-4000-8000-000000000001',true);

INSERT INTO public.alwaha_mesh_public_keys(user_id,protocol_version,ecdh_public_key,signing_public_key)
VALUES ('c4100000-0000-4000-8000-000000000001',1,repeat('A',87),repeat('B',87));

DO $self_insert$
DECLARE
  blocked boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.alwaha_mesh_public_keys(user_id,protocol_version,ecdh_public_key,signing_public_key)
    VALUES ('c4100000-0000-4000-8000-000000000002',1,repeat('C',87),repeat('D',87));
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'An authenticated user inserted a public key for another account';
  END IF;
END;
$self_insert$;

DO $read$
BEGIN
  IF (SELECT count(*) FROM public.alwaha_mesh_public_keys) <> 1 THEN
    RAISE EXCEPTION 'Authenticated users must be able to read the account key directory';
  END IF;
END;
$read$;

DO $update$
DECLARE affected integer;
BEGIN
  UPDATE public.alwaha_mesh_public_keys
     SET ecdh_public_key=repeat('E',87),updated_at=now()
   WHERE user_id='c4100000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Owner could not rotate their own public key'; END IF;

  UPDATE public.alwaha_mesh_public_keys
     SET ecdh_public_key=repeat('F',87)
   WHERE user_id='c4100000-0000-4000-8000-000000000002';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'User updated another account public key'; END IF;
END;
$update$;

DO $protected_identity$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    UPDATE public.alwaha_mesh_public_keys
       SET user_id='c4100000-0000-4000-8000-000000000002'
     WHERE user_id='c4100000-0000-4000-8000-000000000001';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Account key ownership must not be mutable'; END IF;
END;
$protected_identity$;

RESET ROLE;
ROLLBACK;

SELECT 'ALWAHA_MESH_PUBLIC_KEYS_RLS=PASS' AS result;
