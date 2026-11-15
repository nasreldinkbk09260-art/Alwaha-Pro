DO $test$
DECLARE
  v_buyer uuid := '11111111-1111-4111-8111-111111111111';
  v_seller uuid := '22222222-2222-4222-8222-222222222222';
  v_product bigint;
  v_conversation uuid;
  v_transaction uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.market_transactions'::regclass AND conname='market_transactions_buyer_id_fkey' AND confdeltype='n')
     OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.market_transactions'::regclass AND conname='market_transactions_seller_id_fkey' AND confdeltype='n')
     OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.market_conversations'::regclass AND conname='market_conversations_buyer_id_fkey' AND confdeltype='n')
     OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.market_conversations'::regclass AND conname='market_conversations_seller_id_fkey' AND confdeltype='n')
     OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.marketplace_reports'::regclass AND conname='marketplace_reports_reporter_id_fkey' AND confdeltype='n')
     OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.marketplace_reviews'::regclass AND conname='marketplace_reviews_reviewer_id_fkey' AND confdeltype='n') THEN
    RAISE EXCEPTION 'Auth participant relations must use ON DELETE SET NULL, never cascade';
  END IF;
  IF (SELECT attnotnull FROM pg_attribute WHERE attrelid='public.market_transactions'::regclass AND attname='buyer_id' AND NOT attisdropped)
     OR (SELECT attnotnull FROM pg_attribute WHERE attrelid='public.market_transactions'::regclass AND attname='seller_id' AND NOT attisdropped)
     OR (SELECT attnotnull FROM pg_attribute WHERE attrelid='public.market_conversations'::regclass AND attname='buyer_id' AND NOT attisdropped)
     OR (SELECT attnotnull FROM pg_attribute WHERE attrelid='public.market_conversations'::regclass AND attname='seller_id' AND NOT attisdropped)
     OR (SELECT attnotnull FROM pg_attribute WHERE attrelid='public.market_messages'::regclass AND attname='sender_id' AND NOT attisdropped)
     OR (SELECT attnotnull FROM pg_attribute WHERE attrelid='public.marketplace_reports'::regclass AND attname='reporter_id' AND NOT attisdropped)
     OR (SELECT attnotnull FROM pg_attribute WHERE attrelid='public.marketplace_reviews'::regclass AND attname='reviewer_id' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Marketplace participant identity fields must allow anonymization';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='alwaha_detach_marketplace_before_auth_delete' AND NOT tgisinternal)
     OR NOT pg_get_functiondef('app_private.detach_marketplace_user_before_auth_delete()'::regprocedure) ILIKE '%delete_approved_by_buyer_at%'
     OR NOT pg_get_functiondef('app_private.detach_marketplace_user_before_auth_delete()'::regprocedure) ILIKE '%delete_approved_by_seller_at%' THEN
    RAISE EXCEPTION 'Auth deletion retention trigger is incomplete';
  END IF;
  IF NOT pg_get_functiondef('public.purge_expired_marketplace_archives(integer)'::regprocedure) ILIKE '%d.buyer_id IS NOT NULL%' OR NOT pg_get_functiondef('public.purge_expired_marketplace_archives(integer)'::regprocedure) ILIKE '%d.seller_id IS NOT NULL%' THEN
    RAISE EXCEPTION 'Retention scheduler must skip notifications for deleted participants';
  END IF;

  INSERT INTO auth.users(id) VALUES(v_buyer),(v_seller);
  -- auth.users AFTER INSERT trigger may already have created these profile rows.
  INSERT INTO public.users(id,first_name,username)
  VALUES(v_buyer,'Buyer','retention_buyer'),(v_seller,'Seller','retention_seller')
  ON CONFLICT (id) DO UPDATE
    SET first_name=EXCLUDED.first_name,username=EXCLUDED.username;
  INSERT INTO public.products(seller_id,title,price,category,description,seller_email,status)
    VALUES(v_seller,'Warranty snapshot product','120','test','retained snapshot','seller@example.invalid','active')
    RETURNING id INTO v_product;
  INSERT INTO public.market_conversations(product_id,buyer_id,seller_id)
    VALUES(v_product,v_buyer,v_seller) RETURNING id INTO v_conversation;
  INSERT INTO public.market_messages(conversation_id,sender_id,message)
    VALUES(v_conversation,v_seller,'Warranty conversation must remain');
  INSERT INTO public.market_transactions(
    conversation_id,product_id,buyer_id,seller_id,listing_snapshot,agreement_note,guarantee_days,
    sold_at,guarantee_expires_at,retention_until,status
  ) VALUES (
    v_conversation,v_product,v_buyer,v_seller,
    jsonb_build_object('id',v_product,'title','Warranty snapshot product','price','120'),
    'warranty agreement',45,now(),now()+interval '45 days',now()+interval '75 days','active'
  ) RETURNING id INTO v_transaction;

  -- Exercise the same narrowly scoped participant detachment update used by the Auth trigger.
  UPDATE public.market_transactions
     SET buyer_id=NULL,delete_approved_by_buyer_at=now()
   WHERE id=v_transaction;
  UPDATE public.market_conversations
     SET buyer_id=NULL,delete_approved_by_buyer_at=now()
   WHERE id=v_conversation;
  UPDATE public.market_messages SET sender_id=NULL
   WHERE conversation_id=v_conversation AND sender_id=v_seller;
  UPDATE public.products
     SET seller_id=NULL,seller_email='',status='archived',archived_at=now()
   WHERE id=v_product;

  IF NOT EXISTS(SELECT 1 FROM public.market_transactions WHERE id=v_transaction AND buyer_id IS NULL AND seller_id=v_seller
      AND delete_approved_by_buyer_at IS NOT NULL AND listing_snapshot->>'title'='Warranty snapshot product'
      AND retention_until>now()) THEN
    RAISE EXCEPTION 'Market transaction snapshot and warranty must survive participant detachment';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.market_conversations WHERE id=v_conversation AND buyer_id IS NULL AND seller_id=v_seller) THEN
    RAISE EXCEPTION 'Market conversation must survive participant detachment';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.market_messages WHERE conversation_id=v_conversation AND sender_id IS NULL AND message='Warranty conversation must remain') THEN
    RAISE EXCEPTION 'Market messages must survive sender anonymization';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=v_product AND seller_id IS NULL AND status='archived' AND seller_email='') THEN
    RAISE EXCEPTION 'Deleted seller listing must be archived and contact data cleared';
  END IF;
END;
$test$;
