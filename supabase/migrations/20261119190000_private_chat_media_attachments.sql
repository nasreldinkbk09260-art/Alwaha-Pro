BEGIN;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_kind text,
  ADD COLUMN IF NOT EXISTS attachment_mime text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_size bigint;

ALTER TABLE public.market_messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_kind text,
  ADD COLUMN IF NOT EXISTS attachment_mime text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_size bigint;

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_or_attachment_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_or_attachment_check CHECK (
  char_length(btrim(message)) <= 4000
  AND (char_length(btrim(message)) > 0 OR attachment_path IS NOT NULL)
  AND (
    (attachment_path IS NULL AND num_nonnulls(attachment_kind,attachment_mime,attachment_name,attachment_size)=0)
    OR
    (attachment_path IS NOT NULL
      AND num_nonnulls(attachment_kind,attachment_mime,attachment_name,attachment_size)=4
      AND attachment_kind IN ('image','video','audio')
      AND (
        (attachment_kind='image' AND attachment_mime IN ('image/jpeg','image/png','image/webp','image/gif','image/avif'))
        OR (attachment_kind='video' AND attachment_mime IN ('video/mp4','video/webm','video/quicktime'))
        OR (attachment_kind='audio' AND attachment_mime IN ('audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav'))
      )
      AND char_length(attachment_name) BETWEEN 1 AND 180
      AND attachment_name !~ '[/\\\\]'
      AND attachment_size BETWEEN 1 AND 52428800
      AND left(attachment_path,char_length(sender_id::text)+1)=sender_id::text||'/'
      AND attachment_path ~ ('^'||sender_id::text||'/direct/'||receiver_id::text||'/[A-Za-z0-9_.-]+$')
    )
  )
);

ALTER TABLE public.market_messages DROP CONSTRAINT IF EXISTS market_messages_message_check;
ALTER TABLE public.market_messages DROP CONSTRAINT IF EXISTS market_messages_message_or_attachment_check;
ALTER TABLE public.market_messages ADD CONSTRAINT market_messages_message_or_attachment_check CHECK (
  char_length(btrim(message)) <= 4000
  AND (char_length(btrim(message)) > 0 OR attachment_path IS NOT NULL)
  AND (
    (attachment_path IS NULL AND num_nonnulls(attachment_kind,attachment_mime,attachment_name,attachment_size)=0)
    OR
    (attachment_path IS NOT NULL
      AND num_nonnulls(attachment_kind,attachment_mime,attachment_name,attachment_size)=4
      AND attachment_kind IN ('image','video','audio')
      AND (
        (attachment_kind='image' AND attachment_mime IN ('image/jpeg','image/png','image/webp','image/gif','image/avif'))
        OR (attachment_kind='video' AND attachment_mime IN ('video/mp4','video/webm','video/quicktime'))
        OR (attachment_kind='audio' AND attachment_mime IN ('audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav'))
      )
      AND char_length(attachment_name) BETWEEN 1 AND 180
      AND attachment_name !~ '[/\\\\]'
      AND attachment_size BETWEEN 1 AND 52428800
      AND left(attachment_path,char_length(sender_id::text)+1)=sender_id::text||'/'
      AND attachment_path ~ ('^'||sender_id::text||'/market/'||conversation_id::text||'/[A-Za-z0-9_.-]+$')
    )
  )
);

CREATE INDEX IF NOT EXISTS messages_attachment_path_idx
  ON public.messages(attachment_path) WHERE attachment_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS market_messages_attachment_path_idx
  ON public.market_messages(attachment_path) WHERE attachment_path IS NOT NULL;

GRANT INSERT (attachment_path,attachment_kind,attachment_mime,attachment_name,attachment_size)
  ON public.messages TO authenticated;
GRANT SELECT (attachment_path,attachment_kind,attachment_mime,attachment_name,attachment_size)
  ON public.messages TO authenticated;
GRANT INSERT (attachment_path,attachment_kind,attachment_mime,attachment_name,attachment_size)
  ON public.market_messages TO authenticated;
GRANT SELECT (attachment_path,attachment_kind,attachment_mime,attachment_name,attachment_size)
  ON public.market_messages TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif',
        'video/mp4','video/webm','video/quicktime',
        'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav']
)
ON CONFLICT(id) DO UPDATE
SET name=EXCLUDED.name,
    public=false,
    file_size_limit=EXCLUDED.file_size_limit,
    allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS chat_attachments_upload_own_folder ON storage.objects;
CREATE POLICY chat_attachments_upload_own_folder
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='chat-attachments'
  AND (storage.foldername(name))[1]=(SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS chat_attachments_read_participants ON storage.objects;
CREATE POLICY chat_attachments_read_participants
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id='chat-attachments'
  AND (
    (storage.foldername(name))[1]=(SELECT auth.uid()::text)
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.attachment_path=storage.objects.name
        AND (m.sender_id=(SELECT auth.uid()) OR m.receiver_id=(SELECT auth.uid()))
    )
    OR EXISTS (
      SELECT 1
      FROM public.market_messages mm
      JOIN public.market_conversations c ON c.id=mm.conversation_id
      WHERE mm.attachment_path=storage.objects.name
        AND (c.buyer_id=(SELECT auth.uid()) OR c.seller_id=(SELECT auth.uid()))
    )
  )
);

DROP POLICY IF EXISTS chat_attachments_delete_own_folder ON storage.objects;
CREATE POLICY chat_attachments_delete_own_folder
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id='chat-attachments'
  AND (storage.foldername(name))[1]=(SELECT auth.uid()::text)
);

COMMENT ON COLUMN public.messages.attachment_path IS 'Optional path in private chat-attachments bucket; readable only by the two direct-message participants.';
COMMENT ON COLUMN public.market_messages.attachment_path IS 'Optional path in private chat-attachments bucket; readable only by the buyer/seller participants of this conversation.';

COMMIT;
