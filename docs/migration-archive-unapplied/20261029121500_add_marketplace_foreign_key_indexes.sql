-- Archived copy from the older repository timestamp.
-- The production migration ledger records this same five-index change as 20261029121330.
-- Do not place this file back under supabase/migrations or it may be applied twice.
BEGIN;

CREATE INDEX IF NOT EXISTS marketplace_reports_product_id_idx
  ON public.marketplace_reports (product_id);

CREATE INDEX IF NOT EXISTS marketplace_reports_reporter_id_idx
  ON public.marketplace_reports (reporter_id);

CREATE INDEX IF NOT EXISTS marketplace_reports_seller_id_idx
  ON public.marketplace_reports (seller_id);

CREATE INDEX IF NOT EXISTS marketplace_reviews_reviewer_id_idx
  ON public.marketplace_reviews (reviewer_id);

CREATE INDEX IF NOT EXISTS products_sold_to_idx
  ON public.products (sold_to);

COMMIT;
