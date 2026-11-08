-- Behavioral assertion for participant-controlled archive consent.
DO $$ BEGIN
  IF NOT has_function_privilege('authenticated','public.approve_market_archive_deletion(text,uuid,boolean)','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated participants must manage their own archive consent';
  END IF;
  IF has_function_privilege('anon','public.approve_market_archive_deletion(text,uuid,boolean)','EXECUTE') OR EXISTS (
    SELECT 1 FROM pg_proc p, LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE p.oid='public.approve_market_archive_deletion(text,uuid,boolean)'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE'
  ) THEN RAISE EXCEPTION 'Anonymous or PUBLIC must not manage archive consent'; END IF;
  IF has_function_privilege('authenticated','public.purge_expired_marketplace_archives(integer)','EXECUTE') THEN
    RAISE EXCEPTION 'Clients must not execute the scheduled purge job';
  END IF;
END $$;
SELECT 'MARKETPLACE_RETENTION_TWO_PARTY_CONSENT=PASS' AS result;