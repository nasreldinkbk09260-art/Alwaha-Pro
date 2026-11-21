-- CI regression tests for private chat and marketplace media.
DO $$
DECLARE
  v_public boolean;
  v_limit bigint;
  v_types text[];
  v_select_policy text;
BEGIN
  SELECT public,file_size_limit,allowed_mime_types
    INTO v_public,v_limit,v_types
  FROM storage.buckets WHERE id='chat-media';
  IF NOT FOUND THEN RAISE EXCEPTION 'chat-media bucket was not created'; END IF;
  IF v_public THEN RAISE EXCEPTION 'chat-media must stay private'; END IF;
  IF v_limit<>52428800 THEN RAISE EXCEPTION 'chat-media size cap mismatch'; END IF;
  IF NOT ('audio/webm'=ANY(v_types) AND 'video/mp4'=ANY(v_types) AND 'image/jpeg'=ANY(v_types)) THEN
    RAISE EXCEPTION 'chat-media required MIME types are missing';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='alwaha_chat_media_insert_own' AND cmd='INSERT') THEN
    RAISE EXCEPTION 'chat media upload ownership policy missing';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='alwaha_chat_media_select_participant' AND cmd='SELECT') THEN
    RAISE EXCEPTION 'chat media participant-read policy missing';
  END IF;
  SELECT qual INTO v_select_policy
    FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='alwaha_chat_media_select_participant';
  IF position('dm-' in v_select_policy)=0
     OR position('m.sender_id' in v_select_policy)=0
     OR position('mm.sender_id' in v_select_policy)=0
     OR position('mc.id' in v_select_policy)=0 THEN
    RAISE EXCEPTION 'chat media read policy must bind both uploader and exact conversation path';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='alwaha_chat_media_delete_own' AND cmd='DELETE') THEN
    RAISE EXCEPTION 'chat media own-delete policy missing';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) THEN
    RAISE EXCEPTION 'storage.objects RLS is not active';
  END IF;
END
$$;

-- Behavioral RLS test: a recipient may read only the exact files attached to
-- their direct/market conversation; a same-message reference to another path
-- and a non-participant must not grant access.
BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('f1000000-0000-4000-8000-000000000001','chat-media-a@example.invalid'),
 ('f1000000-0000-4000-8000-000000000002','chat-media-b@example.invalid'),
 ('f1000000-0000-4000-8000-000000000003','chat-media-c@example.invalid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products(id,seller_id,title,price,category,description,status)
VALUES (999999901,'f1000000-0000-4000-8000-000000000001','CI media policy fixture','1','test','CI only','active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.market_conversations(id,product_id,buyer_id,seller_id)
VALUES (
 'f2000000-0000-4000-8000-000000000001',999999901,
 'f1000000-0000-4000-8000-000000000002',
 'f1000000-0000-4000-8000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.messages(sender_id,receiver_id,message) VALUES
 ('f1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002',
  'ALWAHA_MEDIA_V1:{"v":1,"type":"image","path":"f1000000-0000-4000-8000-000000000001/dm-f1000000-0000-4000-8000-000000000001-f1000000-0000-4000-8000-000000000002/direct-ok.jpg"}'),
 ('f1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002',
  'ALWAHA_MEDIA_V1:{"v":1,"type":"image","path":"f1000000-0000-4000-8000-000000000001/dm-f1000000-0000-4000-8000-000000000001-f1000000-0000-4000-8000-000000000003/direct-wrong-peer.jpg"}');

INSERT INTO public.market_messages(conversation_id,sender_id,message) VALUES
 ('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001',
  'ALWAHA_MEDIA_V1:{"v":1,"type":"image","path":"f1000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000001/market-ok.jpg"}'),
 ('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001',
  'ALWAHA_MEDIA_V1:{"v":1,"type":"image","path":"f1000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000099/market-wrong-thread.jpg"}');

INSERT INTO storage.objects(bucket_id,name,owner) VALUES
 ('chat-media','f1000000-0000-4000-8000-000000000001/dm-f1000000-0000-4000-8000-000000000001-f1000000-0000-4000-8000-000000000002/direct-ok.jpg','f1000000-0000-4000-8000-000000000001'),
 ('chat-media','f1000000-0000-4000-8000-000000000001/dm-f1000000-0000-4000-8000-000000000001-f1000000-0000-4000-8000-000000000003/direct-wrong-peer.jpg','f1000000-0000-4000-8000-000000000001'),
 ('chat-media','f1000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000001/market-ok.jpg','f1000000-0000-4000-8000-000000000001'),
 ('chat-media','f1000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000099/market-wrong-thread.jpg','f1000000-0000-4000-8000-000000000001');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000002',true);
DO $recipient$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM storage.objects
   WHERE bucket_id='chat-media'
     AND name LIKE 'f1000000-0000-4000-8000-000000000001/%';
  IF v_count<>2 THEN
    RAISE EXCEPTION 'Direct and marketplace participant should read exactly two authorized chat media objects; found %',v_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM storage.objects
     WHERE bucket_id='chat-media'
       AND name IN (
        'f1000000-0000-4000-8000-000000000001/dm-f1000000-0000-4000-8000-000000000001-f1000000-0000-4000-8000-000000000003/direct-wrong-peer.jpg',
        'f1000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000099/market-wrong-thread.jpg'
       )
  ) THEN RAISE EXCEPTION 'Participant could read a media object from a different chat path'; END IF;
END
$recipient$;

SELECT set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000003',true);
DO $outsider$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.objects
     WHERE bucket_id='chat-media'
       AND name LIKE 'f1000000-0000-4000-8000-000000000001/%'
  ) THEN RAISE EXCEPTION 'Non-participant can read private chat media'; END IF;
END
$outsider$;

RESET ROLE;
ROLLBACK;
