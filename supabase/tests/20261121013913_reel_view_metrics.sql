-- Aggregate-only metrics, per-user daily deduplication, and RLS column privacy.
DO $test$
DECLARE v_options text[]; v_kind "char";
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='reel_views_one_per_user_daily_uidx') THEN
    RAISE EXCEPTION 'daily view de-duplication index is missing';
  END IF;
  IF NOT has_column_privilege('anon','public.reel_views','reel_id','SELECT')
     OR has_column_privilege('anon','public.reel_views','user_id','SELECT')
     OR has_column_privilege('authenticated','public.reel_views','user_id','SELECT') THEN
    RAISE EXCEPTION 'viewer identities must remain private';
  END IF;
  IF NOT has_column_privilege('authenticated','public.reel_views','reel_id','INSERT')
     OR NOT has_column_privilege('authenticated','public.reel_views','user_id','INSERT') THEN
    RAISE EXCEPTION 'authenticated view insertion privileges are incomplete';
  END IF;
  SELECT c.relkind,c.reloptions INTO v_kind,v_options
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='reel_view_counts';
  IF v_kind IS DISTINCT FROM 'v' OR NOT ('security_invoker=true'=ANY(COALESCE(v_options,ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'reel_view_counts must be a SECURITY INVOKER view';
  END IF;
  SELECT c.relkind,c.reloptions INTO v_kind,v_options
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='reel_comment_counts';
  IF v_kind IS DISTINCT FROM 'v' OR NOT ('security_invoker=true'=ANY(COALESCE(v_options,ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'reel_comment_counts must be a SECURITY INVOKER view';
  END IF;
  IF NOT has_table_privilege('anon','public.reel_view_counts','SELECT')
     OR NOT has_table_privilege('authenticated','public.reel_comment_counts','SELECT') THEN
    RAISE EXCEPTION 'reel aggregate views must be readable by app roles';
  END IF;
END
$test$;

-- The production Auth trigger rejects signups unless both current policy versions
-- are present. Supply the same required consent metadata on this disposable CI user.
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('20000000-0000-4000-8000-000000000001','reel-viewer-ci@example.invalid',
  '{"username":"reel_viewer_ci","alwaha_terms_version":"2026-11-15","alwaha_privacy_version":"2026-11-15"}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO public.reels(id,title) VALUES (900001,'CI reel') ON CONFLICT DO NOTHING;
INSERT INTO public.comments(target_id,target_type,user_id,content) VALUES
 ('900001','reel','20000000-0000-4000-8000-000000000001','CI comment');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
INSERT INTO public.reel_views(reel_id,user_id) VALUES
 (900001,'20000000-0000-4000-8000-000000000001');
DO $duplicate$
BEGIN
  BEGIN
    INSERT INTO public.reel_views(reel_id,user_id) VALUES
      (900001,'20000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'duplicate same-day reel view unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END
$duplicate$;
DO $authenticated$
DECLARE v_count bigint;
BEGIN
  SELECT views_count INTO v_count FROM public.reel_view_counts WHERE reel_id=900001;
  IF v_count IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'one viewer must count once per UTC day; got %',v_count; END IF;
  SELECT comments_count INTO v_count FROM public.reel_comment_counts WHERE reel_id='900001';
  IF v_count IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'reel comment aggregate count mismatch: %',v_count; END IF;
END
$authenticated$;
RESET ROLE;

SELECT 'REEL_METRICS_RLS_REGRESSION=PASS' AS result;
