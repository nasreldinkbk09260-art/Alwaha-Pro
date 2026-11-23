BEGIN;

-- Gender is optional in registration and self-service profile editing.
-- Preserve existing values; new/cleared values may be NULL.
ALTER TABLE public.users
  ALTER COLUMN gender DROP NOT NULL,
  ALTER COLUMN gender DROP DEFAULT;

ALTER TABLE public.public_profiles
  ALTER COLUMN gender DROP NOT NULL,
  ALTER COLUMN gender DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  configured_admin_email text;
  clean_username text;
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'alwaha_terms_version','') <> '2026-11-15'
     OR COALESCE(NEW.raw_user_meta_data->>'alwaha_privacy_version','') <> '2026-11-15' THEN
    RAISE EXCEPTION 'Alwaha terms and privacy consent are required before account creation';
  END IF;

  SELECT value INTO configured_admin_email
    FROM public.app_settings WHERE key = 'initial_admin_email' LIMIT 1;

  clean_username := lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'username',''), '[^a-z0-9_]', '', 'g'));
  IF length(clean_username) < 3 OR length(clean_username) > 32 THEN
    clean_username := 'member_' || substr(replace(NEW.id::text, '-', ''), 1, 12);
  END IF;

  INSERT INTO public.users (
    id, first_name, last_name, username, identifier, phone, gender, birthdate,
    avatar_url, hide_email, hide_phone, is_admin
  ) VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'first_name',''),
    coalesce(NEW.raw_user_meta_data->>'last_name',''),
    clean_username,
    lower(coalesce(NEW.email, NEW.phone, NEW.id::text)),
    coalesce(nullif(NEW.phone,''), nullif(NEW.raw_user_meta_data->>'phone',''), ''),
    CASE
      WHEN NEW.raw_user_meta_data->>'gender' IN ('ذكر','أنثى')
        THEN NEW.raw_user_meta_data->>'gender'
      ELSE NULL
    END,
    CASE WHEN coalesce(NEW.raw_user_meta_data->>'birthdate','') <> '' THEN (NEW.raw_user_meta_data->>'birthdate')::date ELSE NULL END,
    nullif(NEW.raw_user_meta_data->>'avatar_url',''),
    coalesce((NEW.raw_user_meta_data->>'hide_email')::boolean,true),
    coalesce((NEW.raw_user_meta_data->>'hide_phone')::boolean,true),
    NEW.email_confirmed_at IS NOT NULL AND lower(coalesce(configured_admin_email,'')) <> '' AND lower(configured_admin_email) = lower(coalesce(NEW.email,''))
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = coalesce(nullif(EXCLUDED.first_name,''), public.users.first_name),
    last_name = coalesce(nullif(EXCLUDED.last_name,''), public.users.last_name),
    username = coalesce(nullif(EXCLUDED.username,''), public.users.username),
    identifier = EXCLUDED.identifier,
    phone = EXCLUDED.phone,
    is_admin = public.users.is_admin OR EXCLUDED.is_admin,
    updated_at = now();

  INSERT INTO public.user_consents(user_id, terms_version, privacy_version, accepted_at)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'alwaha_terms_version',
          NEW.raw_user_meta_data->>'alwaha_privacy_version', now())
  ON CONFLICT (user_id, terms_version, privacy_version) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_public_profile_directory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.public_profiles WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.public_profiles
    (id, first_name, last_name, avatar_url, is_verified, created_at, gender, username)
  VALUES
    (NEW.id, coalesce(NEW.first_name, ''), coalesce(NEW.last_name, ''),
     NEW.avatar_url, coalesce(NEW.is_verified, false), coalesce(NEW.created_at, now()),
     NEW.gender, coalesce(NEW.username, ''))
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    avatar_url = EXCLUDED.avatar_url,
    is_verified = EXCLUDED.is_verified,
    created_at = EXCLUDED.created_at,
    gender = EXCLUDED.gender,
    username = EXCLUDED.username;
  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.handle_auth_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  configured_admin_email text;
BEGIN
  SELECT value INTO configured_admin_email
    FROM public.app_settings WHERE key='initial_admin_email' LIMIT 1;
  UPDATE public.users
     SET identifier = lower(coalesce(NEW.email, NEW.phone, NEW.id::text)),
         phone = coalesce(nullif(NEW.phone,''), nullif(NEW.raw_user_meta_data->>'phone',''), ''),
         is_admin = is_admin OR (
           NEW.email_confirmed_at IS NOT NULL
           AND lower(coalesce(configured_admin_email,'')) <> ''
           AND lower(configured_admin_email)=lower(coalesce(NEW.email,''))
         ),
         updated_at = now()
   WHERE id = NEW.id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
AFTER UPDATE OF email, phone, email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_update();

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_auth_user_update() FROM PUBLIC, anon, authenticated;

COMMIT;
