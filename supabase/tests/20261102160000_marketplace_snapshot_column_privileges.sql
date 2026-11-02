-- Proves the invoker trigger does not require SELECT * on products.
INSERT INTO auth.users(id) VALUES
 ('91000000-0000-0000-0000-000000000001'),
 ('92000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;
INSERT INTO public.products(id,seller_id,title,price,description,seller_email)
VALUES(987654322,'91000000-0000-0000-0000-000000000001','لقطة محادثة سوق','125','وصف الإعلان','private@example.invalid');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','92000000-0000-0000-0000-000000000002',false);
INSERT INTO public.market_conversations(product_id,buyer_id,seller_id)
VALUES(987654322,'92000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000001');
RESET ROLE;
DO $snapshot$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.market_conversations
    WHERE product_id=987654322 AND listing_snapshot->>'title'='لقطة محادثة سوق'
      AND listing_snapshot->>'price'='125'
  ) THEN RAISE EXCEPTION 'Authenticated market conversation failed to capture its listing snapshot'; END IF;
END
$snapshot$;
