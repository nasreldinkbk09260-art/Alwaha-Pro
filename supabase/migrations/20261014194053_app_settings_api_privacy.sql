-- Private server-side settings; clients have no direct API privileges.
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE public.app_settings FROM PUBLIC, anon, authenticated;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.app_settings IS 'Private server-side settings. Client API access is intentionally revoked.';
COMMIT;
