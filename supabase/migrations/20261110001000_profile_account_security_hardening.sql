BEGIN;

-- Public profile rows are not an account-deletion API. Account deletion, if enabled,
-- must be a separate audited server workflow that also handles auth.users and related data.
REVOKE DELETE ON TABLE public.users FROM anon, authenticated;
DROP POLICY IF EXISTS users_delete_own ON public.users;

-- Clients may submit only the evidence fields for a new pending verification request.
-- The database supplies id, status='pending', and created_at; review fields stay admin-only.
REVOKE INSERT ON TABLE public.verification_requests FROM anon, authenticated;
REVOKE INSERT (
  id, user_id, reason, status, created_at, reviewed_at, reviewed_by,
  phone, avatar_url, category, profile_url, extra_details
) ON TABLE public.verification_requests FROM anon, authenticated;

GRANT INSERT (
  user_id, reason, phone, avatar_url, category, profile_url, extra_details
) ON TABLE public.verification_requests TO authenticated;

DROP POLICY IF EXISTS verification_insert_own ON public.verification_requests;
CREATE POLICY verification_insert_own
  ON public.verification_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND status = 'pending'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
  );

COMMIT;
