-- RLS predicates preserve their semantics while evaluating stable auth context once per query.
BEGIN;
ALTER POLICY "Users can update own profile" ON public.profiles USING ((SELECT auth.uid()) = id);
ALTER POLICY "Users can insert own profile" ON public.profiles WITH CHECK ((SELECT auth.uid()) = id);
ALTER POLICY "Authenticated users can insert likes" ON public.likes WITH CHECK ((SELECT auth.role()) = 'authenticated'::text);
ALTER POLICY "Allow users to delete own likes" ON public.likes USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "المستخدم يضيف تقييم" ON public.ratings WITH CHECK ((SELECT auth.uid()) = reviewer_id);
COMMIT;
