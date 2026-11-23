BEGIN;

ALTER TABLE public.market_transactions
  ADD COLUMN IF NOT EXISTS fulfillment_method text NOT NULL DEFAULT 'pickup',
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS delivery_recipient_name text,
  ADD COLUMN IF NOT EXISTS delivery_recipient_phone text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_instructions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_fee numeric(12,2),
  ADD COLUMN IF NOT EXISTS delivery_provider text,
  ADD COLUMN IF NOT EXISTS tracking_reference text,
  ADD COLUMN IF NOT EXISTS delivery_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.market_transactions'::regclass AND conname='market_transactions_fulfillment_method_check') THEN
    ALTER TABLE public.market_transactions ADD CONSTRAINT market_transactions_fulfillment_method_check
      CHECK (fulfillment_method IN ('pickup','delivery'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.market_transactions'::regclass AND conname='market_transactions_delivery_status_check') THEN
    ALTER TABLE public.market_transactions ADD CONSTRAINT market_transactions_delivery_status_check
      CHECK (delivery_status IN ('not_requested','requested','accepted','preparing','shipped','out_for_delivery','delivered','failed','cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.market_transactions'::regclass AND conname='market_transactions_delivery_details_check') THEN
    ALTER TABLE public.market_transactions ADD CONSTRAINT market_transactions_delivery_details_check
      CHECK (
        (fulfillment_method='pickup' AND delivery_status='not_requested'
          AND delivery_recipient_name IS NULL AND delivery_recipient_phone IS NULL
          AND delivery_address IS NULL AND delivery_fee IS NULL
          AND delivery_provider IS NULL AND tracking_reference IS NULL
          AND delivered_at IS NULL)
        OR
        (fulfillment_method='delivery' AND delivery_status<>'not_requested'
          AND length(trim(coalesce(delivery_recipient_name,''))) BETWEEN 1 AND 120
          AND length(trim(coalesce(delivery_recipient_phone,''))) BETWEEN 3 AND 40
          AND length(trim(coalesce(delivery_address,''))) BETWEEN 5 AND 1200)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.market_transactions'::regclass AND conname='market_transactions_delivery_fee_check') THEN
    ALTER TABLE public.market_transactions ADD CONSTRAINT market_transactions_delivery_fee_check
      CHECK (delivery_fee IS NULL OR (delivery_fee>=0 AND delivery_fee<=1000000));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.market_transactions'::regclass AND conname='market_transactions_delivery_tracking_lengths_check') THEN
    ALTER TABLE public.market_transactions ADD CONSTRAINT market_transactions_delivery_tracking_lengths_check
      CHECK (length(coalesce(delivery_provider,''))<=120 AND length(coalesce(tracking_reference,''))<=160
        AND length(coalesce(delivery_instructions,''))<=500);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.market_transactions'::regclass AND conname='market_transactions_delivery_received_check') THEN
    ALTER TABLE public.market_transactions ADD CONSTRAINT market_transactions_delivery_received_check
      CHECK (
        (delivery_status='delivered' AND delivered_at IS NOT NULL AND buyer_confirmed_at IS NOT NULL)
        OR (delivery_status<>'delivered' AND delivered_at IS NULL)
      );
  END IF;
END
$constraints$;

-- Addresses are private transaction data. Existing participant-only SELECT RLS remains the only read path.
-- No broad table UPDATE grant is added; only the columns needed by the constrained participant trigger are granted.
GRANT UPDATE (
  fulfillment_method,delivery_status,delivery_recipient_name,delivery_recipient_phone,
  delivery_address,delivery_instructions,delivery_fee,delivery_provider,tracking_reference,
  delivery_updated_at,delivered_at,buyer_confirmed_at
) ON TABLE public.market_transactions TO authenticated;

DROP POLICY IF EXISTS market_transactions_seller_delivery_update ON public.market_transactions;
CREATE POLICY market_transactions_seller_delivery_update ON public.market_transactions
  FOR UPDATE TO authenticated
  USING (seller_id=(SELECT auth.uid()))
  WITH CHECK (seller_id=(SELECT auth.uid()));

-- Preserve account deletion, retention notices, two-party archive consent and pickup receipt;
-- add strict buyer/seller delivery transitions to the same immutable transaction guard.
CREATE OR REPLACE FUNCTION public.guard_market_buyer_receipt_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_valid_seller_transition boolean := false;
BEGIN
  IF v_uid IS NULL AND (
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

  IF v_uid IS NOT NULL AND v_uid=OLD.buyer_id
     AND NEW.delete_approved_by_buyer_at IS DISTINCT FROM OLD.delete_approved_by_buyer_at
     AND (to_jsonb(NEW)-'delete_approved_by_buyer_at') IS NOT DISTINCT FROM
         (to_jsonb(OLD)-'delete_approved_by_buyer_at') THEN
    RETURN NEW;
  END IF;
  IF v_uid IS NOT NULL AND v_uid=OLD.seller_id
     AND NEW.delete_approved_by_seller_at IS DISTINCT FROM OLD.delete_approved_by_seller_at
     AND (to_jsonb(NEW)-'delete_approved_by_seller_at') IS NOT DISTINCT FROM
         (to_jsonb(OLD)-'delete_approved_by_seller_at') THEN
    RETURN NEW;
  END IF;

  -- Buyer creates or edits a delivery request only while the request is still pending.
  IF v_uid IS NOT NULL AND v_uid=OLD.buyer_id
     AND OLD.status='active' AND OLD.buyer_confirmed_at IS NULL
     AND NEW.buyer_confirmed_at IS NOT DISTINCT FROM OLD.buyer_confirmed_at
     AND OLD.fulfillment_method IN ('pickup','delivery')
     AND ((OLD.fulfillment_method='pickup' AND OLD.delivery_status='not_requested')
       OR (OLD.fulfillment_method='delivery' AND OLD.delivery_status='requested'))
     AND NEW.fulfillment_method='delivery' AND NEW.delivery_status='requested'
     AND length(trim(coalesce(NEW.delivery_recipient_name,''))) BETWEEN 1 AND 120
     AND length(trim(coalesce(NEW.delivery_recipient_phone,''))) BETWEEN 3 AND 40
     AND length(trim(coalesce(NEW.delivery_address,''))) BETWEEN 5 AND 1200
     AND length(coalesce(NEW.delivery_instructions,''))<=500
     AND (to_jsonb(NEW)-ARRAY[
       'fulfillment_method','delivery_status','delivery_recipient_name','delivery_recipient_phone',
       'delivery_address','delivery_instructions','delivery_updated_at'
     ]::text[]) IS NOT DISTINCT FROM
         (to_jsonb(OLD)-ARRAY[
       'fulfillment_method','delivery_status','delivery_recipient_name','delivery_recipient_phone',
       'delivery_address','delivery_instructions','delivery_updated_at'
     ]::text[]) THEN
    RETURN NEW;
  END IF;

  -- Seller alone controls delivery fee/provider/tracking and may advance only one valid status step.
  IF v_uid IS NOT NULL AND v_uid=OLD.seller_id
     AND OLD.status='active' AND OLD.buyer_confirmed_at IS NULL
     AND OLD.fulfillment_method='delivery' AND NEW.fulfillment_method='delivery'
     AND NEW.buyer_confirmed_at IS NOT DISTINCT FROM OLD.buyer_confirmed_at
     AND NEW.delivery_recipient_name IS NOT DISTINCT FROM OLD.delivery_recipient_name
     AND NEW.delivery_recipient_phone IS NOT DISTINCT FROM OLD.delivery_recipient_phone
     AND NEW.delivery_address IS NOT DISTINCT FROM OLD.delivery_address
     AND NEW.delivery_instructions IS NOT DISTINCT FROM OLD.delivery_instructions
     AND NEW.delivered_at IS NOT DISTINCT FROM OLD.delivered_at
     AND (
       NEW.delivery_status=OLD.delivery_status
       OR (OLD.delivery_status='requested' AND NEW.delivery_status IN ('accepted','cancelled'))
       OR (OLD.delivery_status='accepted' AND NEW.delivery_status IN ('preparing','cancelled'))
       OR (OLD.delivery_status='preparing' AND NEW.delivery_status IN ('shipped','cancelled'))
       OR (OLD.delivery_status='shipped' AND NEW.delivery_status IN ('out_for_delivery','failed'))
       OR (OLD.delivery_status='out_for_delivery' AND NEW.delivery_status='failed')
       OR (OLD.delivery_status='failed' AND NEW.delivery_status IN ('preparing','cancelled'))
     )
     AND (NEW.delivery_fee IS NULL OR (NEW.delivery_fee>=0 AND NEW.delivery_fee<=1000000))
     AND length(coalesce(NEW.delivery_provider,''))<=120
     AND length(coalesce(NEW.tracking_reference,''))<=160
     AND NEW.delivery_updated_at IS NOT NULL
     AND (to_jsonb(NEW)-ARRAY[
       'delivery_status','delivery_fee','delivery_provider','tracking_reference','delivery_updated_at'
     ]::text[]) IS NOT DISTINCT FROM
         (to_jsonb(OLD)-ARRAY[
       'delivery_status','delivery_fee','delivery_provider','tracking_reference','delivery_updated_at'
     ]::text[]) THEN
    RETURN NEW;
  END IF;

  -- Buyer confirms delivery only after the seller has moved it to out_for_delivery.
  IF v_uid IS NOT NULL AND v_uid=OLD.buyer_id
     AND OLD.status='active' AND OLD.buyer_confirmed_at IS NULL
     AND OLD.fulfillment_method='delivery' AND OLD.delivery_status='out_for_delivery'
     AND NEW.fulfillment_method='delivery' AND NEW.delivery_status='delivered'
     AND NEW.buyer_confirmed_at IS NOT NULL AND NEW.delivered_at IS NOT NULL
     AND NEW.delivery_updated_at IS NOT NULL
     AND (to_jsonb(NEW)-ARRAY['delivery_status','buyer_confirmed_at','delivered_at','delivery_updated_at']::text[])
         IS NOT DISTINCT FROM
         (to_jsonb(OLD)-ARRAY['delivery_status','buyer_confirmed_at','delivered_at','delivery_updated_at']::text[]) THEN
    RETURN NEW;
  END IF;

  -- Legacy pickup receipt remains a one-way buyer-only confirmation.
  IF v_uid IS NOT NULL AND v_uid=OLD.buyer_id
     AND OLD.fulfillment_method='pickup' AND OLD.buyer_confirmed_at IS NULL
     AND NEW.buyer_confirmed_at IS NOT NULL
     AND (to_jsonb(NEW)-'buyer_confirmed_at') IS NOT DISTINCT FROM
         (to_jsonb(OLD)-'buyer_confirmed_at') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Marketplace transaction fields are immutable except for validated delivery, receipt, and archive-consent transitions'
    USING ERRCODE='42501';
END;
$function$;

-- SECURITY INVOKER RPCs: caller RLS, column privileges and the trigger above all remain in force.
CREATE OR REPLACE FUNCTION public.request_market_delivery(
  p_transaction_id uuid,
  p_recipient_name text,
  p_recipient_phone text,
  p_delivery_address text,
  p_delivery_instructions text DEFAULT ''::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.market_transactions;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_transaction_id IS NULL
     OR length(trim(coalesce(p_recipient_name,''))) NOT BETWEEN 1 AND 120
     OR length(trim(coalesce(p_recipient_phone,''))) NOT BETWEEN 3 AND 40
     OR length(trim(coalesce(p_delivery_address,''))) NOT BETWEEN 5 AND 1200
     OR length(coalesce(p_delivery_instructions,''))>500 THEN
    RAISE EXCEPTION 'Invalid delivery details' USING ERRCODE='22023';
  END IF;

  UPDATE public.market_transactions
     SET fulfillment_method='delivery',
         delivery_status='requested',
         delivery_recipient_name=trim(p_recipient_name),
         delivery_recipient_phone=trim(p_recipient_phone),
         delivery_address=trim(p_delivery_address),
         delivery_instructions=trim(coalesce(p_delivery_instructions,'')),
         delivery_updated_at=now()
   WHERE id=p_transaction_id
     AND buyer_id=v_uid
     AND status='active'
     AND buyer_confirmed_at IS NULL
     AND ((fulfillment_method='pickup' AND delivery_status='not_requested')
       OR (fulfillment_method='delivery' AND delivery_status='requested'))
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction is unavailable or delivery request is no longer editable' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('id',v_row.id,'fulfillment_method',v_row.fulfillment_method,
    'delivery_status',v_row.delivery_status,'delivery_updated_at',v_row.delivery_updated_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_market_delivery(
  p_transaction_id uuid,
  p_delivery_status text,
  p_delivery_fee numeric DEFAULT NULL,
  p_delivery_provider text DEFAULT NULL,
  p_tracking_reference text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.market_transactions;
  v_next text := lower(trim(coalesce(p_delivery_status,'')));
  v_allowed boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_transaction_id IS NULL OR v_next NOT IN ('accepted','preparing','shipped','out_for_delivery','failed','cancelled') THEN
    RAISE EXCEPTION 'Invalid delivery status' USING ERRCODE='22023';
  END IF;
  IF p_delivery_fee IS NOT NULL AND (p_delivery_fee<0 OR p_delivery_fee>1000000) THEN
    RAISE EXCEPTION 'Invalid delivery fee' USING ERRCODE='22023';
  END IF;
  IF length(coalesce(p_delivery_provider,''))>120 OR length(coalesce(p_tracking_reference,''))>160 THEN
    RAISE EXCEPTION 'Delivery provider or tracking reference is too long' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_row FROM public.market_transactions
   WHERE id=p_transaction_id AND seller_id=v_uid
   FOR UPDATE;
  IF NOT FOUND OR v_row.status<>'active' OR v_row.buyer_confirmed_at IS NOT NULL OR v_row.fulfillment_method<>'delivery' THEN
    RAISE EXCEPTION 'Delivery transaction is unavailable for this seller' USING ERRCODE='42501';
  END IF;

  v_allowed := v_next=v_row.delivery_status
    OR (v_row.delivery_status='requested' AND v_next IN ('accepted','cancelled'))
    OR (v_row.delivery_status='accepted' AND v_next IN ('preparing','cancelled'))
    OR (v_row.delivery_status='preparing' AND v_next IN ('shipped','cancelled'))
    OR (v_row.delivery_status='shipped' AND v_next IN ('out_for_delivery','failed'))
    OR (v_row.delivery_status='out_for_delivery' AND v_next='failed')
    OR (v_row.delivery_status='failed' AND v_next IN ('preparing','cancelled'));
  IF NOT v_allowed THEN RAISE EXCEPTION 'Invalid delivery status transition' USING ERRCODE='22023'; END IF;

  UPDATE public.market_transactions
     SET delivery_status=v_next,
         delivery_fee=coalesce(p_delivery_fee,delivery_fee),
         delivery_provider=coalesce(nullif(trim(coalesce(p_delivery_provider,'')),''),delivery_provider),
         tracking_reference=coalesce(nullif(trim(coalesce(p_tracking_reference,'')),''),tracking_reference),
         delivery_updated_at=now()
   WHERE id=p_transaction_id AND seller_id=v_uid
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery transaction changed; refresh and retry' USING ERRCODE='40001'; END IF;

  RETURN jsonb_build_object('id',v_row.id,'delivery_status',v_row.delivery_status,
    'delivery_fee',v_row.delivery_fee,'delivery_provider',v_row.delivery_provider,
    'tracking_reference',v_row.tracking_reference,'delivery_updated_at',v_row.delivery_updated_at);
END;
$function$;

REVOKE ALL ON FUNCTION public.request_market_delivery(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.update_market_delivery(uuid,text,numeric,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.request_market_delivery(uuid,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_market_delivery(uuid,text,numeric,text,text) TO authenticated;

COMMENT ON COLUMN public.market_transactions.delivery_address IS
  'Private recipient address readable only through participant-only transaction SELECT RLS; never a public product field.';
COMMENT ON FUNCTION public.request_market_delivery(uuid,text,text,text,text) IS
  'Buyer-only delivery request. Uses caller RLS and a trigger-enforced transition; no courier/payment integration is implied.';
COMMENT ON FUNCTION public.update_market_delivery(uuid,text,numeric,text,text) IS
  'Seller-only delivery status, fee and tracking update with a strict transition graph.';

NOTIFY pgrst, 'reload schema';
COMMIT;
