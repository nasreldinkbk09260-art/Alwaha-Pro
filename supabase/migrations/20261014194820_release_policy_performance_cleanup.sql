-- Remove proven duplicate permissive policies/indexes and index active foreign keys.
BEGIN;
DROP POLICY IF EXISTS "Allow authenticated insert likes" ON public.likes;
DROP POLICY IF EXISTS "Allow public read likes" ON public.likes;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP INDEX IF EXISTS public.users_identifier_unique_idx;
CREATE INDEX IF NOT EXISTS game_rooms_created_by_idx ON public.game_rooms(created_by);
CREATE INDEX IF NOT EXISTS game_rooms_current_turn_idx ON public.game_rooms(current_turn);
CREATE INDEX IF NOT EXISTS game_rooms_winner_id_idx ON public.game_rooms(winner_id);
CREATE INDEX IF NOT EXISTS likes_user_id_idx ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS verification_requests_reviewed_by_idx ON public.verification_requests(reviewed_by);
COMMIT;
