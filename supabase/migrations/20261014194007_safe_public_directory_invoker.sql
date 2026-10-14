-- Alwaha-Pro privacy hardening: publish only selected profile fields using invoker rights.
BEGIN;
CREATE TABLE IF NOT EXISTS public.public_profiles (
  id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  avatar_url text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  gender text NOT NULL DEFAULT 'ذكر',
  username text NOT NULL
);
ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.public_profiles TO authenticated;
DROP POLICY IF EXISTS public_profiles_select_authenticated ON public.public_profiles;
CREATE POLICY public_profiles_select_authenticated ON public.public_profiles FOR SELECT TO authenticated USING (true);
CREATE OR REPLACE FUNCTION public.sync_public_profile_directory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM public.public_profiles WHERE id = OLD.id; RETURN OLD; END IF;
  INSERT INTO public.public_profiles (id, first_name, last_name, avatar_url, is_verified, created_at, gender, username)
  VALUES (NEW.id, coalesce(NEW.first_name, ''), coalesce(NEW.last_name, ''), NEW.avatar_url,
          coalesce(NEW.is_verified, false), coalesce(NEW.created_at, now()), coalesce(NEW.gender, 'ذكر'), coalesce(NEW.username, ''))
  ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
    avatar_url = EXCLUDED.avatar_url, is_verified = EXCLUDED.is_verified, created_at = EXCLUDED.created_at,
    gender = EXCLUDED.gender, username = EXCLUDED.username;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.sync_public_profile_directory() FROM PUBLIC, anon, authenticated;
INSERT INTO public.public_profiles (id, first_name, last_name, avatar_url, is_verified, created_at, gender, username)
SELECT id, coalesce(first_name, ''), coalesce(last_name, ''), avatar_url, coalesce(is_verified, false),
       coalesce(created_at, now()), coalesce(gender, 'ذكر'), coalesce(username, '') FROM public.users
ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
  avatar_url = EXCLUDED.avatar_url, is_verified = EXCLUDED.is_verified, created_at = EXCLUDED.created_at,
  gender = EXCLUDED.gender, username = EXCLUDED.username;
DROP TRIGGER IF EXISTS users_sync_public_profile_directory ON public.users;
CREATE TRIGGER users_sync_public_profile_directory AFTER INSERT OR UPDATE OF first_name, last_name, avatar_url, is_verified, created_at, gender, username
ON public.users FOR EACH ROW EXECUTE FUNCTION public.sync_public_profile_directory();
CREATE OR REPLACE VIEW public.user_directory WITH (security_invoker = true) AS
SELECT id, first_name, last_name, NULL::text AS identifier, NULL::text AS phone,
       avatar_url, is_verified, created_at, gender, username FROM public.public_profiles;
REVOKE ALL PRIVILEGES ON public.user_directory FROM PUBLIC, anon;
GRANT SELECT ON public.user_directory TO authenticated;
COMMIT;
