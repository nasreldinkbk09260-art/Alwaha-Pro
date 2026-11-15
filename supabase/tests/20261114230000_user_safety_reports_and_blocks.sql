DO $test$
DECLARE
  v_a uuid := '11111111-1111-4111-8111-111111111111';
  v_b uuid := '22222222-2222-4222-8222-222222222222';
  v_post bigint; v_reel bigint; v_comment bigint;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.user_blocks'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.content_reports'::regclass) THEN
    RAISE EXCEPTION 'Safety tables require RLS';
  END IF;
  IF has_table_privilege('anon','public.user_blocks','SELECT')
     OR has_table_privilege('authenticated','public.user_blocks','INSERT')
     OR has_table_privilege('authenticated','public.content_reports','INSERT')
     OR has_table_privilege('authenticated','public.content_reports','SELECT')
     OR NOT has_table_privilege('service_role','public.user_blocks','INSERT')
     OR NOT has_table_privilege('service_role','public.content_reports','INSERT') THEN
    RAISE EXCEPTION 'Safety tables must be accessible only to the server role';
  END IF;
  IF NOT has_function_privilege('authenticated','app_private.is_user_blocked(uuid,uuid)','EXECUTE')
     OR has_function_privilege('anon','app_private.is_user_blocked(uuid,uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','app_private.can_interact_with_content(uuid,text,text)','EXECUTE')
     OR has_function_privilege('anon','app_private.can_interact_with_content(uuid,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Safety helper execution grants are incorrect';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app_private' AND p.proname='is_user_blocked' AND p.prosecdef AND p.proconfig @> ARRAY['search_path=""']::text[])
     OR NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app_private' AND p.proname='can_interact_with_content' AND p.prosecdef AND p.proconfig @> ARRAY['search_path=""']::text[]) THEN
    RAISE EXCEPTION 'Safety helper search_path must be empty';
  END IF;

  INSERT INTO public.users(id,first_name,username) VALUES(v_a,'A','safety_a'),(v_b,'B','safety_b') ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.posts(author_id,content) VALUES(v_b,'test post') RETURNING id INTO v_post;
  INSERT INTO public.reels(author_id,title) VALUES(v_b,'test reel') RETURNING id INTO v_reel;
  INSERT INTO public.comments(target_id,target_type,user_id,content) VALUES(v_post::text,'post',v_b,'test comment') RETURNING id INTO v_comment;
  INSERT INTO public.user_blocks(blocker_id,blocked_user_id) VALUES(v_a,v_b);
  IF NOT app_private.is_user_blocked(v_a,v_b) OR NOT app_private.is_user_blocked(v_b,v_a) THEN
    RAISE EXCEPTION 'Block must apply in both directions';
  END IF;
  IF app_private.can_interact_with_content(v_a,'post',v_post::text)
     OR app_private.can_interact_with_content(v_a,'reel',v_reel::text)
     OR app_private.can_interact_with_content(v_a,'comment',v_comment::text) THEN
    RAISE EXCEPTION 'Blocked interactions were not denied';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='messages_insert_sender_accepted_friends' AND with_check ILIKE '%app_private.is_user_blocked%')
     OR NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='market_messages' AND policyname='market_messages_insert_participant' AND with_check ILIKE '%app_private.is_user_blocked%')
     OR NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='comments' AND policyname='comments_insert_own' AND with_check ILIKE '%app_private.can_interact_with_content%')
     OR NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='friend_requests' AND policyname='friend_requests_insert_requester' AND with_check ILIKE '%app_private.is_user_blocked%') THEN
    RAISE EXCEPTION 'A key communication/content insert policy is missing the block guard';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename IN ('user_blocks','content_reports')) THEN
    RAISE EXCEPTION 'Safety tables must not have direct client policies';
  END IF;
END;
$test$;
