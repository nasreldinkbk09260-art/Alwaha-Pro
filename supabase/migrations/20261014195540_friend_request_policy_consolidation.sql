BEGIN;
DROP POLICY IF EXISTS friend_requests_update_requester ON public.friend_requests;
DROP POLICY IF EXISTS friend_requests_update_target ON public.friend_requests;
CREATE POLICY friend_requests_update_participant
  ON public.friend_requests FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = requester_id OR (SELECT auth.uid()) = target_id)
  WITH CHECK (
    ((SELECT auth.uid()) = requester_id AND status = 'cancelled')
    OR
    ((SELECT auth.uid()) = target_id AND status IN ('accepted', 'rejected'))
  );
COMMIT;
