-- Regression checks for marketplace/chat least-privilege write grants.
DO $test$
BEGIN
  IF has_table_privilege('authenticated','public.market_conversations','INSERT')
     OR NOT has_column_privilege('authenticated','public.market_conversations','product_id','INSERT')
     OR NOT has_column_privilege('authenticated','public.market_conversations','buyer_id','INSERT')
     OR NOT has_column_privilege('authenticated','public.market_conversations','seller_id','INSERT')
     OR has_column_privilege('authenticated','public.market_conversations','listing_snapshot','INSERT')
     OR has_column_privilege('authenticated','public.market_conversations','archived_at','INSERT')
     OR has_column_privilege('authenticated','public.market_conversations','retention_until','INSERT')
     OR has_column_privilege('authenticated','public.market_conversations','retention_notice_sent_at','INSERT')
     OR has_column_privilege('authenticated','public.market_conversations','delete_approved_by_buyer_at','INSERT')
     OR has_column_privilege('authenticated','public.market_conversations','delete_approved_by_seller_at','INSERT')
     OR has_column_privilege('authenticated','public.market_conversations','created_at','INSERT') THEN
    RAISE EXCEPTION 'market_conversations insert grants are not least-privilege';
  END IF;

  IF has_table_privilege('authenticated','public.market_messages','INSERT')
     OR NOT has_column_privilege('authenticated','public.market_messages','conversation_id','INSERT')
     OR NOT has_column_privilege('authenticated','public.market_messages','sender_id','INSERT')
     OR NOT has_column_privilege('authenticated','public.market_messages','message','INSERT')
     OR NOT has_column_privilege('authenticated','public.market_messages','reply_to_id','INSERT')
     OR has_column_privilege('authenticated','public.market_messages','id','INSERT')
     OR has_column_privilege('authenticated','public.market_messages','created_at','INSERT')
     OR has_column_privilege('authenticated','public.market_messages','read_at','INSERT')
     OR has_table_privilege('authenticated','public.market_messages','UPDATE')
     OR NOT has_column_privilege('authenticated','public.market_messages','read_at','UPDATE')
     OR has_column_privilege('authenticated','public.market_messages','message','UPDATE') THEN
    RAISE EXCEPTION 'market_messages grants are not least-privilege';
  END IF;

  IF has_table_privilege('authenticated','public.marketplace_reports','INSERT')
     OR NOT has_column_privilege('authenticated','public.marketplace_reports','product_id','INSERT')
     OR NOT has_column_privilege('authenticated','public.marketplace_reports','seller_id','INSERT')
     OR NOT has_column_privilege('authenticated','public.marketplace_reports','reporter_id','INSERT')
     OR NOT has_column_privilege('authenticated','public.marketplace_reports','reason','INSERT')
     OR has_column_privilege('authenticated','public.marketplace_reports','status','INSERT')
     OR has_column_privilege('authenticated','public.marketplace_reports','created_at','INSERT')
     OR has_column_privilege('authenticated','public.marketplace_reports','reviewed_at','INSERT')
     OR has_table_privilege('authenticated','public.marketplace_reports','UPDATE')
     OR NOT has_column_privilege('authenticated','public.marketplace_reports','status','UPDATE')
     OR NOT has_column_privilege('authenticated','public.marketplace_reports','reviewed_at','UPDATE') THEN
    RAISE EXCEPTION 'marketplace_reports grants are not least-privilege';
  END IF;

  IF has_table_privilege('authenticated','public.marketplace_reviews','INSERT')
     OR NOT has_column_privilege('authenticated','public.marketplace_reviews','product_id','INSERT')
     OR NOT has_column_privilege('authenticated','public.marketplace_reviews','seller_id','INSERT')
     OR NOT has_column_privilege('authenticated','public.marketplace_reviews','reviewer_id','INSERT')
     OR NOT has_column_privilege('authenticated','public.marketplace_reviews','rating','INSERT')
     OR NOT has_column_privilege('authenticated','public.marketplace_reviews','review','INSERT')
     OR has_column_privilege('authenticated','public.marketplace_reviews','created_at','INSERT')
     OR has_table_privilege('authenticated','public.marketplace_reviews','UPDATE') THEN
    RAISE EXCEPTION 'marketplace_reviews grants are not least-privilege';
  END IF;

  IF has_table_privilege('authenticated','public.friend_requests','INSERT')
     OR NOT has_column_privilege('authenticated','public.friend_requests','requester_id','INSERT')
     OR NOT has_column_privilege('authenticated','public.friend_requests','target_id','INSERT')
     OR has_column_privilege('authenticated','public.friend_requests','status','INSERT')
     OR has_column_privilege('authenticated','public.friend_requests','created_at','INSERT')
     OR has_table_privilege('authenticated','public.friend_requests','UPDATE')
     OR NOT has_column_privilege('authenticated','public.friend_requests','status','UPDATE') THEN
    RAISE EXCEPTION 'friend_requests grants are not least-privilege';
  END IF;

  IF has_table_privilege('authenticated','public.notifications','UPDATE')
     OR NOT has_column_privilege('authenticated','public.notifications','is_read','UPDATE')
     OR has_column_privilege('authenticated','public.notifications','recipient_id','UPDATE')
     OR has_column_privilege('authenticated','public.notifications','title','UPDATE')
     OR has_column_privilege('authenticated','public.notifications','body','UPDATE')
     OR has_column_privilege('authenticated','public.notifications','type','UPDATE')
     OR has_column_privilege('authenticated','public.notifications','created_at','UPDATE') THEN
    RAISE EXCEPTION 'notifications update grants must be limited to is_read';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='market_messages' AND policyname='market_messages_insert_participant' AND cmd='INSERT')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='market_messages' AND policyname='market_messages_update_recipient_read_state' AND cmd='UPDATE')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='market_conversations' AND policyname='market_conversations_insert_buyer_active_listing' AND cmd='INSERT')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_reports' AND policyname='marketplace_reports_insert_own' AND cmd='INSERT')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketplace_reviews' AND policyname='marketplace_reviews_insert_verified_buyer' AND cmd='INSERT')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='friend_requests' AND policyname='friend_requests_insert_requester' AND cmd='INSERT')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_update_own' AND cmd='UPDATE') THEN
    RAISE EXCEPTION 'Expected participant/admin RLS policies are missing';
  END IF;
END;
$test$;
