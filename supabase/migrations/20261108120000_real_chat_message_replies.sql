BEGIN;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id bigint NULL REFERENCES public.messages(id) ON DELETE SET NULL;
ALTER TABLE public.market_messages ADD COLUMN IF NOT EXISTS reply_to_id uuid NULL REFERENCES public.market_messages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS messages_reply_to_id_idx ON public.messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS market_messages_reply_to_id_idx ON public.market_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- Narrow SECURITY DEFINER predicates avoid recursive RLS evaluation on the message table.
CREATE OR REPLACE FUNCTION public.can_reply_to_direct_message(p_reply_to_id bigint,p_sender_id uuid,p_receiver_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT p_reply_to_id IS NULL OR (p_sender_id=(SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.messages parent
     WHERE parent.id=p_reply_to_id
       AND ((parent.sender_id=p_sender_id AND parent.receiver_id=p_receiver_id)
         OR (parent.sender_id=p_receiver_id AND parent.receiver_id=p_sender_id))
  ));
$function$;
REVOKE ALL ON FUNCTION public.can_reply_to_direct_message(bigint,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_reply_to_direct_message(bigint,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_reply_to_market_message(p_reply_to_id uuid,p_conversation_id uuid,p_sender_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT p_reply_to_id IS NULL OR (p_sender_id=(SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.market_messages parent
     WHERE parent.id=p_reply_to_id AND parent.conversation_id=p_conversation_id
  ) AND EXISTS (
    SELECT 1 FROM public.market_conversations c
     WHERE c.id=p_conversation_id AND (c.buyer_id=(SELECT auth.uid()) OR c.seller_id=(SELECT auth.uid()))
  ));
$function$;
REVOKE ALL ON FUNCTION public.can_reply_to_market_message(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_reply_to_market_message(uuid,uuid,uuid) TO authenticated;

-- A direct-chat reply must refer to a message exchanged by the same two participants.
DROP POLICY IF EXISTS messages_insert_sender_accepted_friends ON public.messages;
CREATE POLICY messages_insert_sender_accepted_friends ON public.messages FOR INSERT TO authenticated WITH CHECK (
 sender_id=(SELECT auth.uid()) AND receiver_id IS NOT NULL
 AND EXISTS (SELECT 1 FROM public.friend_requests fr WHERE fr.status='accepted' AND
   ((fr.requester_id=(SELECT auth.uid()) AND fr.target_id=messages.receiver_id) OR
    (fr.target_id=(SELECT auth.uid()) AND fr.requester_id=messages.receiver_id)))
 AND public.can_reply_to_direct_message(reply_to_id,sender_id,receiver_id)
);

-- A marketplace reply must refer to a message from the exact same conversation.
DROP POLICY IF EXISTS market_messages_insert_participant ON public.market_messages;
CREATE POLICY market_messages_insert_participant ON public.market_messages FOR INSERT TO authenticated WITH CHECK (
 sender_id=(SELECT auth.uid())
 AND EXISTS (SELECT 1 FROM public.market_conversations c WHERE c.id=market_messages.conversation_id
   AND (c.buyer_id=(SELECT auth.uid()) OR c.seller_id=(SELECT auth.uid())))
 AND public.can_reply_to_market_message(reply_to_id,conversation_id,sender_id)
);
COMMIT;