-- Keep SECURITY DEFINER implementation functions outside the exposed PostgREST schema.
-- Public RPC entry points remain SECURITY INVOKER and delegate to app_private after auth checks.
BEGIN;

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid()) AND u.is_admin IS TRUE
  );
$function$;

CREATE OR REPLACE FUNCTION app_private.can_reply_to_direct_message(
  p_reply_to_id bigint, p_sender_id uuid, p_receiver_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT p_reply_to_id IS NULL OR (
    p_sender_id = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.messages parent
      WHERE parent.id = p_reply_to_id
        AND (
          (parent.sender_id = p_sender_id AND parent.receiver_id = p_receiver_id)
          OR (parent.sender_id = p_receiver_id AND parent.receiver_id = p_sender_id)
        )
    )
  );
$function$;

CREATE OR REPLACE FUNCTION app_private.can_reply_to_market_message(
  p_reply_to_id uuid, p_conversation_id uuid, p_sender_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT p_reply_to_id IS NULL OR (
    p_sender_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.market_messages parent
      WHERE parent.id = p_reply_to_id AND parent.conversation_id = p_conversation_id
    )
    AND EXISTS (
      SELECT 1 FROM public.market_conversations c
      WHERE c.id = p_conversation_id
        AND (c.buyer_id = (SELECT auth.uid()) OR c.seller_id = (SELECT auth.uid()))
    )
  );
$function$;

CREATE OR REPLACE FUNCTION app_private.can_review_marketplace_product(
  p_product_id bigint, p_seller_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = p_product_id
      AND p.seller_id = p_seller_id
      AND p.status = 'sold'
      AND p.sold_to = (SELECT auth.uid())
      AND p.seller_id <> (SELECT auth.uid())
  );
$function$;

CREATE OR REPLACE FUNCTION app_private.approve_market_archive_deletion(
  p_record_type text, p_record_id uuid, p_approve boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_rows integer := 0;
  v_role text;
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
      GET DIAGNOSTICS v_rows=ROW_COUNT;
      IF v_rows>0 THEN v_role:='seller'; END IF;
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
      GET DIAGNOSTICS v_rows=ROW_COUNT;
      IF v_rows>0 THEN v_role:='seller'; END IF;
    END IF;
  END IF;
  IF v_rows=0 THEN RAISE EXCEPTION 'Record unavailable for this participant or retention notice not sent' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('record_type',p_record_type,'record_id',p_record_id,'participant_role',v_role,'approved',p_approve);
END;
$function$;

CREATE OR REPLACE FUNCTION app_private.complete_market_sale(
  p_product_id bigint, p_buyer_id uuid, p_conversation_id uuid,
  p_guarantee_days integer DEFAULT 0, p_agreement_note text DEFAULT ''::text
)
RETURNS uuid
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

CREATE OR REPLACE FUNCTION app_private.join_game_room(
  p_room_code text, p_expected_game_id text DEFAULT NULL::text
)
RETURNS public.game_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_room public.game_rooms;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_room_code IS NULL OR upper(trim(p_room_code)) !~ '^[A-HJ-NP-Z2-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid room code';
  END IF;
  IF p_expected_game_id IS NOT NULL AND p_expected_game_id NOT IN ('chess','ludo','war') THEN
    RAISE EXCEPTION 'Invalid expected game';
  END IF;
  SELECT * INTO v_room FROM public.game_rooms
   WHERE room_code=upper(trim(p_room_code)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF p_expected_game_id IS NOT NULL AND v_room.game_id<>p_expected_game_id THEN
    RAISE EXCEPTION 'Room belongs to another game';
  END IF;
  IF v_room.player1_id=v_uid OR v_room.player2_id=v_uid THEN RETURN v_room; END IF;
  IF v_room.status<>'waiting' OR v_room.player2_id IS NOT NULL THEN
    RAISE EXCEPTION 'Room is not waiting for another player';
  END IF;
  UPDATE public.game_rooms
     SET player2_id=v_uid,status='playing',current_turn=player1_id,updated_at=now()
   WHERE id=v_room.id RETURNING * INTO v_room;
  RETURN v_room;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.is_admin() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION app_private.can_reply_to_direct_message(bigint,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION app_private.can_reply_to_market_message(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION app_private.can_review_marketplace_product(bigint,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION app_private.approve_market_archive_deletion(text,uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION app_private.complete_market_sale(bigint,uuid,uuid,integer,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION app_private.join_game_room(text,text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION app_private.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.can_reply_to_direct_message(bigint,uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.can_reply_to_market_message(uuid,uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.can_review_marketplace_product(bigint,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.approve_market_archive_deletion(text,uuid,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.complete_market_sale(bigint,uuid,uuid,integer,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.join_game_room(text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.approve_market_archive_deletion(
  p_record_type text, p_record_id uuid, p_approve boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT app_private.approve_market_archive_deletion(p_record_type,p_record_id,p_approve);
$function$;

CREATE OR REPLACE FUNCTION public.complete_market_sale(
  p_product_id bigint, p_buyer_id uuid, p_conversation_id uuid,
  p_guarantee_days integer DEFAULT 0, p_agreement_note text DEFAULT ''::text
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT app_private.complete_market_sale(p_product_id,p_buyer_id,p_conversation_id,p_guarantee_days,p_agreement_note);
$function$;

CREATE OR REPLACE FUNCTION public.join_game_room(
  p_room_code text, p_expected_game_id text DEFAULT NULL::text
)
RETURNS public.game_rooms
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT app_private.join_game_room(p_room_code,p_expected_game_id);
$function$;

CREATE OR REPLACE FUNCTION public.can_review_marketplace_product(
  p_product_id bigint, p_seller_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT app_private.can_review_marketplace_product(p_product_id,p_seller_id);
$function$;

REVOKE ALL ON FUNCTION public.approve_market_archive_deletion(text,uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_market_sale(bigint,uuid,uuid,integer,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.join_game_room(text,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_review_marketplace_product(bigint,uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.approve_market_archive_deletion(text,uuid,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_market_sale(bigint,uuid,uuid,integer,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_game_room(text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_review_marketplace_product(bigint,uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS messages_insert_sender_accepted_friends ON public.messages;
CREATE POLICY messages_insert_sender_accepted_friends ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id=(SELECT auth.uid())
  AND receiver_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.friend_requests fr
    WHERE fr.status='accepted'::text
      AND (
        (fr.requester_id=(SELECT auth.uid()) AND fr.target_id=messages.receiver_id)
        OR (fr.target_id=(SELECT auth.uid()) AND fr.requester_id=messages.receiver_id)
      )
  )
  AND app_private.can_reply_to_direct_message(reply_to_id,sender_id,receiver_id)
);

DROP POLICY IF EXISTS market_messages_insert_participant ON public.market_messages;
CREATE POLICY market_messages_insert_participant ON public.market_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id=(SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.market_conversations c
    WHERE c.id=market_messages.conversation_id
      AND (c.buyer_id=(SELECT auth.uid()) OR c.seller_id=(SELECT auth.uid()))
  )
  AND app_private.can_reply_to_market_message(reply_to_id,conversation_id,sender_id)
);

DROP POLICY IF EXISTS marketplace_reviews_insert_verified_buyer ON public.marketplace_reviews;
CREATE POLICY marketplace_reviews_insert_verified_buyer ON public.marketplace_reviews
FOR INSERT TO authenticated
WITH CHECK (
  reviewer_id=(SELECT auth.uid())
  AND reviewer_id<>seller_id
  AND app_private.can_review_marketplace_product(product_id,seller_id)
);

REVOKE ALL ON FUNCTION public.can_reply_to_direct_message(bigint,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_reply_to_market_message(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION public.can_reply_to_direct_message(bigint,uuid,uuid);
DROP FUNCTION public.can_reply_to_market_message(uuid,uuid,uuid);

COMMIT;
