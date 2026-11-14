BEGIN;
CREATE TABLE IF NOT EXISTS public.user_blocks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 blocker_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 blocked_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT user_blocks_no_self CHECK (blocker_id<>blocked_user_id),
 CONSTRAINT user_blocks_unique_pair UNIQUE(blocker_id,blocked_user_id)
);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_lookup_idx ON public.user_blocks(blocked_user_id,blocker_id);

CREATE TABLE IF NOT EXISTS public.content_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reporter_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
 target_type text NOT NULL CHECK(target_type IN ('user','post','reel','comment')),
 target_id text NOT NULL CHECK(char_length(target_id) BETWEEN 1 AND 64),
 target_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
 reason text NOT NULL CHECK(reason IN ('spam','harassment','inappropriate','violence','fraud','other')),
 details text NOT NULL DEFAULT '' CHECK(char_length(details)<=850),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','under_review','actioned','dismissed')),
 reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_reports_queue_idx ON public.content_reports(status,created_at DESC);
CREATE INDEX IF NOT EXISTS content_reports_target_idx ON public.content_reports(target_type,target_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS content_reports_one_open_per_reporter_target_idx
 ON public.content_reports(reporter_id,target_type,target_id)
 WHERE reporter_id IS NOT NULL AND status IN ('pending','under_review');

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_blocks FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.content_reports FROM PUBLIC,anon,authenticated;
GRANT ALL ON TABLE public.user_blocks,public.content_reports TO service_role;

CREATE OR REPLACE FUNCTION app_private.is_user_blocked(p_user_a uuid,p_user_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT p_user_a IS NOT NULL AND p_user_b IS NOT NULL AND p_user_a<>p_user_b
 AND EXISTS(SELECT 1 FROM public.user_blocks b
   WHERE (b.blocker_id=p_user_a AND b.blocked_user_id=p_user_b)
      OR (b.blocker_id=p_user_b AND b.blocked_user_id=p_user_a));
$function$;
REVOKE ALL ON FUNCTION app_private.is_user_blocked(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.is_user_blocked(uuid,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION app_private.can_interact_with_content(p_actor_id uuid,p_target_type text,p_target_id text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_owner_id uuid;
BEGIN
 IF p_actor_id IS NULL OR p_target_type IS NULL OR p_target_id IS NULL THEN RETURN false; END IF;
 IF p_target_type='post' THEN SELECT author_id INTO v_owner_id FROM public.posts WHERE id::text=p_target_id;
 ELSIF p_target_type='reel' THEN SELECT author_id INTO v_owner_id FROM public.reels WHERE id::text=p_target_id;
 ELSIF p_target_type='comment' THEN SELECT user_id INTO v_owner_id FROM public.comments WHERE id::text=p_target_id;
 ELSE RETURN false; END IF;
 IF v_owner_id IS NULL THEN RETURN false; END IF;
 RETURN NOT app_private.is_user_blocked(p_actor_id,v_owner_id);
END;
$function$;
REVOKE ALL ON FUNCTION app_private.can_interact_with_content(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.can_interact_with_content(uuid,text,text) TO authenticated,service_role;

DROP POLICY IF EXISTS posts_select_public ON public.posts;
CREATE POLICY posts_select_public ON public.posts FOR SELECT TO anon,authenticated
 USING((SELECT auth.uid()) IS NULL OR NOT app_private.is_user_blocked((SELECT auth.uid()),author_id));
DROP POLICY IF EXISTS reels_select_public ON public.reels;
CREATE POLICY reels_select_public ON public.reels FOR SELECT TO anon,authenticated
 USING((SELECT auth.uid()) IS NULL OR NOT app_private.is_user_blocked((SELECT auth.uid()),author_id));
DROP POLICY IF EXISTS comments_select_public ON public.comments;
CREATE POLICY comments_select_public ON public.comments FOR SELECT TO anon,authenticated
 USING((SELECT auth.uid()) IS NULL OR NOT app_private.is_user_blocked((SELECT auth.uid()),user_id));

DROP POLICY IF EXISTS comments_insert_own ON public.comments;
CREATE POLICY comments_insert_own ON public.comments FOR INSERT TO authenticated
 WITH CHECK(user_id=(SELECT auth.uid()) AND app_private.can_interact_with_content((SELECT auth.uid()),target_type,target_id));

DROP POLICY IF EXISTS follows_select_participating ON public.follows;
CREATE POLICY follows_select_participating ON public.follows FOR SELECT TO authenticated
 USING((follower_id=(SELECT auth.uid()) OR following_id=(SELECT auth.uid()))
   AND NOT app_private.is_user_blocked(follower_id,following_id));
DROP POLICY IF EXISTS follows_insert_self ON public.follows;
CREATE POLICY follows_insert_self ON public.follows FOR INSERT TO authenticated
 WITH CHECK(follower_id=(SELECT auth.uid()) AND follower_id<>following_id
   AND NOT app_private.is_user_blocked(follower_id,following_id));

DROP POLICY IF EXISTS friend_requests_select_participant ON public.friend_requests;
CREATE POLICY friend_requests_select_participant ON public.friend_requests FOR SELECT TO authenticated
 USING((requester_id=(SELECT auth.uid()) OR target_id=(SELECT auth.uid()))
   AND NOT app_private.is_user_blocked(requester_id,target_id));
DROP POLICY IF EXISTS friend_requests_insert_requester ON public.friend_requests;
CREATE POLICY friend_requests_insert_requester ON public.friend_requests FOR INSERT TO authenticated
 WITH CHECK(requester_id=(SELECT auth.uid()) AND requester_id<>target_id AND status='pending'
   AND NOT app_private.is_user_blocked(requester_id,target_id));
DROP POLICY IF EXISTS friend_requests_update_participant ON public.friend_requests;
CREATE POLICY friend_requests_update_participant ON public.friend_requests FOR UPDATE TO authenticated
 USING((requester_id=(SELECT auth.uid()) OR target_id=(SELECT auth.uid()))
   AND NOT app_private.is_user_blocked(requester_id,target_id))
 WITH CHECK(NOT app_private.is_user_blocked(requester_id,target_id) AND
   ((requester_id=(SELECT auth.uid()) AND status='cancelled')
    OR (target_id=(SELECT auth.uid()) AND status IN ('accepted','rejected'))));

DROP POLICY IF EXISTS messages_select_participant ON public.messages;
CREATE POLICY messages_select_participant ON public.messages FOR SELECT TO authenticated
 USING((sender_id=(SELECT auth.uid()) OR receiver_id=(SELECT auth.uid()))
   AND NOT app_private.is_user_blocked((SELECT auth.uid()),
     CASE WHEN sender_id=(SELECT auth.uid()) THEN receiver_id ELSE sender_id END));
DROP POLICY IF EXISTS messages_insert_sender_accepted_friends ON public.messages;
CREATE POLICY messages_insert_sender_accepted_friends ON public.messages FOR INSERT TO authenticated
 WITH CHECK(sender_id=(SELECT auth.uid()) AND receiver_id IS NOT NULL
   AND NOT app_private.is_user_blocked(sender_id,receiver_id)
   AND EXISTS(SELECT 1 FROM public.friend_requests fr WHERE fr.status='accepted'
     AND ((fr.requester_id=(SELECT auth.uid()) AND fr.target_id=messages.receiver_id)
       OR (fr.target_id=(SELECT auth.uid()) AND fr.requester_id=messages.receiver_id)))
   AND app_private.can_reply_to_direct_message(reply_to_id,sender_id,receiver_id));

DROP POLICY IF EXISTS market_conversations_select_participant ON public.market_conversations;
CREATE POLICY market_conversations_select_participant ON public.market_conversations FOR SELECT TO authenticated
 USING((buyer_id=(SELECT auth.uid()) OR seller_id=(SELECT auth.uid()))
   AND NOT app_private.is_user_blocked(buyer_id,seller_id));
DROP POLICY IF EXISTS market_conversations_insert_buyer_active_listing ON public.market_conversations;
CREATE POLICY market_conversations_insert_buyer_active_listing ON public.market_conversations FOR INSERT TO authenticated
 WITH CHECK(buyer_id=(SELECT auth.uid()) AND buyer_id<>seller_id
   AND NOT app_private.is_user_blocked(buyer_id,seller_id)
   AND EXISTS(SELECT 1 FROM public.products p WHERE p.id=market_conversations.product_id
     AND p.seller_id=market_conversations.seller_id AND p.status='active'));

DROP POLICY IF EXISTS market_messages_select_participant ON public.market_messages;
CREATE POLICY market_messages_select_participant ON public.market_messages FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.market_conversations c WHERE c.id=conversation_id
   AND (c.buyer_id=(SELECT auth.uid()) OR c.seller_id=(SELECT auth.uid()))
   AND NOT app_private.is_user_blocked(c.buyer_id,c.seller_id)));
DROP POLICY IF EXISTS market_messages_insert_participant ON public.market_messages;
CREATE POLICY market_messages_insert_participant ON public.market_messages FOR INSERT TO authenticated
 WITH CHECK(sender_id=(SELECT auth.uid())
   AND EXISTS(SELECT 1 FROM public.market_conversations c WHERE c.id=conversation_id
     AND (c.buyer_id=(SELECT auth.uid()) OR c.seller_id=(SELECT auth.uid()))
     AND NOT app_private.is_user_blocked(c.buyer_id,c.seller_id))
   AND app_private.can_reply_to_market_message(reply_to_id,conversation_id,sender_id));

DROP POLICY IF EXISTS post_likes_insert_own ON public.post_likes;
CREATE POLICY post_likes_insert_own ON public.post_likes FOR INSERT TO authenticated
 WITH CHECK(user_id=(SELECT auth.uid()) AND app_private.can_interact_with_content((SELECT auth.uid()),'post',post_id::text));
DROP POLICY IF EXISTS reel_likes_insert_own ON public.reel_likes;
CREATE POLICY reel_likes_insert_own ON public.reel_likes FOR INSERT TO authenticated
 WITH CHECK(user_id=(SELECT auth.uid()) AND app_private.can_interact_with_content((SELECT auth.uid()),'reel',reel_id::text));
COMMIT;
