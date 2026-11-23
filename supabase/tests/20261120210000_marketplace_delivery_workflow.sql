-- Marketplace delivery: participant roles, private address, legal state transitions and receipt confirmation.
-- Disposable test identities explicitly satisfy the versioned consent gate and use unique usernames.
INSERT INTO auth.users(id,raw_user_meta_data) VALUES
 ('93000000-0000-0000-0000-000000000001','{"username":"delivery_buyer","alwaha_terms_version":"2026-11-15","alwaha_privacy_version":"2026-11-15"}'::jsonb),
 ('93000000-0000-0000-0000-000000000002','{"username":"delivery_seller","alwaha_terms_version":"2026-11-15","alwaha_privacy_version":"2026-11-15"}'::jsonb),
 ('93000000-0000-0000-0000-000000000003','{"username":"delivery_intruder","alwaha_terms_version":"2026-11-15","alwaha_privacy_version":"2026-11-15"}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO public.market_transactions(
  id,product_id,buyer_id,seller_id,listing_snapshot,agreement_note,
  guarantee_days,sold_at,retention_until,status
) VALUES
 ('93000000-0000-0000-0000-000000000101',987654321,
  '93000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000002',
  '{"title":"منتج اختبار التوصيل","price":"250"}'::jsonb,'CI delivery test',
  0,now(),now()+interval '30 days','active'),
 ('93000000-0000-0000-0000-000000000102',987654322,
  '93000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000002',
  '{"title":"منتج اختبار منع القفز","price":"125"}'::jsonb,'CI delivery guard test',
  0,now(),now()+interval '30 days','active');

DO $privileges$
BEGIN
  IF NOT has_function_privilege('authenticated','public.request_market_delivery(uuid,text,text,text,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.update_market_delivery(uuid,text,numeric,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated marketplace participants need the delivery RPCs';
  END IF;
  IF has_function_privilege('anon','public.request_market_delivery(uuid,text,text,text,text)','EXECUTE')
     OR has_function_privilege('anon','public.update_market_delivery(uuid,text,numeric,text,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.update_market_delivery(uuid,text,numeric,text,text)','EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Delivery RPC privileges are not restricted correctly';
  END IF;
  IF has_column_privilege('anon','public.market_transactions','delivery_address','SELECT')
     OR has_table_privilege('anon','public.market_transactions','SELECT') THEN
    RAISE EXCEPTION 'Anonymous users must never read private delivery details';
  END IF;
  IF NOT has_column_privilege('authenticated','public.market_transactions','delivery_address','UPDATE')
     OR NOT has_column_privilege('authenticated','public.market_transactions','delivery_status','UPDATE') THEN
    RAISE EXCEPTION 'Participant delivery columns are missing constrained update grants';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid='public.request_market_delivery(uuid,text,text,text,text)'::regprocedure)
     OR (SELECT prosecdef FROM pg_proc WHERE oid='public.update_market_delivery(uuid,text,numeric,text,text)'::regprocedure) THEN
    RAISE EXCEPTION 'Marketplace delivery RPCs must remain SECURITY INVOKER';
  END IF;
END
$privileges$;

-- Buyer requests private delivery details.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',false);
SELECT public.request_market_delivery(
 '93000000-0000-0000-0000-000000000101',
 'مستلم الاختبار','01000000000','عنوان تسليم خاص للاختبار','اتصل قبل الوصول'
);
RESET ROLE;

DO $buyer_request$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.market_transactions
    WHERE id='93000000-0000-0000-0000-000000000101'
      AND fulfillment_method='delivery' AND delivery_status='requested'
      AND delivery_recipient_name='مستلم الاختبار'
      AND delivery_recipient_phone='01000000000'
      AND delivery_address='عنوان تسليم خاص للاختبار'
      AND delivery_instructions='اتصل قبل الوصول'
  ) THEN RAISE EXCEPTION 'Buyer delivery request was not persisted'; END IF;
END
$buyer_request$;

-- A third party cannot request delivery on someone else's transaction.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000003',false);
DO $unauthorized$
DECLARE v_raised boolean:=false;
BEGIN
  BEGIN
    PERFORM public.request_market_delivery(
      '93000000-0000-0000-0000-000000000101','Intruder','01000000000','Private address',''
    );
  EXCEPTION WHEN OTHERS THEN v_raised:=true;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'Unrelated user requested delivery'; END IF;
END
$unauthorized$;
RESET ROLE;

-- Seller cannot skip the acceptance/preparation/shipping sequence.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000002',false);
DO $skip$
DECLARE v_raised boolean:=false;
BEGIN
  BEGIN
    PERFORM public.update_market_delivery(
      '93000000-0000-0000-0000-000000000101','shipped',null,null,'TRACK-001'
    );
  EXCEPTION WHEN OTHERS THEN v_raised:=true;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'Seller skipped requested/accepted/preparing states'; END IF;
END
$skip$;
SELECT public.update_market_delivery('93000000-0000-0000-0000-000000000101','accepted',35,'توصيل البائع','');
SELECT public.update_market_delivery('93000000-0000-0000-0000-000000000101','preparing',null,null,'');
SELECT public.update_market_delivery('93000000-0000-0000-0000-000000000101','shipped',null,'شركة شحن اختبارية','TRACK-001');
SELECT public.update_market_delivery('93000000-0000-0000-0000-000000000101','out_for_delivery',null,null,'');
RESET ROLE;

-- Seller cannot rewrite the buyer's private address.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000002',false);
DO $address_guard$
DECLARE v_raised boolean:=false;
BEGIN
  BEGIN
    UPDATE public.market_transactions
       SET delivery_address='عنوان تم العبث به'
     WHERE id='93000000-0000-0000-0000-000000000101';
  EXCEPTION WHEN OTHERS THEN v_raised:=true;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'Seller changed the buyer-owned delivery address'; END IF;
END
$address_guard$;
RESET ROLE;

-- Buyer confirms receipt only after the seller marks the parcel out for delivery.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',false);
UPDATE public.market_transactions
   SET delivery_status='delivered',delivered_at=now(),delivery_updated_at=now(),buyer_confirmed_at=now()
 WHERE id='93000000-0000-0000-0000-000000000101'
   AND buyer_id='93000000-0000-0000-0000-000000000001'
   AND delivery_status='out_for_delivery'
   AND buyer_confirmed_at IS NULL;
RESET ROLE;

DO $delivered$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.market_transactions
    WHERE id='93000000-0000-0000-0000-000000000101'
      AND delivery_status='delivered' AND delivered_at IS NOT NULL AND buyer_confirmed_at IS NOT NULL
      AND tracking_reference='TRACK-001' AND delivery_fee=35
  ) THEN RAISE EXCEPTION 'Buyer receipt confirmation did not close the delivery workflow'; END IF;
END
$delivered$;

-- Pickup remains the default and can still use the one-time buyer receipt flow.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',false);
UPDATE public.market_transactions
   SET buyer_confirmed_at=now()
 WHERE id='93000000-0000-0000-0000-000000000102'
   AND buyer_id='93000000-0000-0000-0000-000000000001'
   AND fulfillment_method='pickup'
   AND buyer_confirmed_at IS NULL;
RESET ROLE;

DO $pickup$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.market_transactions
    WHERE id='93000000-0000-0000-0000-000000000102'
      AND fulfillment_method='pickup' AND delivery_status='not_requested'
      AND buyer_confirmed_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'Existing pickup receipt flow regressed'; END IF;
  IF has_function_privilege('anon','public.request_market_delivery(uuid,text,text,text,text)','EXECUTE')
     OR has_function_privilege('anon','public.update_market_delivery(uuid,text,numeric,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous delivery RPC execution must stay disabled';
  END IF;
END
$pickup$;

SELECT 'MARKETPLACE_DELIVERY_WORKFLOW=PASS' AS result;
