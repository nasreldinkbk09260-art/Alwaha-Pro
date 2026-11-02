-- Alwaha-Pro 3.0.2: immutable marketplace sale snapshot, warranty retention, and participant-only market calls.
-- This migration is additive. It does not rewrite existing users, messages, or recorded migrations.
BEGIN;

-- Marketplace listings are archived through the application lifecycle, never hard-deleted by clients.
-- This prevents old clients or direct REST calls from cascading away buyer conversations.
REVOKE DELETE ON TABLE public.products FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS products_delete_own ON public.products;

-- Preserve conversation/message history if a seller removes the original product row.
ALTER TABLE public.market_conversations ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.market_conversations DROP CONSTRAINT IF EXISTS market_conversations_product_id_fkey;
ALTER TABLE public.market_conversations
  ADD CONSTRAINT market_conversations_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- Persist a copy of the listing at the time each buyer starts a conversation.
-- This survives even if the product row is later deleted directly by its owner.
ALTER TABLE public.market_conversations
  ADD COLUMN IF NOT EXISTS listing_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE public.market_conversations AS c
SET listing_snapshot=jsonb_build_object(
  'id',p.id,'title',p.title,'price',p.price,'category',p.category,
  'description',p.description,'image_url',p.image_url,'image_urls',p.image_urls,
  'location_label',p.location_label,'created_at',p.created_at
)
FROM public.products AS p
WHERE c.product_id=p.id AND c.listing_snapshot='{}'::jsonb;

CREATE OR REPLACE FUNCTION public.capture_market_conversation_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_product record;
BEGIN
  SELECT p.id,p.seller_id,p.title,p.price,p.category,p.description,p.image_url,p.image_urls,p.location_label,p.created_at
    INTO v_product
    FROM public.products AS p
   WHERE p.id=NEW.product_id AND p.seller_id=NEW.seller_id AND p.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Active seller-owned listing not found'; END IF;
  NEW.listing_snapshot=jsonb_build_object(
    'id',v_product.id,'title',v_product.title,'price',v_product.price,
    'category',v_product.category,'description',v_product.description,
    'image_url',v_product.image_url,'image_urls',v_product.image_urls,
    'location_label',v_product.location_label,'created_at',v_product.created_at
  );
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS market_conversation_capture_listing_snapshot ON public.market_conversations;
CREATE TRIGGER market_conversation_capture_listing_snapshot
BEFORE INSERT ON public.market_conversations
FOR EACH ROW EXECUTE FUNCTION public.capture_market_conversation_snapshot();

-- Complete the FK index inventory reported by Supabase Performance Advisor.
CREATE INDEX IF NOT EXISTS market_messages_sender_id_idx ON public.market_messages(sender_id);

CREATE TABLE IF NOT EXISTS public.market_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NULL REFERENCES public.market_conversations(id) ON DELETE SET NULL,
  product_id bigint NOT NULL,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_snapshot jsonb NOT NULL,
  agreement_note text NOT NULL DEFAULT '',
  guarantee_days integer NOT NULL DEFAULT 0 CHECK (guarantee_days BETWEEN 0 AND 3650),
  sold_at timestamptz NOT NULL DEFAULT now(),
  guarantee_expires_at timestamptz NULL,
  retention_until timestamptz NOT NULL,
  buyer_confirmed_at timestamptz NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','disputed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT market_transactions_distinct_parties CHECK (buyer_id <> seller_id),
  CONSTRAINT market_transactions_snapshot_object CHECK (jsonb_typeof(listing_snapshot)='object')
);
CREATE INDEX IF NOT EXISTS market_transactions_buyer_created_idx ON public.market_transactions(buyer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS market_transactions_seller_created_idx ON public.market_transactions(seller_id,created_at DESC);
CREATE INDEX IF NOT EXISTS market_transactions_product_created_idx ON public.market_transactions(product_id,created_at DESC);
CREATE INDEX IF NOT EXISTS market_transactions_retention_idx ON public.market_transactions(retention_until) WHERE status='archived';

ALTER TABLE public.market_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_transactions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.market_transactions TO authenticated;
GRANT UPDATE (buyer_confirmed_at) ON TABLE public.market_transactions TO authenticated;

DROP POLICY IF EXISTS market_transactions_select_participant ON public.market_transactions;
CREATE POLICY market_transactions_select_participant ON public.market_transactions
  FOR SELECT TO authenticated
  USING (buyer_id=(SELECT auth.uid()) OR seller_id=(SELECT auth.uid()));
-- Direct client inserts are revoked; only the narrowly scoped authenticated RPC may create a sale record.
DROP POLICY IF EXISTS market_transactions_insert_seller_completed_sale ON public.market_transactions;
DROP POLICY IF EXISTS market_transactions_buyer_confirm_receipt ON public.market_transactions;
CREATE POLICY market_transactions_buyer_confirm_receipt ON public.market_transactions
  FOR UPDATE TO authenticated
  USING (buyer_id=(SELECT auth.uid()))
  WITH CHECK (buyer_id=(SELECT auth.uid()));

-- Buyer receipt confirmation is a one-way transition and cannot edit any other sale field.
CREATE OR REPLACE FUNCTION public.guard_market_buyer_receipt_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS DISTINCT FROM OLD.buyer_id
     OR OLD.buyer_confirmed_at IS NOT NULL
     OR NEW.buyer_confirmed_at IS NULL
     OR (to_jsonb(NEW)-'buyer_confirmed_at') IS DISTINCT FROM (to_jsonb(OLD)-'buyer_confirmed_at') THEN
    RAISE EXCEPTION 'Only the buyer may confirm receipt once; transaction details are immutable';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS market_transaction_guard_buyer_receipt ON public.market_transactions;
CREATE TRIGGER market_transaction_guard_buyer_receipt
BEFORE UPDATE ON public.market_transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_market_buyer_receipt_update();

-- Narrow SECURITY DEFINER RPC: validates the authenticated seller and exact buyer conversation,
-- uses an empty search_path and schema-qualified application objects, and is executable only by authenticated.
CREATE OR REPLACE FUNCTION public.complete_market_sale(
  p_product_id bigint,
  p_buyer_id uuid,
  p_conversation_id uuid,
  p_guarantee_days integer DEFAULT 0,
  p_agreement_note text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_product public.products;
  v_transaction_id uuid;
  v_days integer := coalesce(p_guarantee_days,0);
  v_note text := left(trim(coalesce(p_agreement_note,'')),2000);
  v_sold_at timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_buyer_id IS NULL OR p_buyer_id=v_uid THEN RAISE EXCEPTION 'Invalid buyer'; END IF;
  IF v_days < 0 OR v_days > 3650 THEN RAISE EXCEPTION 'Warranty days must be between 0 and 3650'; END IF;
  SELECT * INTO v_product FROM public.products
   WHERE id=p_product_id AND seller_id=v_uid AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active seller-owned listing not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.market_conversations c
    WHERE c.id=p_conversation_id AND c.product_id=p_product_id
      AND c.buyer_id=p_buyer_id AND c.seller_id=v_uid
  ) THEN RAISE EXCEPTION 'Buyer must have a conversation for this exact listing'; END IF;

  UPDATE public.products SET status='sold', sold_to=p_buyer_id, sold_at=v_sold_at, updated_at=v_sold_at
   WHERE id=p_product_id AND seller_id=v_uid;

  INSERT INTO public.market_transactions(
    conversation_id,product_id,buyer_id,seller_id,listing_snapshot,agreement_note,
    guarantee_days,sold_at,guarantee_expires_at,retention_until,status
  ) VALUES (
    p_conversation_id,p_product_id,p_buyer_id,v_uid,
    jsonb_build_object(
      'id',v_product.id,'title',v_product.title,'price',v_product.price,
      'category',v_product.category,'description',v_product.description,
      'image_url',v_product.image_url,'image_urls',v_product.image_urls,
      'location_label',v_product.location_label,'created_at',v_product.created_at
    ),
    v_note,v_days,v_sold_at,
    CASE WHEN v_days>0 THEN v_sold_at + make_interval(days=>v_days) ELSE NULL END,
    v_sold_at + make_interval(days=>CASE WHEN v_days>0 THEN v_days+30 ELSE 30 END),
    CASE WHEN v_days=0 THEN 'archived' ELSE 'active' END
  ) RETURNING id INTO v_transaction_id;
  RETURN v_transaction_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.complete_market_sale(bigint,uuid,uuid,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_market_sale(bigint,uuid,uuid,integer,text) TO authenticated;

-- Market-call inbox: a caller may send only to the other participant in a real market conversation.
DROP POLICY IF EXISTS alwaha_market_call_channels_receive ON realtime.messages;
CREATE POLICY alwaha_market_call_channels_receive ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    extension='broadcast' AND (
      (realtime.topic()=('market-call-inbox-'||(SELECT auth.uid())::text) AND EXISTS (
        SELECT 1 FROM public.market_conversations c
        WHERE c.buyer_id=(SELECT auth.uid()) OR c.seller_id=(SELECT auth.uid())
      )) OR EXISTS (
        SELECT 1 FROM public.market_conversations c
        WHERE realtime.topic()=('market-call-room-'||c.id::text)
          AND ((c.buyer_id=(SELECT auth.uid())) OR (c.seller_id=(SELECT auth.uid())))
      )
    )
  );
DROP POLICY IF EXISTS alwaha_market_call_channels_send ON realtime.messages;
CREATE POLICY alwaha_market_call_channels_send ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    extension='broadcast' AND (
      EXISTS (
        SELECT 1 FROM public.market_conversations c
        WHERE (c.buyer_id=(SELECT auth.uid()) AND realtime.topic()=('market-call-inbox-'||c.seller_id::text))
           OR (c.seller_id=(SELECT auth.uid()) AND realtime.topic()=('market-call-inbox-'||c.buyer_id::text))
      ) OR EXISTS (
        SELECT 1 FROM public.market_conversations c
        WHERE realtime.topic()=('market-call-room-'||c.id::text)
          AND ((c.buyer_id=(SELECT auth.uid())) OR (c.seller_id=(SELECT auth.uid())))
      )
    )
  );
COMMIT;

-- Cover the sender foreign key flagged by the live performance advisor.
CREATE INDEX IF NOT EXISTS market_messages_sender_id_idx ON public.market_messages (sender_id);
