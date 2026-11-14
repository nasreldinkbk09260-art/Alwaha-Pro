-- Proves marketplace conversations/messages are independent from friend requests.
-- The fixture intentionally has no public.friend_requests table: a hidden friendship
-- dependency would fail this test rather than pass on a coincidental accepted friendship.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname='public' AND tablename='market_messages'
       AND indexname='market_messages_sender_id_idx'
  ) THEN
    RAISE EXCEPTION 'Missing index for market_messages.sender_id foreign key';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.friend_requests') IS NOT NULL THEN
    RAISE EXCEPTION 'CI fixture unexpectedly contains friend_requests; this test requires no friendship prerequisite';
  END IF;
END
$$;

INSERT INTO auth.users(id) VALUES
 ('90000000-0000-4000-8000-000000000001'),
 ('90000000-0000-4000-8000-000000000002'),
 ('90000000-0000-4000-8000-000000000003')
ON CONFLICT DO NOTHING;

INSERT INTO public.products(
 id,seller_id,title,price,category,description,location_label,status
) VALUES (
 990301,'90000000-0000-4000-8000-000000000002',
 'R7.3 chat regression listing','100','اختبار','Listing used for CI only','CI','active'
) ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
INSERT INTO public.market_conversations(id,product_id,buyer_id,seller_id)
VALUES (
 '99030000-0000-4000-8000-000000000001',990301,
 '90000000-0000-4000-8000-000000000001',
 '90000000-0000-4000-8000-000000000002'
);
INSERT INTO public.market_messages(id,conversation_id,sender_id,message)
VALUES (
 '99030000-0000-4000-8000-000000000011',
 '99030000-0000-4000-8000-000000000001',
 '90000000-0000-4000-8000-000000000001','Hello seller, is this available?'
);
DO $$
DECLARE v_snapshot jsonb; v_count integer;
BEGIN
  SELECT listing_snapshot INTO v_snapshot FROM public.market_conversations
   WHERE id='99030000-0000-4000-8000-000000000001';
  IF v_snapshot->>'title' <> 'R7.3 chat regression listing' THEN
    RAISE EXCEPTION 'Conversation listing snapshot missing or incorrect: %',v_snapshot;
  END IF;
  SELECT count(*) INTO v_count FROM public.market_messages
   WHERE conversation_id='99030000-0000-4000-8000-000000000001';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Buyer cannot read their inserted market message'; END IF;
END
$$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.market_messages
   WHERE conversation_id='99030000-0000-4000-8000-000000000001';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Seller cannot read buyer market message'; END IF;
END
$$;
INSERT INTO public.market_messages(id,conversation_id,sender_id,message)
VALUES (
 '99030000-0000-4000-8000-000000000012',
 '99030000-0000-4000-8000-000000000001',
 '90000000-0000-4000-8000-000000000002','Yes, it is available.'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);
DO $$
DECLARE v_conversations integer; v_messages integer;
BEGIN
  SELECT count(*) INTO v_conversations FROM public.market_conversations
   WHERE id='99030000-0000-4000-8000-000000000001';
  SELECT count(*) INTO v_messages FROM public.market_messages
   WHERE conversation_id='99030000-0000-4000-8000-000000000001';
  IF v_conversations <> 0 OR v_messages <> 0 THEN
    RAISE EXCEPTION 'Non-participant can read marketplace conversation/messages';
  END IF;
END
$$;

RESET ROLE;
ROLLBACK;

SELECT 'MARKETPLACE_NONFRIEND_CONVERSATION=PASS' AS result;
