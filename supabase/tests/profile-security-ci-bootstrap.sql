-- CI-only profile/auth schema fixture. Never applied to a Supabase project.
CREATE SCHEMA IF NOT EXISTS app_private;

-- public.users is created once in ci-bootstrap.sql for shared test fixtures.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
INSERT INTO public.users (id,first_name,hide_email,hide_phone)
VALUES ('11111111-1111-4111-8111-111111111111','CI Privacy Fixture',false,false);
GRANT SELECT,DELETE ON public.users TO authenticated;
GRANT UPDATE (avatar_url,birthdate,first_name,gender,hide_email,hide_phone,last_name,phone)
  ON public.users TO authenticated;
CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated USING ((SELECT auth.uid())=id);
CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated USING ((SELECT auth.uid())=id)
  WITH CHECK ((SELECT auth.uid())=id);
CREATE POLICY users_delete_own ON public.users
  FOR DELETE TO authenticated USING ((SELECT auth.uid())=id);

-- Existing public helper present before the API-isolation migration.
CREATE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$ SELECT EXISTS (
  SELECT 1 FROM public.users AS u
  WHERE u.id=(SELECT auth.uid()) AND u.is_admin IS TRUE
) $function$;


CREATE OR REPLACE FUNCTION public.handle_auth_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $fixture$
BEGIN
  RETURN NEW;
END;
$fixture$;
REVOKE ALL ON FUNCTION public.handle_auth_user_update() FROM PUBLIC, anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $fixture$
BEGIN
  RETURN NEW;
END;
$fixture$;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $fixture$
BEGIN
  RETURN NEW;
END;
$fixture$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.handle_verification_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $fixture$
BEGIN
  RETURN NEW;
END;
$fixture$;
REVOKE ALL ON FUNCTION public.handle_verification_status() FROM PUBLIC, anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $fixture$
BEGIN
  RETURN NEW;
END;
$fixture$;
REVOKE ALL ON FUNCTION public.notify_on_comment() FROM PUBLIC, anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $fixture$
BEGIN
  RETURN NEW;
END;
$fixture$;
REVOKE ALL ON FUNCTION public.notify_on_follow() FROM PUBLIC, anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.notify_on_friend_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $fixture$
BEGIN
  RETURN NEW;
END;
$fixture$;
REVOKE ALL ON FUNCTION public.notify_on_friend_request() FROM PUBLIC, anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $fixture$
BEGIN
  RETURN NEW;
END;
$fixture$;
REVOKE ALL ON FUNCTION public.notify_on_like() FROM PUBLIC, anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $fixture$
BEGIN
  RETURN NEW;
END;
$fixture$;
REVOKE ALL ON FUNCTION public.notify_on_message() FROM PUBLIC, anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.sync_post_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $fixture$
BEGIN
  RETURN NEW;
END;
$fixture$;
REVOKE ALL ON FUNCTION public.sync_post_like_count() FROM PUBLIC, anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.sync_public_profile_directory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $fixture$
BEGIN
  RETURN NEW;
END;
$fixture$;
REVOKE ALL ON FUNCTION public.sync_public_profile_directory() FROM PUBLIC, anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.sync_reel_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $fixture$
BEGIN
  RETURN NEW;
END;
$fixture$;
REVOKE ALL ON FUNCTION public.sync_reel_like_count() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION app_private.is_admin() RETURNS boolean
LANGUAGE sql STABLE
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.users AS u
  WHERE u.id=(SELECT auth.uid()) AND u.is_admin IS TRUE
) $$;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_admin() TO authenticated;

CREATE TABLE public.verification_requests (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  phone text,
  avatar_url text,
  category text NOT NULL DEFAULT 'شخصي',
  profile_url text,
  extra_details text
);
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.verification_requests TO authenticated;
GRANT INSERT (id,user_id,reason,status,created_at,reviewed_at,reviewed_by,phone,avatar_url,category,profile_url,extra_details)
  ON public.verification_requests TO authenticated;
GRANT UPDATE (status,reviewed_at,reviewed_by) ON public.verification_requests TO authenticated;
CREATE POLICY verification_insert_own ON public.verification_requests
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=user_id);
CREATE POLICY verification_select_own_or_admin ON public.verification_requests
  FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id OR app_private.is_admin());
CREATE POLICY verification_update_admin ON public.verification_requests
  FOR UPDATE TO authenticated USING (app_private.is_admin()) WITH CHECK (app_private.is_admin());
CREATE UNIQUE INDEX verification_one_pending_per_user_idx
  ON public.verification_requests(user_id) WHERE status='pending';

-- Model the deployed public_profiles TABLE (not a view) so its RLS can be
-- exercised directly by the public-directory privacy regression test.
CREATE TABLE public.public_profiles (
  id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  avatar_url text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  gender text NOT NULL DEFAULT 'ذكر',
  username text NOT NULL DEFAULT ''
);
INSERT INTO public.public_profiles(id,first_name,last_name,avatar_url,is_verified,created_at,gender,username)
SELECT id,first_name,last_name,avatar_url,is_verified,created_at,gender,coalesce(username,'')
FROM public.users;
ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.public_profiles TO authenticated;
CREATE POLICY public_profiles_select_authenticated ON public.public_profiles
  FOR SELECT TO authenticated USING (true);
CREATE VIEW public.user_directory WITH (security_invoker=true) AS
SELECT id,first_name,last_name,NULL::text AS identifier,NULL::text AS phone,
       avatar_url,is_verified,created_at,gender,username
FROM public.public_profiles;
GRANT SELECT ON public.user_directory TO authenticated;
