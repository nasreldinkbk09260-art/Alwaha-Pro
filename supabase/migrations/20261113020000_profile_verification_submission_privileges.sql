-- Allow authenticated users to submit verification evidence without controlling review state.
BEGIN;
REVOKE INSERT ON TABLE public.verification_requests FROM PUBLIC, anon, authenticated;
GRANT INSERT (user_id, reason, phone, category, profile_url, extra_details)
  ON TABLE public.verification_requests TO authenticated;
COMMIT;
