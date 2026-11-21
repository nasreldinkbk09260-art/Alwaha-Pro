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
  AND array_length(storage.foldername(name), 1) >= 2
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
        -- The file path must belong to the sender and to this exact direct conversation.
        AND (storage.foldername(storage.objects.name))[1] = m.sender_id::text
        AND (storage.foldername(storage.objects.name))[2] =
          'dm-' || LEAST(m.sender_id::text,m.receiver_id::text) || '-' ||
          GREATEST(m.sender_id::text,m.receiver_id::text)
        AND position(storage.objects.name IN m.message) > 0
    )
    OR EXISTS (
      SELECT 1
      FROM public.market_messages AS mm
      JOIN public.market_conversations AS mc ON mc.id = mm.conversation_id
      WHERE (mc.buyer_id = (SELECT auth.uid()) OR mc.seller_id = (SELECT auth.uid()))
        -- The file path must belong to this message sender and this exact marketplace conversation.
        AND mm.sender_id IN (mc.buyer_id,mc.seller_id)
        AND (storage.foldername(storage.objects.name))[1] = mm.sender_id::text
        AND (storage.foldername(storage.objects.name))[2] = mc.id::text
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
