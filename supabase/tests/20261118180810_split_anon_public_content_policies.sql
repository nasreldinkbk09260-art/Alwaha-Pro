DO $test$
BEGIN
  IF has_function_privilege('anon','app_private.is_user_blocked(uuid,uuid)','EXECUTE')
     OR has_schema_privilege('anon','app_private','USAGE') THEN
    RAISE EXCEPTION 'Anonymous role must not receive access to private block helper or schema';
  END IF;
  IF NOT has_function_privilege('authenticated','app_private.is_user_blocked(uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated role lost block helper required by block-aware policies';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='posts' AND policyname='posts_select_anon' AND cmd='SELECT' AND roles=ARRAY['anon']::name[] AND qual='true')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='posts' AND policyname='posts_select_authenticated' AND cmd='SELECT' AND roles=ARRAY['authenticated']::name[] AND qual ILIKE '%app_private.is_user_blocked%') THEN
    RAISE EXCEPTION 'Posts role-specific read policies are incomplete';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reels' AND policyname='reels_select_anon' AND cmd='SELECT' AND roles=ARRAY['anon']::name[] AND qual='true')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reels' AND policyname='reels_select_authenticated' AND cmd='SELECT' AND roles=ARRAY['authenticated']::name[] AND qual ILIKE '%app_private.is_user_blocked%') THEN
    RAISE EXCEPTION 'Reels role-specific read policies are incomplete';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='comments' AND policyname='comments_select_anon' AND cmd='SELECT' AND roles=ARRAY['anon']::name[] AND qual='true')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='comments' AND policyname='comments_select_authenticated' AND cmd='SELECT' AND roles=ARRAY['authenticated']::name[] AND qual ILIKE '%app_private.is_user_blocked%') THEN
    RAISE EXCEPTION 'Comments role-specific read policies are incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename IN ('posts','reels','comments') AND roles && ARRAY['anon']::name[] AND concat_ws(' ',qual,with_check) ILIKE '%app_private.is_user_blocked%') THEN
    RAISE EXCEPTION 'An anonymous policy still references the private block helper';
  END IF;
END;
$test$;

BEGIN;
SET LOCAL ROLE anon;
DO $anon$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.posts WHERE content='test post') THEN RAISE EXCEPTION 'Anonymous role cannot read public posts'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reels WHERE title='test reel') THEN RAISE EXCEPTION 'Anonymous role cannot read public reels'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.comments WHERE content='test comment') THEN RAISE EXCEPTION 'Anonymous role cannot read public comments'; END IF;
  -- The helper denial is asserted above as the database owner; do not resolve its private schema here.
END;
$anon$;
ROLLBACK;

BEGIN;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SET LOCAL ROLE authenticated;
DO $blocked_reader$
BEGIN
  IF EXISTS (SELECT 1 FROM public.posts WHERE content='test post') THEN RAISE EXCEPTION 'Blocked author post remained visible'; END IF;
  IF EXISTS (SELECT 1 FROM public.reels WHERE title='test reel') THEN RAISE EXCEPTION 'Blocked author reel remained visible'; END IF;
  IF EXISTS (SELECT 1 FROM public.comments WHERE content='test comment') THEN RAISE EXCEPTION 'Blocked author comment remained visible'; END IF;
END;
$blocked_reader$;
ROLLBACK;

BEGIN;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
SET LOCAL ROLE authenticated;
DO $ordinary_reader$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.posts WHERE content='test post') THEN RAISE EXCEPTION 'Unblocked reader lost public posts'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reels WHERE title='test reel') THEN RAISE EXCEPTION 'Unblocked reader lost public reels'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.comments WHERE content='test comment') THEN RAISE EXCEPTION 'Unblocked reader lost public comments'; END IF;
END;
$ordinary_reader$;
ROLLBACK;
DO $finish$ BEGIN RAISE NOTICE 'PUBLIC_CONTENT_ANON_POLICY=PASS'; END; $finish$;
