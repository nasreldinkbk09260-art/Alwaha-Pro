-- Allow a friend to subscribe to the recipient inbox for offers/results.
-- Match room topics exactly so authorization is scoped to the accepted friend pair.
BEGIN;
DROP POLICY IF EXISTS alwaha_call_channels_receive ON realtime.messages;
DROP POLICY IF EXISTS alwaha_call_channels_send ON realtime.messages;
CREATE POLICY alwaha_call_channels_receive ON realtime.messages FOR SELECT TO authenticated USING (
 extension='broadcast' AND (
  realtime.topic()='call-inbox-'||(SELECT auth.uid())::text
  OR EXISTS(SELECT 1 FROM public.friend_requests fr WHERE fr.status='accepted' AND (
   (fr.requester_id=(SELECT auth.uid()) AND realtime.topic()='call-inbox-'||fr.target_id::text)
   OR (fr.target_id=(SELECT auth.uid()) AND realtime.topic()='call-inbox-'||fr.requester_id::text)
  ))
  OR EXISTS(SELECT 1 FROM public.friend_requests fr WHERE fr.status='accepted' AND (
   (fr.requester_id=(SELECT auth.uid()) AND realtime.topic()='call-room_'||LEAST((SELECT auth.uid())::text,fr.target_id::text)||'_'||GREATEST((SELECT auth.uid())::text,fr.target_id::text))
   OR (fr.target_id=(SELECT auth.uid()) AND realtime.topic()='call-room_'||LEAST((SELECT auth.uid())::text,fr.requester_id::text)||'_'||GREATEST((SELECT auth.uid())::text,fr.requester_id::text))
  ))
 )
);
CREATE POLICY alwaha_call_channels_send ON realtime.messages FOR INSERT TO authenticated WITH CHECK (
 extension='broadcast' AND (
  realtime.topic()='call-inbox-'||(SELECT auth.uid())::text
  OR EXISTS(SELECT 1 FROM public.friend_requests fr WHERE fr.status='accepted' AND (
   (fr.requester_id=(SELECT auth.uid()) AND realtime.topic()='call-inbox-'||fr.target_id::text)
   OR (fr.target_id=(SELECT auth.uid()) AND realtime.topic()='call-inbox-'||fr.requester_id::text)
  ))
  OR EXISTS(SELECT 1 FROM public.friend_requests fr WHERE fr.status='accepted' AND (
   (fr.requester_id=(SELECT auth.uid()) AND realtime.topic()='call-room_'||LEAST((SELECT auth.uid())::text,fr.target_id::text)||'_'||GREATEST((SELECT auth.uid())::text,fr.target_id::text))
   OR (fr.target_id=(SELECT auth.uid()) AND realtime.topic()='call-room_'||LEAST((SELECT auth.uid())::text,fr.requester_id::text)||'_'||GREATEST((SELECT auth.uid())::text,fr.requester_id::text))
  ))
 )
);
COMMIT;
