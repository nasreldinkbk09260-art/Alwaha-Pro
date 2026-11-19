BEGIN;

DO $schema$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='attachment_path')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='market_messages' AND column_name='attachment_path') THEN
    RAISE EXCEPTION 'Chat attachment metadata columns are missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='chat-attachments' AND public=false AND file_size_limit=52428800) THEN
    RAISE EXCEPTION 'Private chat attachments bucket is missing or not private';
  END IF;
  IF has_table_privilege('authenticated','public.messages','INSERT')
     OR has_table_privilege('authenticated','public.market_messages','INSERT')
     OR NOT has_column_privilege('authenticated','public.messages','attachment_path','INSERT')
     OR NOT has_column_privilege('authenticated','public.market_messages','attachment_path','INSERT') THEN
    RAISE EXCEPTION 'Attachment insert grants must be column-scoped';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='chat_attachments_upload_own_folder' AND cmd='INSERT')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='chat_attachments_read_participants' AND cmd='SELECT')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='chat_attachments_delete_own_folder' AND cmd='DELETE') THEN
    RAISE EXCEPTION 'Private chat attachment policies are incomplete';
  END IF;
END
$schema$;

INSERT INTO auth.users(id,raw_user_meta_data) VALUES
 ('41000000-0000-4000-8000-000000000001','{"username":"chat_attach_a","alwaha_terms_version":"2026-11-15","alwaha_privacy_version":"2026-11-15"}'::jsonb),
 ('41000000-0000-4000-8000-000000000002','{"username":"chat_attach_b","alwaha_terms_version":"2026-11-15","alwaha_privacy_version":"2026-11-15"}'::jsonb),
 ('41000000-0000-4000-8000-000000000003','{"username":"chat_attach_c","alwaha_terms_version":"2026-11-15","alwaha_privacy_version":"2026-11-15"}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO public.friend_requests(requester_id,target_id,status)
VALUES ('41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','accepted')
ON CONFLICT DO NOTHING;

INSERT INTO public.products(seller_id,title,price,description)
VALUES ('41000000-0000-4000-8000-000000000002','private-attachment-test','1','test fixture');
INSERT INTO public.market_conversations(product_id,buyer_id,seller_id)
SELECT id,'41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002'
FROM public.products WHERE title='private-attachment-test';
SELECT set_config('alwaha.test.conversation_id',(
  SELECT c.id::text FROM public.market_conversations c JOIN public.products p ON p.id=c.product_id WHERE p.title='private-attachment-test' LIMIT 1
),true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);

INSERT INTO storage.objects(bucket_id,name,owner) VALUES
 ('chat-attachments','41000000-0000-4000-8000-000000000001/direct/41000000-0000-4000-8000-000000000002/direct-image.jpg','41000000-0000-4000-8000-000000000001'),
 ('chat-attachments','41000000-0000-4000-8000-000000000001/market/'||current_setting('alwaha.test.conversation_id')||'/market-audio.webm','41000000-0000-4000-8000-000000000001');

DO $upload_scope$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO storage.objects(bucket_id,name,owner)
    VALUES ('chat-attachments','41000000-0000-4000-8000-000000000002/direct/41000000-0000-4000-8000-000000000001/forged.jpg','41000000-0000-4000-8000-000000000001');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'A user uploaded into another account folder'; END IF;
END
$upload_scope$;

INSERT INTO public.messages(sender_id,receiver_id,message,attachment_path,attachment_kind,attachment_mime,attachment_name,attachment_size)
VALUES ('41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','',
 '41000000-0000-4000-8000-000000000001/direct/41000000-0000-4000-8000-000000000002/direct-image.jpg',
 'image','image/jpeg','photo.jpg',1024);

INSERT INTO public.market_messages(conversation_id,sender_id,message,attachment_path,attachment_kind,attachment_mime,attachment_name,attachment_size)
VALUES (current_setting('alwaha.test.conversation_id')::uuid,'41000000-0000-4000-8000-000000000001','',
 '41000000-0000-4000-8000-000000000001/market/'||current_setting('alwaha.test.conversation_id')||'/market-audio.webm',
 'audio','audio/webm','voice-note.webm',2048);

DO $metadata_scope$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.messages(sender_id,receiver_id,message,attachment_path,attachment_kind,attachment_mime,attachment_name,attachment_size)
    VALUES ('41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','',
      '41000000-0000-4000-8000-000000000002/direct/41000000-0000-4000-8000-000000000001/forged.jpg',
      'image','image/jpeg','forged.jpg',512);
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Message metadata accepted an attachment path owned by another sender'; END IF;
END
$metadata_scope$;

DO $sender$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='chat-attachments' AND name LIKE '41000000-0000-4000-8000-000000000001/%') THEN
    RAISE EXCEPTION 'Uploader cannot read own chat attachment';
  END IF;
END
$sender$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000002',true);
DO $recipient$
BEGIN
  IF (SELECT count(*) FROM storage.objects WHERE bucket_id='chat-attachments') <> 2 THEN
    RAISE EXCEPTION 'Direct and market participants must read the two linked attachments';
  END IF;
END
$recipient$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000003',true);
DO $outsider$
BEGIN
  IF (SELECT count(*) FROM storage.objects WHERE bucket_id='chat-attachments') <> 0 THEN
    RAISE EXCEPTION 'A non-participant read private chat attachments';
  END IF;
END
$outsider$;

RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.role','anon',true);
SELECT set_config('request.jwt.claim.sub','',true);
DO $anonymous$
BEGIN
  IF (SELECT count(*) FROM storage.objects WHERE bucket_id='chat-attachments') <> 0 THEN
    RAISE EXCEPTION 'Anonymous users read private chat attachments';
  END IF;
END
$anonymous$;

RESET ROLE;
ROLLBACK;
SELECT 'PRIVATE_CHAT_ATTACHMENTS=PASS' AS result;
