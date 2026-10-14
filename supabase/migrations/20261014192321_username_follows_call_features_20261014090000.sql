-- Alwaha-Pro 2.8.5: usernames, safe directory extension, follows, and private signup throttling.
-- Review migration history before applying. This file is intentionally NOT auto-applied by the build-only workflow.
BEGIN;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username text;

-- Preserve existing valid usernames; give legacy accounts stable handles when missing/invalid.
DO $$
DECLARE
  r record;
  base_name text;
  candidate text;
  suffix integer;
BEGIN
  FOR r IN SELECT id, username FROM public.users ORDER BY id LOOP
    base_name := lower(regexp_replace(coalesce(r.username, ''), '[^a-z0-9_]', '', 'g'));
    IF length(base_name) < 3 OR length(base_name) > 32 THEN
      base_name := 'member_' || substr(replace(r.id::text, '-', ''), 1, 12);
    END IF;
    candidate := left(base_name, 32);
    suffix := 0;
    WHILE EXISTS (
      SELECT 1 FROM public.users other
      WHERE other.id <> r.id AND lower(other.username) = candidate
    ) LOOP
      suffix := suffix + 1;
      candidate := left(base_name, 22) || '_' || substr(md5(r.id::text || ':' || suffix::text), 1, 8);
    END LOOP;
    UPDATE public.users SET username = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.users ALTER COLUMN username SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.users'::regclass AND conname='users_username_format_check') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_username_format_check CHECK (username ~ '^[a-z0-9_]{3,32}$');
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique_idx ON public.users (lower(username));

-- Keep the existing contact-privacy projection and append the public username.
-- Existing columns are kept in the same order for CREATE OR REPLACE VIEW compatibility.
CREATE OR REPLACE VIEW public.user_directory AS
SELECT
  id,
  first_name,
  last_name,
  CASE WHEN ((auth.uid() = id) OR is_admin()) THEN identifier ELSE NULL::text END AS identifier,
  CASE WHEN ((auth.uid() = id) OR is_admin()) THEN phone ELSE NULL::text END AS phone,
  avatar_url,
  is_verified,
  created_at,
  gender,
  username
FROM public.users;
GRANT SELECT ON public.user_directory TO authenticated;

-- Refresh the auth trigger so signup metadata contains a username and optional contact phone.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  configured_admin_email text;
  clean_username text;
BEGIN
  SELECT value INTO configured_admin_email
  FROM public.app_settings WHERE key = 'initial_admin_email' LIMIT 1;

  clean_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', ''), '[^a-z0-9_]', '', 'g'));
  IF length(clean_username) < 3 OR length(clean_username) > 32 THEN
    clean_username := 'member_' || substr(replace(new.id::text, '-', ''), 1, 12);
  END IF;

  INSERT INTO public.users (
    id, first_name, last_name, username, identifier, phone, gender, birthdate,
    avatar_url, hide_email, hide_phone, is_admin
  ) VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name',''),
    coalesce(new.raw_user_meta_data->>'last_name',''),
    clean_username,
    lower(coalesce(new.email, new.phone, new.id::text)),
    coalesce(nullif(new.phone,''), nullif(new.raw_user_meta_data->>'phone',''), ''),
    CASE WHEN coalesce(new.raw_user_meta_data->>'gender','ذكر') IN ('ذكر','أنثى') THEN coalesce(new.raw_user_meta_data->>'gender','ذكر') ELSE 'ذكر' END,
    CASE WHEN coalesce(new.raw_user_meta_data->>'birthdate','') <> '' THEN (new.raw_user_meta_data->>'birthdate')::date ELSE NULL END,
    nullif(new.raw_user_meta_data->>'avatar_url',''),
    coalesce((new.raw_user_meta_data->>'hide_email')::boolean,true),
    coalesce((new.raw_user_meta_data->>'hide_phone')::boolean,true),
    lower(coalesce(configured_admin_email,'')) <> '' AND lower(configured_admin_email) = lower(coalesce(new.email,''))
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = coalesce(nullif(EXCLUDED.first_name,''), public.users.first_name),
    last_name = coalesce(nullif(EXCLUDED.last_name,''), public.users.last_name),
    username = coalesce(nullif(EXCLUDED.username,''), public.users.username),
    identifier = EXCLUDED.identifier,
    phone = EXCLUDED.phone,
    is_admin = public.users.is_admin OR EXCLUDED.is_admin,
    updated_at = now();
  RETURN new;
END;
$$;

-- Preserve usernames while Auth email/phone changes; keep optional contact phone private in the profile.
CREATE OR REPLACE FUNCTION public.handle_auth_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  configured_admin_email text;
BEGIN
  SELECT value INTO configured_admin_email FROM public.app_settings WHERE key='initial_admin_email' LIMIT 1;
  UPDATE public.users
     SET identifier = lower(coalesce(new.email, new.phone, new.id::text)),
         phone = coalesce(nullif(new.phone,''), nullif(new.raw_user_meta_data->>'phone',''), ''),
         is_admin = is_admin OR (lower(coalesce(configured_admin_email,'')) <> '' AND lower(configured_admin_email)=lower(coalesce(new.email,''))),
         updated_at = now()
   WHERE id = new.id;
  RETURN new;
END;
$$;

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT follows_not_self CHECK (follower_id <> following_id),
  CONSTRAINT follows_pair_pk PRIMARY KEY (follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS follows_following_created_idx ON public.follows (following_id, created_at DESC);
CREATE INDEX IF NOT EXISTS follows_follower_created_idx ON public.follows (follower_id, created_at DESC);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.follows FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
DROP POLICY IF EXISTS follows_select_participating ON public.follows;
DROP POLICY IF EXISTS follows_insert_self ON public.follows;
DROP POLICY IF EXISTS follows_delete_self ON public.follows;
CREATE POLICY follows_select_participating ON public.follows FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = follower_id OR (SELECT auth.uid()) = following_id);
CREATE POLICY follows_insert_self ON public.follows FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = follower_id AND follower_id <> following_id);
CREATE POLICY follows_delete_self ON public.follows FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = follower_id);

-- A small server-only table backs username signup throttling; clients receive no privileges.
CREATE TABLE IF NOT EXISTS public.username_signup_attempts (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS username_signup_attempts_ip_created_idx ON public.username_signup_attempts (ip_hash, created_at DESC);
ALTER TABLE public.username_signup_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.username_signup_attempts FROM anon, authenticated;
DROP POLICY IF EXISTS username_signup_attempts_deny_clients ON public.username_signup_attempts;
CREATE POLICY username_signup_attempts_deny_clients ON public.username_signup_attempts
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  follower_name text;
BEGIN
  SELECT trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
    INTO follower_name FROM public.users WHERE id = NEW.follower_id;
  INSERT INTO public.notifications(recipient_id, title, body, type)
  VALUES (
    NEW.following_id,
    'متابع جديد',
    jsonb_build_object('follower_id', NEW.follower_id, 'follower_name', coalesce(nullif(follower_name,''),'عضو في الواحة'))::text,
    'follow'
  );
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_on_follow() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS follows_notify_trigger ON public.follows;
CREATE TRIGGER follows_notify_trigger AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

COMMIT;
