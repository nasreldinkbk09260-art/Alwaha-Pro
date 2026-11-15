BEGIN;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS public.user_consents(
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 terms_version text NOT NULL, privacy_version text NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,terms_version,privacy_version)
);
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_consents FROM PUBLIC,anon,authenticated;
GRANT ALL ON TABLE public.user_consents TO service_role;
CREATE OR REPLACE FUNCTION app_private.require_current_user_consent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
 IF COALESCE(NEW.raw_user_meta_data->>'alwaha_terms_version','') <> '2026-11-15'
 OR COALESCE(NEW.raw_user_meta_data->>'alwaha_privacy_version','') <> '2026-11-15' THEN
  RAISE EXCEPTION 'Alwaha terms and privacy consent are required before account creation';
 END IF;
 RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.require_current_user_consent() FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION app_private.record_current_user_consent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
 INSERT INTO public.user_consents(user_id,terms_version,privacy_version,accepted_at)
 VALUES(NEW.id,NEW.raw_user_meta_data->>'alwaha_terms_version',NEW.raw_user_meta_data->>'alwaha_privacy_version',now())
 ON CONFLICT(user_id,terms_version,privacy_version) DO NOTHING;
 RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.record_current_user_consent() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS alwaha_require_current_user_consent ON auth.users;
CREATE TRIGGER alwaha_require_current_user_consent BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION app_private.require_current_user_consent();
DROP TRIGGER IF EXISTS alwaha_record_current_user_consent ON auth.users;
CREATE TRIGGER alwaha_record_current_user_consent AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION app_private.record_current_user_consent();
COMMIT;
