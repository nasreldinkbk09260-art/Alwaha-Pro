-- Alwaha-Pro 2.8.7 source for the already-applied production migration.
-- Notification delivery must never cause the core message/follow/comment/like write to fail.
BEGIN;

CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $function$
BEGIN
  BEGIN
    INSERT INTO public.notifications(recipient_id, title, body, type)
    VALUES (NEW.receiver_id, 'رسالة جديدة', jsonb_build_object('message_id', NEW.id, 'sender_id', NEW.sender_id)::text, 'message');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Alwaha notification failed for message %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_friend_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $function$
DECLARE requester_name text;
BEGIN
  SELECT trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) INTO requester_name
    FROM public.users WHERE id = NEW.requester_id;
  BEGIN
    INSERT INTO public.notifications(recipient_id, title, body, type)
    VALUES (NEW.target_id, 'طلب صداقة جديد', jsonb_build_object('friend_request_id', NEW.id, 'requester_id', NEW.requester_id, 'requester_name', coalesce(requester_name, 'مستخدم'))::text, 'friend_request');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Alwaha notification failed for friend request %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $function$
DECLARE follower_name text;
BEGIN
  SELECT trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) INTO follower_name
    FROM public.users WHERE id = NEW.follower_id;
  BEGIN
    INSERT INTO public.notifications(recipient_id, title, body, type)
    VALUES (NEW.following_id, 'متابع جديد', jsonb_build_object('follower_id', NEW.follower_id, 'follower_name', coalesce(nullif(follower_name, ''), 'عضو في الواحة'))::text, 'follow');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Alwaha notification failed for follow % -> %: %', NEW.follower_id, NEW.following_id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $function$
DECLARE owner_id uuid; target_num bigint;
BEGIN
  IF NEW.target_id ~ '^[0-9]+$' THEN
    target_num := NEW.target_id::bigint;
    IF NEW.target_type = 'post' THEN SELECT author_id INTO owner_id FROM public.posts WHERE id = target_num;
    ELSIF NEW.target_type = 'reel' THEN SELECT author_id INTO owner_id FROM public.reels WHERE id = target_num;
    END IF;
  END IF;
  IF owner_id IS NOT NULL AND owner_id <> NEW.user_id THEN
    BEGIN
      INSERT INTO public.notifications(recipient_id, title, body, type)
      VALUES (owner_id, 'تعليق جديد', jsonb_build_object('target_type', NEW.target_type, 'target_id', NEW.target_id, 'comment_id', NEW.id, 'author_name', NEW.author_name)::text, 'comment');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Alwaha notification failed for comment %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $function$
DECLARE owner_id uuid; liked_name text; like_target bigint;
BEGIN
  SELECT trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) INTO liked_name FROM public.users WHERE id = NEW.user_id;
  IF TG_TABLE_NAME = 'post_likes' THEN
    like_target := NEW.post_id;
    SELECT author_id INTO owner_id FROM public.posts WHERE id = like_target;
    IF owner_id IS NOT NULL AND owner_id <> NEW.user_id THEN
      BEGIN
        INSERT INTO public.notifications(recipient_id, title, body, type)
        VALUES (owner_id, 'إعجاب جديد بمنشورك', jsonb_build_object('post_id', like_target, 'user_id', NEW.user_id, 'user_name', coalesce(liked_name, 'مستخدم'))::text, 'like');
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Alwaha notification failed for post like %: %', like_target, SQLERRM;
      END;
    END IF;
  ELSE
    like_target := NEW.reel_id;
    SELECT author_id INTO owner_id FROM public.reels WHERE id = like_target;
    IF owner_id IS NOT NULL AND owner_id <> NEW.user_id THEN
      BEGIN
        INSERT INTO public.notifications(recipient_id, title, body, type)
        VALUES (owner_id, 'إعجاب جديد بالريلز', jsonb_build_object('reel_id', like_target, 'user_id', NEW.user_id, 'user_name', coalesce(liked_name, 'مستخدم'))::text, 'like');
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Alwaha notification failed for reel like %: %', like_target, SQLERRM;
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

COMMIT;
