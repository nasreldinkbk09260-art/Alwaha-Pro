-- Alwaha-Pro 3.0.2 marketplace retention and scheduled cleanup.
-- Requires 20261101210000_marketplace_transaction_archive_and_call_auth.sql first.
-- No-warranty archived chats are kept 30 days. Sale snapshots survive through the
-- guarantee plus 30 days. Both parties are notified 7 days before eligible cleanup.
-- Disputed transactions are never automatically removed.
BEGIN;

ALTER TABLE public.market_conversations
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS retention_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS retention_notice_sent_at timestamptz NULL;
ALTER TABLE public.market_transactions
  ADD COLUMN IF NOT EXISTS retention_notice_sent_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS market_conversations_retention_idx
  ON public.market_conversations(retention_until) WHERE retention_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS market_transactions_retention_notice_idx
  ON public.market_transactions(retention_until)
  WHERE retention_notice_sent_at IS NULL AND status <> 'disputed';

-- Backfill already archived/sold listings and extend for any existing sale warranty.
UPDATE public.market_conversations AS c
   SET archived_at=COALESCE(c.archived_at,p.archived_at,p.sold_at,p.updated_at,now()),
       retention_until=GREATEST(
         COALESCE(p.archived_at,p.sold_at,p.updated_at,now())+interval '30 days',
         COALESCE((SELECT max(t.retention_until)
                     FROM public.market_transactions AS t
                    WHERE t.conversation_id=c.id AND t.status<>'disputed'),
                  COALESCE(p.archived_at,p.sold_at,p.updated_at,now())+interval '30 days')
       )
  FROM public.products AS p
 WHERE c.product_id=p.id AND p.status IN ('archived','sold') AND c.retention_until IS NULL;

CREATE OR REPLACE FUNCTION public.sync_market_conversation_retention()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_product_id bigint; v_status text;
BEGIN
  IF TG_OP='DELETE' THEN v_product_id:=OLD.id; v_status:='archived';
  ELSE
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
    v_product_id:=NEW.id; v_status:=NEW.status;
  END IF;
  IF v_status='active' THEN
    IF EXISTS (SELECT 1 FROM public.market_transactions AS t WHERE t.product_id=v_product_id) THEN
      RAISE EXCEPTION 'A product with a recorded sale cannot be reactivated';
    END IF;
    UPDATE public.market_conversations AS c
       SET archived_at=NULL,retention_until=NULL,retention_notice_sent_at=NULL
     WHERE c.product_id=v_product_id;
  ELSIF v_status IN ('archived','sold') THEN
    UPDATE public.market_conversations AS c
       SET archived_at=COALESCE(c.archived_at,now()),
           retention_until=GREATEST(
             COALESCE(c.retention_until,now()+interval '30 days'),
             COALESCE((SELECT max(t.retention_until)
                         FROM public.market_transactions AS t
                        WHERE t.conversation_id=c.id AND t.status<>'disputed'),now()+interval '30 days')
           )
     WHERE c.product_id=v_product_id;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.sync_market_conversation_retention() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS market_product_sync_conversation_retention_update ON public.products;
CREATE TRIGGER market_product_sync_conversation_retention_update
AFTER UPDATE OF status ON public.products
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_market_conversation_retention();
DROP TRIGGER IF EXISTS market_product_sync_conversation_retention_delete ON public.products;
CREATE TRIGGER market_product_sync_conversation_retention_delete
BEFORE DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_market_conversation_retention();

CREATE OR REPLACE FUNCTION public.sync_market_transaction_retention()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NEW.conversation_id IS NOT NULL THEN
    UPDATE public.market_conversations AS c
       SET archived_at=COALESCE(c.archived_at,NEW.sold_at),
           retention_until=GREATEST(COALESCE(c.retention_until,NEW.retention_until),NEW.retention_until)
     WHERE c.id=NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.sync_market_transaction_retention() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS market_transaction_sync_conversation_retention ON public.market_transactions;
CREATE TRIGGER market_transaction_sync_conversation_retention
AFTER INSERT ON public.market_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_market_transaction_retention();

-- Allow only the database owner/service role to archive an expired warranty record.
-- This preserves the client-facing one-way buyer confirmation guard while letting the
-- scheduled task transition active -> archived once the contractual guarantee expires.
CREATE OR REPLACE FUNCTION public.guard_market_buyer_receipt_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  -- Trusted worker may archive an expired warranty.
  IF current_user IN ('postgres','service_role')
     AND OLD.status='active'
     AND NEW.status='archived'
     AND OLD.guarantee_days>0
     AND OLD.guarantee_expires_at IS NOT NULL
     AND OLD.guarantee_expires_at<=now()
     AND (to_jsonb(NEW)-'status') IS NOT DISTINCT FROM (to_jsonb(OLD)-'status') THEN
    RETURN NEW;
  END IF;

  -- Trusted worker may stamp the one-time retention notice only.
  IF current_user IN ('postgres','service_role')
     AND OLD.retention_notice_sent_at IS NULL
     AND NEW.retention_notice_sent_at IS NOT NULL
     AND (to_jsonb(NEW)-'retention_notice_sent_at') IS NOT DISTINCT FROM
         (to_jsonb(OLD)-'retention_notice_sent_at') THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS DISTINCT FROM OLD.buyer_id
     OR OLD.buyer_confirmed_at IS NOT NULL
     OR NEW.buyer_confirmed_at IS NULL
     OR (to_jsonb(NEW)-'buyer_confirmed_at') IS DISTINCT FROM (to_jsonb(OLD)-'buyer_confirmed_at') THEN
    RAISE EXCEPTION 'Only the buyer may confirm receipt once; transaction details are immutable';
  END IF;
  RETURN NEW;
END;
$function$;

-- A bounded privileged daily task sends notices and removes only expired archives.
CREATE OR REPLACE FUNCTION public.purge_expired_marketplace_archives(p_batch_size integer DEFAULT 500)
RETURNS TABLE(notified_conversations integer,notified_transactions integer,deleted_conversations integer,deleted_transactions integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_limit integer; v_notified_conversations integer:=0; v_notified_transactions integer:=0;
  v_deleted_conversations integer:=0; v_deleted_transactions integer:=0; v_ids uuid[]:=ARRAY[]::uuid[];
BEGIN
  IF p_batch_size IS NULL OR p_batch_size<1 THEN RAISE EXCEPTION 'Batch size must be positive'; END IF;
  v_limit:=LEAST(p_batch_size,2000);

  UPDATE public.market_transactions AS t SET status='archived'
   WHERE t.status='active' AND t.guarantee_days>0
     AND t.guarantee_expires_at IS NOT NULL AND t.guarantee_expires_at<=now();

  -- Notify buyer and seller once, 7 days before transaction retention expires.
  -- Lock one bounded set and mark only those rows after the notification insert succeeds.
  WITH due AS MATERIALIZED (
    SELECT t.id,t.buyer_id,t.seller_id,t.retention_until
      FROM public.market_transactions AS t
     WHERE t.status='archived' AND t.retention_notice_sent_at IS NULL
       AND t.retention_until<=now()+interval '7 days'
     ORDER BY t.retention_until,t.id FOR UPDATE SKIP LOCKED LIMIT v_limit
  ), recipients AS (
    SELECT d.id,d.retention_until,d.buyer_id AS recipient_id FROM due AS d
    UNION ALL SELECT d.id,d.retention_until,d.seller_id FROM due AS d
  ), notices AS (
    INSERT INTO public.notifications(recipient_id,title,body,type,is_read,created_at)
    SELECT r.recipient_id,'تنبيه انتهاء أرشيف معاملة السوق',
           'ستنتهي أو انتهت مدة الاحتفاظ بسجل المعاملة والرسائل المرتبطة به. يبدأ الحذف بعد 7 أيام من هذا التنبيه. نزّل نسخة احتياطية إذا أردت الاحتفاظ بها.',
           'market_retention_notice',false,now()
      FROM recipients AS r
    RETURNING id
  )
  UPDATE public.market_transactions AS t
     SET retention_notice_sent_at=now()
    FROM due
   WHERE t.id=due.id;
  GET DIAGNOSTICS v_notified_transactions=ROW_COUNT;

  -- No-sale listing conversations use the 30-day archive window.
  WITH due AS MATERIALIZED (
    SELECT c.id,c.buyer_id,c.seller_id,c.retention_until
      FROM public.market_conversations AS c
     WHERE c.retention_notice_sent_at IS NULL AND c.retention_until<=now()+interval '7 days'
       AND NOT EXISTS (SELECT 1 FROM public.market_transactions AS t WHERE t.conversation_id=c.id)
     ORDER BY c.retention_until,c.id FOR UPDATE SKIP LOCKED LIMIT v_limit
  ), recipients AS (
    SELECT d.id,d.retention_until,d.buyer_id AS recipient_id FROM due AS d
    UNION ALL SELECT d.id,d.retention_until,d.seller_id FROM due AS d
  ), notices AS (
    INSERT INTO public.notifications(recipient_id,title,body,type,is_read,created_at)
    SELECT r.recipient_id,'تنبيه أرشفة محادثة السوق',
           'ستنتهي أو انتهت مدة الاحتفاظ بالمحادثة والإعلان المحفوظ. يبدأ الحذف بعد 7 أيام من هذا التنبيه. نزّل نسخة احتياطية إذا أردت الاحتفاظ بها.',
           'market_retention_notice',false,now()
      FROM recipients AS r
    RETURNING id
  )
  UPDATE public.market_conversations AS c
     SET retention_notice_sent_at=now()
    FROM due
   WHERE c.id=due.id;
  GET DIAGNOSTICS v_notified_conversations=ROW_COUNT;

  -- Disputes and transactions whose retention date is still in the future block chat deletion.
  SELECT COALESCE(array_agg(candidate.id),ARRAY[]::uuid[]) INTO v_ids
    FROM (
      SELECT c.id FROM public.market_conversations AS c
       WHERE c.retention_until IS NOT NULL AND c.retention_until<=now()
         AND c.retention_notice_sent_at IS NOT NULL
         AND c.retention_notice_sent_at<=now()-interval '7 days'
         AND NOT EXISTS (
           SELECT 1 FROM public.market_transactions AS t WHERE t.conversation_id=c.id
             AND (t.status='disputed' OR t.retention_until>now())
         )
       ORDER BY c.retention_until,c.id FOR UPDATE SKIP LOCKED LIMIT v_limit
    ) AS candidate;
  IF cardinality(v_ids)>0 THEN
    DELETE FROM public.market_conversations AS c WHERE c.id=ANY(v_ids);
    GET DIAGNOSTICS v_deleted_conversations=ROW_COUNT;
  END IF;

  WITH expired AS (
    SELECT t.id FROM public.market_transactions AS t
     WHERE t.status='archived' AND t.retention_until<=now()
       AND t.retention_notice_sent_at IS NOT NULL
       AND t.retention_notice_sent_at<=now()-interval '7 days'
     ORDER BY t.retention_until,t.id FOR UPDATE SKIP LOCKED LIMIT v_limit
  )
  DELETE FROM public.market_transactions AS t USING expired AS e WHERE t.id=e.id;
  GET DIAGNOSTICS v_deleted_transactions=ROW_COUNT;

  RETURN QUERY SELECT v_notified_conversations,v_notified_transactions,v_deleted_conversations,v_deleted_transactions;
END;
$function$;
REVOKE ALL ON FUNCTION public.purge_expired_marketplace_archives(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_marketplace_archives(integer) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
DO $schedule$
DECLARE v_job_id bigint;
BEGIN
  FOR v_job_id IN SELECT jobid FROM cron.job WHERE jobname='alwaha-marketplace-retention-daily' LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
  PERFORM cron.schedule('alwaha-marketplace-retention-daily','0 3 * * *','SELECT public.purge_expired_marketplace_archives(500);');
END;
$schedule$;
COMMIT;
