BEGIN;

DO $$
DECLARE
  v_users_nullable boolean;
  v_public_profiles_nullable boolean;
  v_auth_trigger_definition text;
  v_profile_trigger_definition text;
BEGIN
  SELECT is_nullable = 'YES' INTO v_users_nullable
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='users' AND column_name='gender';

  SELECT is_nullable = 'YES' INTO v_public_profiles_nullable
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='public_profiles' AND column_name='gender';

  IF v_users_nullable IS DISTINCT FROM true OR v_public_profiles_nullable IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Gender must allow NULL in both private and public profile tables.';
  END IF;

  IF (SELECT column_default FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' AND column_name='gender') IS NOT NULL
     OR (SELECT column_default FROM information_schema.columns
      WHERE table_schema='public' AND table_name='public_profiles' AND column_name='gender') IS NOT NULL THEN
    RAISE EXCEPTION 'Gender must not silently default to a selected value.';
  END IF;

  SELECT pg_get_functiondef('public.handle_new_auth_user()'::regprocedure)
    INTO v_auth_trigger_definition;
  IF position('ELSE NULL' in v_auth_trigger_definition)=0 THEN
    RAISE EXCEPTION 'Auth signup trigger must preserve an unselected gender as NULL.';
  END IF;

  SELECT pg_get_functiondef('public.sync_public_profile_directory()'::regprocedure)
    INTO v_profile_trigger_definition;
  IF position('NEW.gender' in v_profile_trigger_definition)=0
     OR position('COALESCE(NEW.gender' in upper(v_profile_trigger_definition))>0 THEN
    RAISE EXCEPTION 'Public profile sync must carry the nullable gender without a default.';
  END IF;
END;
$$;

INSERT INTO auth.users (id, email, phone, raw_user_meta_data)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  'user.gender.optional@auth.alwaha.invalid',
  NULL,
  jsonb_build_object(
    'username','gender_optional_fixture',
    'first_name','Gender Optional Fixture',
    'last_name','',
    'gender',NULL,
    'birthdate',NULL,
    'phone','',
    'hide_email',true,
    'hide_phone',true,
    'alwaha_terms_version','2026-11-15',
    'alwaha_privacy_version','2026-11-15'
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id='22222222-2222-4222-8222-222222222222' AND gender IS NULL
  ) THEN
    RAISE EXCEPTION 'Signup without a gender selection must store NULL.';
  END IF;
END;
$$;

INSERT INTO public.public_profiles
  (id, first_name, last_name, gender, username)
SELECT id, first_name, last_name, gender, username
FROM public.users
WHERE id='22222222-2222-4222-8222-222222222222'
ON CONFLICT (id) DO UPDATE SET gender=EXCLUDED.gender;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_directory
    WHERE id='22222222-2222-4222-8222-222222222222' AND gender IS NULL
  ) THEN
    RAISE EXCEPTION 'Public directory must preserve an unselected gender as NULL.';
  END IF;
END;
$$;

ROLLBACK;
