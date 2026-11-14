-- Reveal buyer eligibility as a boolean only; never expose products.sold_to.
BEGIN;
CREATE OR REPLACE FUNCTION public.can_review_marketplace_product(p_product_id bigint,p_seller_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $function$
 SELECT EXISTS(SELECT 1 FROM public.products p WHERE p.id=p_product_id AND p.seller_id=p_seller_id AND p.status='sold' AND p.sold_to=(SELECT auth.uid()) AND p.seller_id<>(SELECT auth.uid()));
$function$;
REVOKE ALL ON FUNCTION public.can_review_marketplace_product(bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_review_marketplace_product(bigint,uuid) TO authenticated;
DROP POLICY IF EXISTS marketplace_reviews_insert_verified_buyer ON public.marketplace_reviews;
CREATE POLICY marketplace_reviews_insert_verified_buyer ON public.marketplace_reviews FOR INSERT TO authenticated WITH CHECK (
 reviewer_id=(SELECT auth.uid()) AND reviewer_id<>seller_id AND public.can_review_marketplace_product(product_id,seller_id)
);
COMMIT;
