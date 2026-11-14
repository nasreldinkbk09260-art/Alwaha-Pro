-- Behavioral PostgreSQL test for warranty/retention lifecycle. Run only in disposable CI DB.
DO $alwaha_behavior$
DECLARE
  v_seller uuid := '10000000-0000-0000-0000-000000000001';
  v_buyer uuid := '20000000-0000-0000-0000-000000000002';
  v_product bigint;
  v_product_no_sale bigint;
  v_product_disputed bigint;
  v_conversation uuid;
  v_conversation_no_sale uuid;
  v_conversation_disputed uuid;
  v_transaction uuid;
  v_expired_transaction uuid;
  v_snapshot jsonb;
  v_retention timestamptz;
  v_deleted integer;
BEGIN
  INSERT INTO auth.users(id) VALUES(v_seller),(v_buyer) ON CONFLICT DO NOTHING;

  IF has_table_privilege('authenticated','public.products','DELETE') THEN
    RAISE EXCEPTION 'Authenticated clients must not hard-delete marketplace listings';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='products' AND policyname='products_delete_own') THEN
    RAISE EXCEPTION 'Client-side product delete policy must be removed; use archive lifecycle';
  END IF;

  INSERT INTO public.products(seller_id,title,price,description)
  VALUES(v_seller,'اختبار هاتف','100','وصف محفوظ') RETURNING id INTO v_product;

  PERFORM set_config('request.jwt.claim.sub',v_buyer::text,true);
  INSERT INTO public.market_conversations(product_id,buyer_id,seller_id)
  VALUES(v_product,v_buyer,v_seller) RETURNING id INTO v_conversation;
  SELECT listing_snapshot INTO v_snapshot FROM public.market_conversations WHERE id=v_conversation;
  IF v_snapshot->>'title' IS DISTINCT FROM 'اختبار هاتف' THEN
    RAISE EXCEPTION 'Conversation listing snapshot was not captured';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',v_seller::text,true);
  v_transaction := public.complete_market_sale(v_product,v_buyer,v_conversation,10,'ضمان عشرة أيام');
  SELECT retention_until INTO v_retention FROM public.market_transactions WHERE id=v_transaction;
  IF v_retention < now()+interval '39 days' OR v_retention > now()+interval '41 days' THEN
    RAISE EXCEPTION 'Warranty retention should be guarantee days plus 30 days; got %',v_retention;
  END IF;
  IF (SELECT status FROM public.products WHERE id=v_product) <> 'sold' THEN
    RAISE EXCEPTION 'Sale RPC did not mark listing as sold';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',v_buyer::text,true);
  UPDATE public.market_transactions SET buyer_confirmed_at=now() WHERE id=v_transaction;
  BEGIN
    UPDATE public.market_transactions SET buyer_confirmed_at=now()+interval '1 second' WHERE id=v_transaction;
    RAISE EXCEPTION 'A second receipt confirmation unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='A second receipt confirmation unexpectedly succeeded' THEN RAISE; END IF;
  END;

  -- Create an already-expired archive that is due for a 7-day warning, not immediate purge.
  INSERT INTO public.market_transactions(
    product_id,buyer_id,seller_id,listing_snapshot,guarantee_days,sold_at,
    guarantee_expires_at,retention_until,status
  ) VALUES(
    v_product,v_buyer,v_seller,jsonb_build_object('title','أرشيف تجريبي'),10,
    now()-interval '40 days',now()-interval '1 day',now()-interval '1 day','active'
  ) RETURNING id INTO v_expired_transaction;
  PERFORM public.purge_expired_marketplace_archives(50);
  IF NOT EXISTS (
    SELECT 1 FROM public.market_transactions
     WHERE product_id=v_product AND status='archived' AND retention_notice_sent_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'Expired warranty was not archived and notified'; END IF;
  IF (SELECT count(*) FROM public.notifications WHERE type='market_retention_notice' AND recipient_id IN (v_buyer,v_seller)) < 2 THEN
    RAISE EXCEPTION 'Both transaction participants must receive a retention notice';
  END IF;
  UPDATE public.market_transactions SET retention_notice_sent_at=now()-interval '8 days' WHERE id=v_expired_transaction;
  PERFORM set_config('request.jwt.claim.sub',v_buyer::text,true);
  PERFORM public.approve_market_archive_deletion('transaction',v_expired_transaction,true);
  PERFORM public.purge_expired_marketplace_archives(50);
  IF NOT EXISTS (SELECT 1 FROM public.market_transactions WHERE id=v_expired_transaction) THEN
    RAISE EXCEPTION 'One participant consent must not delete a sale transaction';
  END IF;
  PERFORM set_config('request.jwt.claim.sub',v_seller::text,true);
  PERFORM public.approve_market_archive_deletion('transaction',v_expired_transaction,true);
  PERFORM public.purge_expired_marketplace_archives(50);
  IF EXISTS (SELECT 1 FROM public.market_transactions WHERE id=v_expired_transaction) THEN
    RAISE EXCEPTION 'Transaction should be purged only after both participants consent and the grace period';
  END IF;

  -- A no-sale conversation remains archived after its deadline until both participants approve deletion.
  INSERT INTO public.products(seller_id,title,price,description)
  VALUES(v_seller,'إعلان بلا بيع','50','أرشيف شهر') RETURNING id INTO v_product_no_sale;
  INSERT INTO public.market_conversations(product_id,buyer_id,seller_id)
  VALUES(v_product_no_sale,v_buyer,v_seller) RETURNING id INTO v_conversation_no_sale;
  INSERT INTO public.market_messages(conversation_id,sender_id,message)
  VALUES(v_conversation_no_sale,v_buyer,'رسالة محفوظة');
  DELETE FROM public.products WHERE id=v_product_no_sale;
  IF (SELECT product_id IS NOT NULL OR retention_until IS NULL FROM public.market_conversations WHERE id=v_conversation_no_sale) THEN
    RAISE EXCEPTION 'Deleting a listing must retain its conversation snapshot and archive deadline';
  END IF;
  UPDATE public.market_conversations SET retention_until=now()-interval '1 second' WHERE id=v_conversation_no_sale;
  PERFORM public.purge_expired_marketplace_archives(50);
  IF NOT EXISTS (SELECT 1 FROM public.market_conversations WHERE id=v_conversation_no_sale AND retention_notice_sent_at IS NOT NULL)
     OR NOT EXISTS (SELECT 1 FROM public.market_messages WHERE conversation_id=v_conversation_no_sale) THEN
    RAISE EXCEPTION 'Late retention job must notify first and preserve the conversation during grace';
  END IF;
  UPDATE public.market_conversations SET retention_notice_sent_at=now()-interval '8 days' WHERE id=v_conversation_no_sale;
  PERFORM set_config('request.jwt.claim.sub',v_buyer::text,true);
  PERFORM public.approve_market_archive_deletion('conversation',v_conversation_no_sale,true);
  PERFORM public.purge_expired_marketplace_archives(50);
  IF NOT EXISTS (SELECT 1 FROM public.market_conversations WHERE id=v_conversation_no_sale)
     OR NOT EXISTS (SELECT 1 FROM public.market_messages WHERE conversation_id=v_conversation_no_sale) THEN
    RAISE EXCEPTION 'One participant consent must retain the conversation and its messages';
  END IF;
  PERFORM set_config('request.jwt.claim.sub',v_seller::text,true);
  PERFORM public.approve_market_archive_deletion('conversation',v_conversation_no_sale,true);
  PERFORM public.purge_expired_marketplace_archives(50);
  IF EXISTS (SELECT 1 FROM public.market_conversations WHERE id=v_conversation_no_sale)
     OR EXISTS (SELECT 1 FROM public.market_messages WHERE conversation_id=v_conversation_no_sale) THEN
    RAISE EXCEPTION 'Conversation/messages should be purged only after both participants consent';
  END IF;

  -- A disputed transaction blocks conversation cleanup even beyond the nominal deadline.
  INSERT INTO public.products(seller_id,title,price,description)
  VALUES(v_seller,'صفقة عليها اعتراض','75','لا تحذف') RETURNING id INTO v_product_disputed;
  INSERT INTO public.market_conversations(product_id,buyer_id,seller_id)
  VALUES(v_product_disputed,v_buyer,v_seller) RETURNING id INTO v_conversation_disputed;
  DELETE FROM public.products WHERE id=v_product_disputed;
  UPDATE public.market_conversations SET retention_until=now()-interval '1 second' WHERE id=v_conversation_disputed;
  INSERT INTO public.market_transactions(conversation_id,product_id,buyer_id,seller_id,listing_snapshot,retention_until,status)
  VALUES(v_conversation_disputed,v_product_disputed,v_buyer,v_seller,jsonb_build_object('title','نزاع'),now()-interval '1 day','disputed');
  PERFORM public.purge_expired_marketplace_archives(50);
  IF NOT EXISTS (SELECT 1 FROM public.market_conversations WHERE id=v_conversation_disputed)
     OR NOT EXISTS (SELECT 1 FROM public.market_transactions WHERE conversation_id=v_conversation_disputed AND status='disputed') THEN
    RAISE EXCEPTION 'Disputed transaction/conversation was deleted';
  END IF;

  -- Warranty sale history should remain until guarantee expiry + 30 days.
  IF NOT EXISTS (SELECT 1 FROM public.market_transactions WHERE id=v_transaction AND retention_until>now()+interval '30 days') THEN
    RAISE EXCEPTION 'Warranty sale history was not retained';
  END IF;
END;
$alwaha_behavior$;
