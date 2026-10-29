-- Cover foreign-key lookups on current marketplace tables.
-- Legacy archived tables are intentionally excluded.
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
