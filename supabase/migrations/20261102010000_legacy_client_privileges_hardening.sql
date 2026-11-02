-- Legacy tables no longer used by current application clients.
-- Keep legacy reads compatible, but remove direct client mutation and TRUNCATE rights.
-- RLS stays enabled; this GRANT does not bypass existing row policies.
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE public.likes, public.profiles, public.ratings
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.likes, public.profiles, public.ratings
  TO anon, authenticated;
COMMIT;
