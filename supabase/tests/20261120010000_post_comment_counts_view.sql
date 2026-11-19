-- Verify the aggregate shape, least-privilege grants and caller-specific RLS.
DO $test$
DECLARE
  v_kind "char";
  v_options text[];
BEGIN
  SELECT c.relkind, c.reloptions
    INTO v_kind, v_options
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'post_comment_counts';

  IF v_kind IS DISTINCT FROM 'v' THEN
    RAISE EXCEPTION 'post_comment_counts must be a view';
  END IF;
  IF NOT ('security_invoker=true' = ANY(COALESCE(v_options, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'post_comment_counts must use security_invoker=true';
  END IF;
  IF NOT has_table_privilege('anon','public.post_comment_counts','SELECT')
     OR NOT has_table_privilege('authenticated','public.post_comment_counts','SELECT') THEN
    RAISE EXCEPTION 'post_comment_counts SELECT must be available to anon and authenticated';
  END IF;
  IF has_table_privilege('anon','public.post_comment_counts','INSERT')
     OR has_table_privilege('authenticated','public.post_comment_counts','INSERT')
     OR has_table_privilege('anon','public.post_comment_counts','UPDATE')
     OR has_table_privilege('authenticated','public.post_comment_counts','DELETE') THEN
    RAISE EXCEPTION 'post_comment_counts must remain read-only for app roles';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='comments_post_target_count_idx'
  ) THEN
    RAISE EXCEPTION 'post comment count index is missing';
  END IF;
END
$test$;

SET ROLE anon;
DO $anon$
DECLARE
  v_count bigint;
BEGIN
  SELECT comments_count INTO v_count
  FROM public.post_comment_counts WHERE post_id='public-post';
  IF v_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'anon count for public-post should be 2, got %', v_count;
  END IF;
  SELECT comments_count INTO v_count
  FROM public.post_comment_counts WHERE post_id='hidden-post';
  IF v_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'public anonymous count should respect the public comments policy, got %', v_count;
  END IF;
END
$anon$;
RESET ROLE;

GRANT SELECT ON public.post_comment_counts TO ci_restricted_reader;
SET ROLE ci_restricted_reader;
DO $restricted$
BEGIN
  IF EXISTS (SELECT 1 FROM public.post_comment_counts WHERE post_id='hidden-post') THEN
    RAISE EXCEPTION 'security-invoker view ignored the restricted reader comments RLS policy';
  END IF;
  IF (SELECT comments_count FROM public.post_comment_counts WHERE post_id='public-post') IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'restricted reader did not receive the public post aggregate';
  END IF;
END
$restricted$;
RESET ROLE;

SET ROLE authenticated;
DO $authenticated$
DECLARE
  v_count bigint;
BEGIN
  SELECT comments_count INTO v_count
  FROM public.post_comment_counts WHERE post_id='public-post';
  IF v_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'authenticated count for public-post should be 2, got %', v_count;
  END IF;
  SELECT comments_count INTO v_count
  FROM public.post_comment_counts WHERE post_id='hidden-post';
  IF v_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'authenticated count for hidden-post should be 1, got %', v_count;
  END IF;
  IF EXISTS (SELECT 1 FROM public.post_comment_counts WHERE post_id='public-reel') THEN
    RAISE EXCEPTION 'non-post comments must not be included in post counts';
  END IF;
END
$authenticated$;
RESET ROLE;

SELECT 'POST_COMMENT_COUNTS_RLS_REGRESSION=PASS' AS result;
