-- Restrict direct API reads of seller contact email.
-- Public market queries use an explicit column list and do not need seller_email.
-- Idempotent: can be applied again safely after migration history is reconciled.
BEGIN;
REVOKE SELECT ON TABLE public.products FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, seller_id, title, price, category, description,
  image_url, image_urls, created_at, updated_at
) ON TABLE public.products TO anon, authenticated;
COMMIT;
