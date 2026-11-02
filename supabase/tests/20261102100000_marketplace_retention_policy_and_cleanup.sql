-- Read-only deployment assertions; run after both 20261101210000 and 20261102100000.
DO $alwaha_test$
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE EXCEPTION 'cron.job is not installed/available';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='alwaha-marketplace-retention-daily' AND active) THEN
    RAISE EXCEPTION 'Daily Alwaha marketplace retention job is not active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='market_conversations' AND column_name='retention_until') THEN
    RAISE EXCEPTION 'market_conversations.retention_until missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='market_transactions' AND column_name='retention_notice_sent_at') THEN
    RAISE EXCEPTION 'market_transactions.retention_notice_sent_at missing';
  END IF;
  IF has_function_privilege('anon','public.purge_expired_marketplace_archives(integer)','EXECUTE')
     OR has_function_privilege('authenticated','public.purge_expired_marketplace_archives(integer)','EXECUTE') THEN
    RAISE EXCEPTION 'Public client roles must not execute the retention purge function';
  END IF;
  IF NOT has_function_privilege('service_role','public.purge_expired_marketplace_archives(integer)','EXECUTE') THEN
    RAISE EXCEPTION 'service_role must be able to invoke the bounded retention function';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='market_product_sync_conversation_retention_delete' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Product deletion retention trigger missing';
  END IF;
END;
$alwaha_test$;
