DO $test$
DECLARE
  v_public_definer_count integer;
  v_exposed text := current_setting('pgrst.db_schemas',true);
BEGIN
  IF NOT has_schema_privilege('authenticated','app_private','USAGE')
     OR has_schema_privilege('anon','app_private','USAGE')
     OR has_schema_privilege('authenticated','app_private','CREATE')
     OR has_schema_privilege('anon','app_private','CREATE') THEN
    RAISE EXCEPTION 'app_private schema usage grants are incorrect';
  END IF;
  IF v_exposed IS NOT NULL AND v_exposed ILIKE '%app_private%' THEN
    RAISE EXCEPTION 'app_private must not be exposed through PostgREST';
  END IF;

  SELECT count(*) INTO v_public_definer_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef
    AND (has_function_privilege('authenticated',p.oid,'EXECUTE')
      OR has_function_privilege('anon',p.oid,'EXECUTE'));
  IF v_public_definer_count<>0 THEN
    RAISE EXCEPTION 'Public SECURITY DEFINER functions remain executable by anon/authenticated: %',v_public_definer_count;
  END IF;

  IF to_regprocedure('public.can_reply_to_direct_message(bigint,uuid,uuid)') IS NOT NULL
     OR to_regprocedure('public.can_reply_to_market_message(uuid,uuid,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'RLS helper functions must not remain in public';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='app_private' AND p.proname='is_admin' AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']::text[]
      AND has_function_privilege('authenticated',p.oid,'EXECUTE')
      AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
  ) THEN RAISE EXCEPTION 'app_private.is_admin must be a private-path definer helper'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='app_private' AND p.proname='can_reply_to_direct_message' AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']::text[]
      AND has_function_privilege('authenticated',p.oid,'EXECUTE')
      AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='app_private' AND p.proname='can_reply_to_market_message' AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']::text[]
      AND has_function_privilege('authenticated',p.oid,'EXECUTE')
      AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='app_private' AND p.proname='can_review_marketplace_product' AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']::text[]
      AND has_function_privilege('authenticated',p.oid,'EXECUTE')
      AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
  ) THEN RAISE EXCEPTION 'Private RLS helper functions are missing or insecure'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='app_private' AND p.proname='approve_market_archive_deletion' AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']::text[]
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='app_private' AND p.proname='complete_market_sale' AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']::text[]
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='app_private' AND p.proname='join_game_room' AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']::text[]
  ) THEN RAISE EXCEPTION 'Private business-logic functions are missing or insecure'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='approve_market_archive_deletion' AND NOT p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']::text[]
      AND has_function_privilege('authenticated',p.oid,'EXECUTE')
      AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='complete_market_sale' AND NOT p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']::text[]
      AND has_function_privilege('authenticated',p.oid,'EXECUTE')
      AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='join_game_room' AND NOT p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']::text[]
      AND has_function_privilege('authenticated',p.oid,'EXECUTE')
      AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='can_review_marketplace_product' AND NOT p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']::text[]
      AND has_function_privilege('authenticated',p.oid,'EXECUTE')
      AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
  ) THEN RAISE EXCEPTION 'Public RPC wrappers must be SECURITY INVOKER and authenticated-only'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='messages_insert_sender_accepted_friends' AND with_check ILIKE '%app_private.can_reply_to_direct_message%')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='market_messages' AND policyname='market_messages_insert_participant' AND with_check ILIKE '%app_private.can_reply_to_market_message%')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_reviews' AND policyname='marketplace_reviews_insert_verified_buyer' AND with_check ILIKE '%app_private.can_review_marketplace_product%') THEN
    RAISE EXCEPTION 'RLS policies are not using app_private helper functions';
  END IF;
END;
$test$;
