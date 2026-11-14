-- A pending request is not friendship. Restrict message INSERT to accepted friends.
BEGIN;
DROP POLICY IF EXISTS messages_insert_sender ON public.messages;
DROP POLICY IF EXISTS messages_insert_sender_accepted_friends ON public.messages;
CREATE POLICY messages_insert_sender_accepted_friends ON public.messages FOR INSERT TO authenticated WITH CHECK (
 (SELECT auth.uid())=sender_id AND receiver_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.friend_requests fr WHERE fr.status='accepted' AND (
   (fr.requester_id=(SELECT auth.uid()) AND fr.target_id=receiver_id)
   OR (fr.target_id=(SELECT auth.uid()) AND fr.requester_id=receiver_id)
  )
 )
);
COMMIT;
