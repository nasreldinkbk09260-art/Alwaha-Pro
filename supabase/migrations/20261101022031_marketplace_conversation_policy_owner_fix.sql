-- Bind the seller comparison to the actual product and outer conversation row.
BEGIN;
DROP POLICY IF EXISTS market_conversations_insert_buyer_active_listing ON public.market_conversations;
CREATE POLICY market_conversations_insert_buyer_active_listing
ON public.market_conversations FOR INSERT TO authenticated
WITH CHECK (
  buyer_id=(SELECT auth.uid()) AND buyer_id<>seller_id
  AND EXISTS (
    SELECT 1 FROM public.products AS p
    WHERE p.id=market_conversations.product_id
      AND p.seller_id=market_conversations.seller_id
      AND p.status='active'
  )
);
COMMIT;
