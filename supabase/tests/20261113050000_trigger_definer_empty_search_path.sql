DO $test$
DECLARE
  v_bad_public integer;
  v_bad_private integer;
BEGIN
  SELECT count(*) INTO v_bad_public
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef
    AND NOT COALESCE(p.proconfig @> ARRAY['search_path=""']::text[],false);
  IF v_bad_public<>0 THEN
    RAISE EXCEPTION 'Public SECURITY DEFINER functions without empty search_path: %',v_bad_public;
  END IF;

  SELECT count(*) INTO v_bad_private
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='app_private' AND p.prosecdef
    AND NOT COALESCE(p.proconfig @> ARRAY['search_path=""']::text[],false);
  IF v_bad_private<>0 THEN
    RAISE EXCEPTION 'app_private SECURITY DEFINER functions without empty search_path: %',v_bad_private;
  END IF;

  IF has_schema_privilege('authenticated','public','CREATE')
     OR has_schema_privilege('anon','public','CREATE') THEN
    RAISE EXCEPTION 'Public schema must not be client-creatable';
  END IF;
END;
$test$;
