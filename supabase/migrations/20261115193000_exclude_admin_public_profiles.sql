-- Prevent administrator identities from being listed through public_profiles
-- or the security-invoker user_directory view. Contact fields remain absent.
BEGIN;

CREATE OR REPLACE FUNCTION app_private.can_view_public_profile(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.users AS u
    WHERE u.id = p_profile_id
      AND u.is_admin IS NOT TRUE
  );
$function$;

REVOKE ALL ON FUNCTION app_private.can_view_public_profile(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.can_view_public_profile(uuid) TO authenticated;

DROP POLICY IF EXISTS public_profiles_select_authenticated ON public.public_profiles;
DROP POLICY IF EXISTS public_profiles_select_non_admin_authenticated ON public.public_profiles;
CREATE POLICY public_profiles_select_non_admin_authenticated
  ON public.public_profiles
  FOR SELECT
  TO authenticated
  USING (app_private.can_view_public_profile(id));

COMMIT;
