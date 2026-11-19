-- Private media storage for direct and marketplace conversations.
-- Only authenticated participants in the message/conversation can read attached files.
BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  false,
  52428800,
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/webm','video/quicktime',
    'audio/webm','audio/ogg','audio/mp4','audio/aac','audio/mpeg','audio/wav','audio/3gpp'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 52428800,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS alwaha_chat_media_insert_own ON storage.objects;
CREATE POLICY alwaha_chat_media_insert_own
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND array_length(storage.foldername(name), 1) >= 3
);

DROP POLICY IF EXISTS alwaha_chat_media_select_participant ON storage.objects;
CREATE POLICY alwaha_chat_media_select_participant
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR EXISTS (
      SELECT 1
      FROM public.messages AS m
      WHERE (m.sender_id = (SELECT auth.uid()) OR m.receiver_id = (SELECT auth.uid()))
        AND position(storage.objects.name IN m.message) > 0
    )
    OR EXISTS (
      SELECT 1
      FROM public.market_messages AS mm
      JOIN public.market_conversations AS mc ON mc.id = mm.conversation_id
      WHERE (mc.buyer_id = (SELECT auth.uid()) OR mc.seller_id = (SELECT auth.uid()))
        AND position(storage.objects.name IN mm.message) > 0
    )
  )
);

DROP POLICY IF EXISTS alwaha_chat_media_delete_own ON storage.objects;
CREATE POLICY alwaha_chat_media_delete_own
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

COMMIT;
