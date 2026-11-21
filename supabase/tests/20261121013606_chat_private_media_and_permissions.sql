-- CI regression tests for private chat and marketplace media.
DO $$
DECLARE
  v_public boolean;
  v_limit bigint;
  v_types text[];
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
  DECLARE
    v_select_policy text;
  BEGIN
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
  END;
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='alwaha_chat_media_delete_own' AND cmd='DELETE') THEN
    RAISE EXCEPTION 'chat media own-delete policy missing';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) THEN
    RAISE EXCEPTION 'storage.objects RLS is not active';
  END IF;
END
$$;
