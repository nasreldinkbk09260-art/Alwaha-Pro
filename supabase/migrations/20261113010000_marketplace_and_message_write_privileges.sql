-- Restrict client writes to the exact profile, marketplace, and chat fields used by the app.
-- Sale ownership and message content remain server/author controlled.
BEGIN;

REVOKE INSERT, UPDATE ON TABLE public.products FROM PUBLIC, anon, authenticated;
GRANT INSERT (
  seller_id, title, price, category, description, image_url, image_urls,
  location_label, latitude, longitude
) ON TABLE public.products TO authenticated;
GRANT UPDATE (
  title, price, category, description, image_url, image_urls,
  location_label, latitude, longitude, status, archived_at, promoted_until
) ON TABLE public.products TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_marketplace_product_client_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  IF current_user IN ('postgres', 'service_role') OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'active'
       OR NEW.sold_to IS NOT NULL
       OR NEW.sold_at IS NOT NULL
       OR NEW.archived_at IS NOT NULL
       OR NEW.promoted_until IS NOT NULL THEN
      RAISE EXCEPTION 'Marketplace lifecycle and sale fields are server controlled'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF OLD.status = 'sold' THEN
      RAISE EXCEPTION 'Sold listings are immutable'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.seller_id IS DISTINCT FROM OLD.seller_id
       OR NEW.sold_to IS DISTINCT FROM OLD.sold_to
       OR NEW.sold_at IS DISTINCT FROM OLD.sold_at THEN
      RAISE EXCEPTION 'Marketplace ownership and sale fields are server controlled'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status NOT IN ('active', 'archived') THEN
      RAISE EXCEPTION 'Clients may only activate or archive a listing'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.promoted_until IS DISTINCT FROM OLD.promoted_until
       AND NEW.promoted_until > now() + interval '3 days' THEN
      RAISE EXCEPTION 'Marketplace promotion cannot exceed three days'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status = 'archived' AND NEW.archived_at IS NULL THEN
      NEW.archived_at := now();
    ELSIF NEW.status = 'active' THEN
      NEW.archived_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS products_guard_client_lifecycle ON public.products;
CREATE TRIGGER products_guard_client_lifecycle
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.guard_marketplace_product_client_writes();
REVOKE ALL ON FUNCTION public.guard_marketplace_product_client_writes() FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE ON TABLE public.messages FROM PUBLIC, anon, authenticated;
GRANT INSERT (sender_id, receiver_id, message, reply_to_id)
  ON TABLE public.messages TO authenticated;
GRANT UPDATE (read_at) ON TABLE public.messages TO authenticated;

REVOKE UPDATE ON TABLE public.verification_requests FROM PUBLIC, anon, authenticated;
GRANT UPDATE (status, reviewed_at, reviewed_by)
  ON TABLE public.verification_requests TO authenticated;

COMMIT;
