BEGIN;

INSERT INTO public.users (id,first_name,last_name,is_admin,username)
VALUES
  ('e1111111-1111-4111-8111-111111111111','CI Admin','Hidden',true,'ci_admin_hidden'),
  ('e2222222-2222-4222-8222-222222222222','CI Member','Visible',false,'ci_member_visible');

INSERT INTO public.public_profiles (id,first_name,last_name,gender,username)
VALUES
  ('e1111111-1111-4111-8111-111111111111','CI Admin','Hidden','ذكر','ci_admin_hidden'),
  ('e2222222-2222-4222-8222-222222222222','CI Member','Visible','ذكر','ci_member_visible');

DO $assert$
BEGIN
  IF NOT has_function_privilege('authenticated','app_private.can_view_public_profile(uuid)','EXECUTE')
     OR has_function_privilege('anon','app_private.can_view_public_profile(uuid)','EXECUTE')
     OR has_function_privilege('service_role','app_private.can_view_public_profile(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Public directory RLS helper must be executable only by authenticated clients';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='app_private'
      AND p.proname='can_view_public_profile'
      AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']::text[]
  ) THEN
    RAISE EXCEPTION 'Public directory RLS helper must be SECURITY DEFINER with an empty search_path';
  END IF;
END;
$assert$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','e2222222-2222-4222-8222-222222222222',true);

DO $visibility$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.public_profiles
    WHERE id='e1111111-1111-4111-8111-111111111111'
  ) THEN
    RAISE EXCEPTION 'admin profile must not be visible through direct public_profiles RLS';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_directory
    WHERE id='e1111111-1111-4111-8111-111111111111'
  ) THEN
    RAISE EXCEPTION 'admin profile must not be visible through user_directory';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.public_profiles
    WHERE id='e2222222-2222-4222-8222-222222222222'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.user_directory
    WHERE id='e2222222-2222-4222-8222-222222222222'
  ) THEN
    RAISE EXCEPTION 'regular users must remain visible in the public directory';
  END IF;
END;
$visibility$;

RESET ROLE;
ROLLBACK;

SELECT 'PUBLIC_DIRECTORY_ADMIN_PRIVACY=PASS (direct table RLS and user_directory view)' AS result;
