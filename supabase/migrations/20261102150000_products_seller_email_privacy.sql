-- Re-establish product seller_email privacy for clean installs without reviving the old 2.8.4 directory view.
-- The app now uses in-app market conversations; this legacy compatibility column must remain blank.
BEGIN;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seller_email text NOT NULL DEFAULT '';
UPDATE public.products SET seller_email='' WHERE coalesce(seller_email,'')<>'';

CREATE OR REPLACE FUNCTION public.clear_product_contact_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  NEW.seller_email := '';
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.clear_product_contact_email() SECURITY INVOKER;
ALTER FUNCTION public.clear_product_contact_email() SET search_path = '';
REVOKE ALL ON FUNCTION public.clear_product_contact_email() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS products_clear_public_email ON public.products;
CREATE TRIGGER products_clear_public_email
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.clear_product_contact_email();
REVOKE SELECT (seller_email) ON TABLE public.products FROM PUBLIC,anon,authenticated;
COMMIT;
