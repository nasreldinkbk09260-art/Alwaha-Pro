BEGIN;
-- Anonymous public reads must not execute the private block-lookup helper.
-- Authenticated readers retain the block-aware predicate and helper stays private.
DROP POLICY IF EXISTS posts_select_public ON public.posts;
CREATE POLICY posts_select_anon ON public.posts FOR SELECT TO anon USING (true);
CREATE POLICY posts_select_authenticated ON public.posts FOR SELECT TO authenticated
 USING ((SELECT auth.uid()) IS NULL OR NOT app_private.is_user_blocked((SELECT auth.uid()), author_id));
DROP POLICY IF EXISTS reels_select_public ON public.reels;
CREATE POLICY reels_select_anon ON public.reels FOR SELECT TO anon USING (true);
CREATE POLICY reels_select_authenticated ON public.reels FOR SELECT TO authenticated
 USING ((SELECT auth.uid()) IS NULL OR NOT app_private.is_user_blocked((SELECT auth.uid()), author_id));
DROP POLICY IF EXISTS comments_select_public ON public.comments;
CREATE POLICY comments_select_anon ON public.comments FOR SELECT TO anon USING (true);
CREATE POLICY comments_select_authenticated ON public.comments FOR SELECT TO authenticated
 USING ((SELECT auth.uid()) IS NULL OR NOT app_private.is_user_blocked((SELECT auth.uid()), user_id));
COMMIT;
