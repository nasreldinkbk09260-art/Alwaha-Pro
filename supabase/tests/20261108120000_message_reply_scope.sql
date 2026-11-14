BEGIN;
DO $$ BEGIN
  IF NOT has_function_privilege('authenticated','public.can_reply_to_direct_message(bigint,uuid,uuid)','EXECUTE') OR
     NOT has_function_privilege('authenticated','public.can_reply_to_market_message(uuid,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated chat participants must execute reply predicates through RLS';
  END IF;
  IF has_function_privilege('anon','public.can_reply_to_direct_message(bigint,uuid,uuid)','EXECUTE') OR
     has_function_privilege('anon','public.can_reply_to_market_message(uuid,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous callers must not execute reply scope predicates';
  END IF;
END $$;
INSERT INTO auth.users(id) VALUES ('30000000-0000-4000-8000-000000000001'),('30000000-0000-4000-8000-000000000002'),('30000000-0000-4000-8000-000000000003') ON CONFLICT DO NOTHING;
INSERT INTO public.friend_requests(requester_id,target_id,status) VALUES ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','accepted'),('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','accepted');
INSERT INTO public.messages(sender_id,receiver_id,message) VALUES ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','direct parent A-B'),('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','direct parent A-C');
INSERT INTO public.products(seller_id,title,price,description) VALUES ('30000000-0000-4000-8000-000000000002','reply listing 1','10','test'),('30000000-0000-4000-8000-000000000002','reply listing 2','20','test');
INSERT INTO public.market_conversations(product_id,buyer_id,seller_id) SELECT id,'30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002' FROM public.products WHERE title LIKE 'reply listing %' ORDER BY title;
INSERT INTO public.market_messages(conversation_id,sender_id,message) SELECT c.id,'30000000-0000-4000-8000-000000000002','market parent '||p.title FROM public.market_conversations c JOIN public.products p ON p.id=c.product_id WHERE p.title LIKE 'reply listing %' ORDER BY p.title;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
INSERT INTO public.messages(sender_id,receiver_id,message,reply_to_id) SELECT '30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','valid reply A-B',m.id FROM public.messages m WHERE m.message='direct parent A-B';
DO $$ BEGIN BEGIN INSERT INTO public.messages(sender_id,receiver_id,message,reply_to_id) SELECT '30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','cross-chat reply',m.id FROM public.messages m WHERE m.message='direct parent A-C'; RAISE EXCEPTION 'Cross-chat direct reply unexpectedly passed RLS'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
INSERT INTO public.market_messages(conversation_id,sender_id,message,reply_to_id) SELECT c.id,'30000000-0000-4000-8000-000000000002','valid market reply',m.id FROM public.market_conversations c JOIN public.market_messages m ON m.conversation_id=c.id JOIN public.products p ON p.id=c.product_id WHERE p.title='reply listing 1' AND m.message='market parent reply listing 1';
DO $$ BEGIN BEGIN INSERT INTO public.market_messages(conversation_id,sender_id,message,reply_to_id) SELECT c1.id,'30000000-0000-4000-8000-000000000002','cross-conversation reply',m.id FROM public.market_conversations c1 JOIN public.products p1 ON p1.id=c1.product_id CROSS JOIN public.market_conversations c2 JOIN public.products p2 ON p2.id=c2.product_id JOIN public.market_messages m ON m.conversation_id=c2.id WHERE p1.title='reply listing 1' AND p2.title='reply listing 2' AND m.message='market parent reply listing 2'; RAISE EXCEPTION 'Cross-conversation market reply unexpectedly passed RLS'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
ROLLBACK;
SELECT 'CHAT_REPLY_SCOPE=PASS' AS result;