-- This file is run with psql against the disposable CI PostgreSQL database.
DO $privileges$
BEGIN
  IF has_column_privilege('anon','public.products','seller_email','SELECT') THEN RAISE EXCEPTION 'anon can read seller_email'; END IF;
  IF has_column_privilege('authenticated','public.products','seller_email','SELECT') THEN RAISE EXCEPTION 'authenticated can read seller_email'; END IF;
  IF NOT has_column_privilege('authenticated','public.products','title','SELECT') THEN RAISE EXCEPTION 'authenticated cannot read public product title'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='products' AND t.tgname='products_clear_public_email' AND NOT t.tgisinternal
  ) THEN RAISE EXCEPTION 'seller email clearing trigger is missing'; END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid='public.clear_product_contact_email()'::regprocedure) THEN RAISE EXCEPTION 'Email trigger must be SECURITY INVOKER'; END IF;
END
$privileges$;

INSERT INTO auth.users(id) VALUES('90000000-0000-0000-0000-000000000001') ON CONFLICT DO NOTHING;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',false);
INSERT INTO public.products(id,seller_id,title,price,seller_email)
VALUES(987654321,'90000000-0000-0000-0000-000000000001','خصوصية البائع','100','private@example.invalid');
RESET ROLE;
DO $data$
BEGIN
  IF (SELECT seller_email FROM public.products WHERE id=987654321) IS DISTINCT FROM '' THEN
    RAISE EXCEPTION 'seller_email persisted after authenticated insert';
  END IF;
END
$data$;
