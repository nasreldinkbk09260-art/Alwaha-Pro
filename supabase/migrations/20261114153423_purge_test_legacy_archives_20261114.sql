-- Owner-approved removal of test-only archive tables after verifying zero active records.
-- RESTRICT prevents cascading into any object that unexpectedly depends on these archives.
DROP TABLE IF EXISTS public.comments_legacy_20260923010735 RESTRICT;
DROP TABLE IF EXISTS public.messages_legacy_20260923010735 RESTRICT;
DROP TABLE IF EXISTS public.posts_legacy_20260923010735 RESTRICT;
DROP TABLE IF EXISTS public.products_legacy_20260923010735 RESTRICT;
