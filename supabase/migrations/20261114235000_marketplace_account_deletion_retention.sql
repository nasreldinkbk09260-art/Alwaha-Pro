BEGIN;

-- Account removal must not cascade-delete marketplace history.
ALTER TABLE public.market_conversations ALTER COLUMN buyer_id DROP NOT NULL;
ALTER TABLE public.market_conversations ALTER COLUMN seller_id DROP NOT NULL;
ALTER TABLE public.market_conversations DROP CONSTRAINT IF EXISTS market_conversations_buyer_id_fkey;
ALTER TABLE public.market_conversations DROP CONSTRAINT IF EXISTS market_conversations_seller_id_fkey;
ALTER TABLE public.market_conversations
  ADD CONSTRAINT market_conversations_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT market_conversations_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.market_transactions ALTER COLUMN buyer_id DROP NOT NULL;
ALTER TABLE public.market_transactions ALTER COLUMN seller_id DROP NOT NULL;
ALTER TABLE public.market_transactions DROP CONSTRAINT IF EXISTS market_transactions_buyer_id_fkey;
ALTER TABLE public.market_transactions DROP CONSTRAINT IF EXISTS market_transactions_seller_id_fkey;
ALTER TABLE public.market_transactions
  ADD CONSTRAINT market_transactions_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT market_transactions_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.market_messages ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE public.marketplace_reports ALTER COLUMN reporter_id DROP NOT NULL;
ALTER TABLE public.marketplace_reports ALTER COLUMN seller_id DROP NOT NULL;
ALTER TABLE public.marketplace_reports DROP CONSTRAINT IF EXISTS marketplace_reports_reporter_id_fkey;
ALTER TABLE public.marketplace_reports DROP CONSTRAINT IF EXISTS marketplace_reports_seller_id_fkey;
ALTER TABLE public.marketplace_reports
  ADD CONSTRAINT marketplace_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT marketplace_reports_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.marketplace_reviews ALTER COLUMN reviewer_id DROP NOT NULL;
ALTER TABLE public.marketplace_reviews ALTER COLUMN seller_id DROP NOT NULL;
ALTER TABLE public.marketplace_reviews DROP CONSTRAINT IF EXISTS marketplace_reviews_reviewer_id_fkey;
ALTER TABLE public.marketplace_reviews DROP CONSTRAINT IF EXISTS marketplace_reviews_seller_id_fkey;
ALTER TABLE public.marketplace_reviews
  ADD CONSTRAINT marketplace_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT marketplace_reviews_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Permit only a server-originated nulling of one participant ID plus that participant's
-- retention consent. Ordinary users still cannot modify either participant or transaction data.
CREATE OR REPLACE FUNCTION public.guard_market_buyer_receipt_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL AND (
    (
      OLD.buyer_id IS NOT NULL AND NEW.buyer_id IS NULL
      AND NEW.delete_approved_by_buyer_at IS NOT NULL
      AND NEW.seller_id IS NOT DISTINCT FROM OLD.seller_id
      AND (to_jsonb(NEW)-'buyer_id'-'delete_approved_by_buyer_at')
          IS NOT DISTINCT FROM (to_jsonb(OLD)-'buyer_id'-'delete_approved_by_buyer_at')
    ) OR (
      OLD.seller_id IS NOT NULL AND NEW.seller_id IS NULL
      AND NEW.delete_approved_by_seller_at IS NOT NULL
      AND NEW.buyer_id IS NOT DISTINCT FROM OLD.buyer_id
      AND (to_jsonb(NEW)-'seller_id'-'delete_approved_by_seller_at')
          IS NOT DISTINCT FROM (to_jsonb(OLD)-'seller_id'-'delete_approved_by_seller_at')
    )
  ) THEN
    RETURN NEW;
  END IF;
  IF current_user IN ('postgres','service_role')
     AND NEW.retention_notice_sent_at IS DISTINCT FROM OLD.retention_notice_sent_at
     AND (to_jsonb(NEW)-'retention_notice_sent_at') IS NOT DISTINCT FROM
         (to_jsonb(OLD)-'retention_notice_sent_at') THEN
    RETURN NEW;
  END IF;
  IF current_user IN ('postgres','service_role')
     AND OLD.status='active' AND NEW.status='archived'
     AND OLD.guarantee_days>0 AND OLD.guarantee_expires_at IS NOT NULL
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

-- Preserve the existing retention schedule while skipping notifications for deleted participants.
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

  WITH due AS MATERIALIZED (
    SELECT t.id,t.buyer_id,t.seller_id,t.retention_until
      FROM public.market_transactions AS t
     WHERE t.status='archived' AND t.retention_notice_sent_at IS NULL
       AND t.retention_until<=now()+interval '7 days'
     ORDER BY t.retention_until,t.id FOR UPDATE SKIP LOCKED LIMIT v_limit
  ), recipients AS (
    SELECT d.id,d.retention_until,d.buyer_id AS recipient_id FROM due AS d WHERE d.buyer_id IS NOT NULL
    UNION ALL SELECT d.id,d.retention_until,d.seller_id FROM due AS d WHERE d.seller_id IS NOT NULL
  ), notices AS (
    INSERT INTO public.notifications(recipient_id,title,body,type,is_read,created_at)
    SELECT r.recipient_id,'تنبيه انتهاء أرشيف معاملة السوق',
      'انتهت أو قاربت مدة الاحتفاظ بسجل المعاملة. لن يتم الحذف تلقائياً؛ لا يحذف الأرشيف إلا بعد موافقة المشتري والبائع ومرور 7 أيام كاملة بعد هذا الإشعار.',
      'market_retention_notice',false,now()
      FROM recipients AS r
    RETURNING id
  )
  UPDATE public.market_transactions AS t SET retention_notice_sent_at=now()
    FROM due WHERE t.id=due.id;
  GET DIAGNOSTICS v_notified_transactions=ROW_COUNT;

  WITH due AS MATERIALIZED (
    SELECT c.id,c.buyer_id,c.seller_id,c.retention_until
      FROM public.market_conversations AS c
     WHERE c.retention_notice_sent_at IS NULL AND c.retention_until<=now()+interval '7 days'
       AND NOT EXISTS (SELECT 1 FROM public.market_transactions AS t WHERE t.conversation_id=c.id)
     ORDER BY c.retention_until,c.id FOR UPDATE SKIP LOCKED LIMIT v_limit
  ), recipients AS (
    SELECT d.id,d.retention_until,d.buyer_id AS recipient_id FROM due AS d WHERE d.buyer_id IS NOT NULL
    UNION ALL SELECT d.id,d.retention_until,d.seller_id FROM due AS d WHERE d.seller_id IS NOT NULL
  ), notices AS (
    INSERT INTO public.notifications(recipient_id,title,body,type,is_read,created_at)
    SELECT r.recipient_id,'تنبيه أرشفة محادثة السوق',
      'انتهت أو قاربت مدة الاحتفاظ بالمحادثة والإعلان المحفوظ. لن يتم الحذف تلقائياً؛ لا تحذف المحادثة إلا بعد موافقة الطرفين ومرور 7 أيام كاملة بعد هذا الإشعار.',
      'market_retention_notice',false,now()
      FROM recipients AS r
    RETURNING id
  )
  UPDATE public.market_conversations AS c SET retention_notice_sent_at=now()
    FROM due WHERE c.id=due.id;
  GET DIAGNOSTICS v_notified_conversations=ROW_COUNT;

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

-- Only detach marketplace identities and archive their active listings here. Other
-- account data is not deleted by this safety trigger; the separate deletion workflow
-- must process those data classes explicitly and record its result.
CREATE OR REPLACE FUNCTION app_private.detach_marketplace_user_before_auth_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users u WHERE u.id=OLD.id AND u.is_admin IS TRUE) THEN
    RAISE EXCEPTION 'Admin accounts cannot be deleted through the standard account-deletion flow';
  END IF;

  UPDATE public.market_transactions
     SET buyer_id=NULL,delete_approved_by_buyer_at=COALESCE(delete_approved_by_buyer_at,now())
   WHERE buyer_id=OLD.id;
  UPDATE public.market_transactions
     SET seller_id=NULL,delete_approved_by_seller_at=COALESCE(delete_approved_by_seller_at,now())
   WHERE seller_id=OLD.id;
  UPDATE public.market_conversations
     SET buyer_id=NULL,delete_approved_by_buyer_at=COALESCE(delete_approved_by_buyer_at,now())
   WHERE buyer_id=OLD.id;
  UPDATE public.market_conversations
     SET seller_id=NULL,delete_approved_by_seller_at=COALESCE(delete_approved_by_seller_at,now())
   WHERE seller_id=OLD.id;
  UPDATE public.market_messages SET sender_id=NULL WHERE sender_id=OLD.id;
  UPDATE public.products
     SET seller_id=NULL,
         sold_to=CASE WHEN sold_to=OLD.id THEN NULL ELSE sold_to END,
         seller_email='',
         status=CASE WHEN status='active' THEN 'archived' ELSE status END,
         archived_at=CASE WHEN status='active' THEN COALESCE(archived_at,now()) ELSE archived_at END,
         updated_at=now()
   WHERE seller_id=OLD.id OR sold_to=OLD.id;
  RETURN OLD;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.detach_marketplace_user_before_auth_delete() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS alwaha_detach_marketplace_before_auth_delete ON auth.users;
CREATE TRIGGER alwaha_detach_marketplace_before_auth_delete
BEFORE DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION app_private.detach_marketplace_user_before_auth_delete();

COMMIT;
