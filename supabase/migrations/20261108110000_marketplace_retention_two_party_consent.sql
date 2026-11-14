-- Two-party consent for marketplace archive deletion.
BEGIN;
ALTER TABLE public.market_conversations ADD COLUMN IF NOT EXISTS delete_approved_by_buyer_at timestamptz NULL, ADD COLUMN IF NOT EXISTS delete_approved_by_seller_at timestamptz NULL;
ALTER TABLE public.market_transactions ADD COLUMN IF NOT EXISTS delete_approved_by_buyer_at timestamptz NULL, ADD COLUMN IF NOT EXISTS delete_approved_by_seller_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS market_conversations_retention_consents_idx ON public.market_conversations(retention_until,retention_notice_sent_at) WHERE delete_approved_by_buyer_at IS NOT NULL AND delete_approved_by_seller_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS market_transactions_retention_consents_idx ON public.market_transactions(retention_until,retention_notice_sent_at) WHERE delete_approved_by_buyer_at IS NOT NULL AND delete_approved_by_seller_at IS NOT NULL;

-- Preserve buyer receipt confirmation while allowing a participant to set/revoke only their own retention consent.
CREATE OR REPLACE FUNCTION public.guard_market_buyer_receipt_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  -- Trusted worker may stamp the one-time retention notice only.
  IF current_user IN ('postgres','service_role')
     AND NEW.retention_notice_sent_at IS DISTINCT FROM OLD.retention_notice_sent_at
     AND (to_jsonb(NEW)-'retention_notice_sent_at') IS NOT DISTINCT FROM
         (to_jsonb(OLD)-'retention_notice_sent_at') THEN
    RETURN NEW;
  END IF;
  IF current_user IN ('postgres','service_role')
     AND OLD.status='active'
     AND NEW.status='archived'
     AND OLD.guarantee_days>0
     AND OLD.guarantee_expires_at IS NOT NULL
     AND OLD.guarantee_expires_at<=now()
     AND (to_jsonb(NEW)-'status') IS NOT DISTINCT FROM (to_jsonb(OLD)-'status') THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NOT DISTINCT FROM OLD.buyer_id
     AND NEW.delete_approved_by_buyer_at IS DISTINCT FROM OLD.delete_approved_by_buyer_at
     AND (to_jsonb(NEW)-'delete_approved_by_buyer_at') IS NOT DISTINCT FROM
         (to_jsonb(OLD)-'delete_approved_by_buyer_at') THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NOT DISTINCT FROM OLD.seller_id
     AND NEW.delete_approved_by_seller_at IS DISTINCT FROM OLD.delete_approved_by_seller_at
     AND (to_jsonb(NEW)-'delete_approved_by_seller_at') IS NOT DISTINCT FROM
         (to_jsonb(OLD)-'delete_approved_by_seller_at') THEN
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

-- Explicit, reversible consent RPC; participants cannot edit the other side's approval.
CREATE OR REPLACE FUNCTION public.approve_market_archive_deletion(
  p_record_type text, p_record_id uuid, p_approve boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_uid uuid:=auth.uid(); v_rows integer:=0; v_role text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_record_id IS NULL OR p_record_type IS NULL OR p_record_type NOT IN ('conversation','transaction') OR p_approve IS NULL THEN
    RAISE EXCEPTION 'Invalid retention consent request' USING ERRCODE='22023';
  END IF;
  IF p_record_type='conversation' THEN
    UPDATE public.market_conversations
       SET delete_approved_by_buyer_at=CASE WHEN p_approve THEN COALESCE(delete_approved_by_buyer_at,now()) ELSE NULL END
     WHERE id=p_record_id AND buyer_id=v_uid AND retention_notice_sent_at IS NOT NULL AND retention_until IS NOT NULL AND archived_at IS NOT NULL;
    GET DIAGNOSTICS v_rows=ROW_COUNT;
    IF v_rows>0 THEN v_role:='buyer'; ELSE
      UPDATE public.market_conversations
         SET delete_approved_by_seller_at=CASE WHEN p_approve THEN COALESCE(delete_approved_by_seller_at,now()) ELSE NULL END
       WHERE id=p_record_id AND seller_id=v_uid AND retention_notice_sent_at IS NOT NULL AND retention_until IS NOT NULL AND archived_at IS NOT NULL;
      GET DIAGNOSTICS v_rows=ROW_COUNT; IF v_rows>0 THEN v_role:='seller'; END IF;
    END IF;
  ELSE
    UPDATE public.market_transactions
       SET delete_approved_by_buyer_at=CASE WHEN p_approve THEN COALESCE(delete_approved_by_buyer_at,now()) ELSE NULL END
     WHERE id=p_record_id AND buyer_id=v_uid AND status='archived' AND retention_notice_sent_at IS NOT NULL AND retention_until IS NOT NULL;
    GET DIAGNOSTICS v_rows=ROW_COUNT;
    IF v_rows>0 THEN v_role:='buyer'; ELSE
      UPDATE public.market_transactions
         SET delete_approved_by_seller_at=CASE WHEN p_approve THEN COALESCE(delete_approved_by_seller_at,now()) ELSE NULL END
       WHERE id=p_record_id AND seller_id=v_uid AND status='archived' AND retention_notice_sent_at IS NOT NULL AND retention_until IS NOT NULL;
      GET DIAGNOSTICS v_rows=ROW_COUNT; IF v_rows>0 THEN v_role:='seller'; END IF;
    END IF;
  END IF;
  IF v_rows=0 THEN RAISE EXCEPTION 'Record unavailable for this participant or retention notice not sent' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('record_type',p_record_type,'record_id',p_record_id,'participant_role',v_role,'approved',p_approve);
END;
$function$;
REVOKE ALL ON FUNCTION public.approve_market_archive_deletion(text,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_market_archive_deletion(text,uuid,boolean) TO authenticated;

-- The scheduled task still notifies both sides, but purges only after both sides approve.
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
           'انتهت أو قاربت مدة الاحتفاظ بسجل المعاملة. لن يتم الحذف تلقائياً؛ لا يحذف الأرشيف إلا بعد موافقة المشتري والبائع ومرور 7 أيام كاملة بعد هذا الإشعار.',
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
           'انتهت أو قاربت مدة الاحتفاظ بالمحادثة والإعلان المحفوظ. لن يتم الحذف تلقائياً؛ لا تحذف المحادثة إلا بعد موافقة الطرفين ومرور 7 أيام كاملة بعد هذا الإشعار.',
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
         AND c.delete_approved_by_buyer_at IS NOT NULL
         AND c.delete_approved_by_seller_at IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.market_transactions AS t WHERE t.conversation_id=c.id
             AND (t.status='disputed' OR t.retention_until>now()
               OR t.delete_approved_by_buyer_at IS NULL OR t.delete_approved_by_seller_at IS NULL)
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
       AND t.delete_approved_by_buyer_at IS NOT NULL
       AND t.delete_approved_by_seller_at IS NOT NULL
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