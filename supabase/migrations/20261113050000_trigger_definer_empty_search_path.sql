-- Remove mutable public/temporary schemas from every remaining SECURITY DEFINER trigger function.
-- All referenced relations in these functions are explicitly schema-qualified.
BEGIN;
ALTER FUNCTION public.handle_auth_user_update() SET search_path TO '';
ALTER FUNCTION public.handle_new_auth_user() SET search_path TO '';
ALTER FUNCTION public.handle_new_user() SET search_path TO '';
ALTER FUNCTION public.handle_verification_status() SET search_path TO '';
ALTER FUNCTION public.notify_on_comment() SET search_path TO '';
ALTER FUNCTION public.notify_on_follow() SET search_path TO '';
ALTER FUNCTION public.notify_on_friend_request() SET search_path TO '';
ALTER FUNCTION public.notify_on_like() SET search_path TO '';
ALTER FUNCTION public.notify_on_message() SET search_path TO '';
ALTER FUNCTION public.sync_post_like_count() SET search_path TO '';
ALTER FUNCTION public.sync_public_profile_directory() SET search_path TO '';
ALTER FUNCTION public.sync_reel_like_count() SET search_path TO '';
COMMIT;
