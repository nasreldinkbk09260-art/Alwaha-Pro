BEGIN;
INSERT INTO auth.users(id) VALUES ('40000000-0000-4000-8000-000000000001'),('40000000-0000-4000-8000-000000000002') ON CONFLICT DO NOTHING;
INSERT INTO public.friend_requests(requester_id,target_id,status) VALUES ('40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','pending') RETURNING id;
DO $$ DECLARE v_id bigint; v_count integer; BEGIN
  SELECT id INTO v_id FROM public.friend_requests WHERE requester_id='40000000-0000-4000-8000-000000000001' AND target_id='40000000-0000-4000-8000-000000000002' AND status='pending' ORDER BY id DESC LIMIT 1;
  UPDATE public.friend_requests SET status='accepted' WHERE id=v_id;
  UPDATE public.friend_requests SET status='accepted' WHERE id=v_id;
  SELECT count(*) INTO v_count FROM public.notifications WHERE recipient_id='40000000-0000-4000-8000-000000000001' AND type='friend_request_accepted' AND replace(coalesce(body,''),' ','') LIKE '%"friend_request_id":'||v_id::text||'%';
  IF v_count<>1 THEN RAISE EXCEPTION 'Expected exactly one acceptance notification for the requester, found %',v_count; END IF;
  IF EXISTS (SELECT 1 FROM public.notifications WHERE recipient_id='40000000-0000-4000-8000-000000000002' AND type='friend_request_accepted') THEN
    RAISE EXCEPTION 'Acceptance notification must be delivered to the original requester only';
  END IF;
END $$;
ROLLBACK;
SELECT 'FRIEND_REQUEST_ACCEPTED_NOTIFICATION=PASS' AS result;