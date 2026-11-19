BEGIN;

-- A compact aggregate for the home feed. SECURITY INVOKER is intentional:
-- underlying comments RLS must continue to apply to the querying user.
CREATE INDEX IF NOT EXISTS comments_post_target_count_idx
  ON public.comments (target_id)
  WHERE target_type = 'post';

CREATE OR REPLACE VIEW public.post_comment_counts
WITH (security_invoker = true)
AS
SELECT
  target_id AS post_id,
  COUNT(*)::bigint AS comments_count
FROM public.comments
WHERE target_type = 'post'
GROUP BY target_id;

REVOKE ALL ON TABLE public.post_comment_counts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.post_comment_counts TO anon, authenticated;

COMMENT ON VIEW public.post_comment_counts IS
  'Read-only post comment counts; SECURITY INVOKER preserves comments table RLS for each caller.';

NOTIFY pgrst, 'reload schema';

COMMIT;
