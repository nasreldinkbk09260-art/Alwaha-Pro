-- Private WebRTC Broadcast authorization, limited to accepted friends.
BEGIN;
DROP POLICY IF EXISTS alwaha_call_channels_receive ON realtime.messages;
DROP POLICY IF EXISTS alwaha_call_channels_send ON realtime.messages;
CREATE POLICY alwaha_call_channels_receive ON realtime.messages FOR SELECT TO authenticated USING (
  extension = 'broadcast' AND (
    realtime.topic() = 'call-inbox-' || (SELECT auth.uid())::text
    OR (left(realtime.topic(), 10) = 'call-room_'
      AND position((SELECT auth.uid())::text IN realtime.topic()) > 0
      AND EXISTS (SELECT 1 FROM public.friend_requests AS fr WHERE fr.status = 'accepted' AND (
        (fr.requester_id = (SELECT auth.uid()) AND position(fr.target_id::text IN realtime.topic()) > 0)
        OR (fr.target_id = (SELECT auth.uid()) AND position(fr.requester_id::text IN realtime.topic()) > 0)
      )))
  )
);
CREATE POLICY alwaha_call_channels_send ON realtime.messages FOR INSERT TO authenticated WITH CHECK (
  extension = 'broadcast' AND (
    realtime.topic() = 'call-inbox-' || (SELECT auth.uid())::text
    OR EXISTS (SELECT 1 FROM public.friend_requests AS fr WHERE fr.status = 'accepted' AND (
      (fr.requester_id = (SELECT auth.uid()) AND realtime.topic() = 'call-inbox-' || fr.target_id::text)
      OR (fr.target_id = (SELECT auth.uid()) AND realtime.topic() = 'call-inbox-' || fr.requester_id::text)
    ))
    OR (left(realtime.topic(), 10) = 'call-room_'
      AND position((SELECT auth.uid())::text IN realtime.topic()) > 0
      AND EXISTS (SELECT 1 FROM public.friend_requests AS fr WHERE fr.status = 'accepted' AND (
        (fr.requester_id = (SELECT auth.uid()) AND position(fr.target_id::text IN realtime.topic()) > 0)
        OR (fr.target_id = (SELECT auth.uid()) AND position(fr.requester_id::text IN realtime.topic()) > 0)
      )))
  )
);
COMMIT;
