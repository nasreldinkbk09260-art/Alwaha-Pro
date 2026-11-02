-- Separate marketplace conversations from friend-only direct messages.
-- The second migration corrects the outer-row seller reference in the insert policy.
BEGIN;
CREATE TABLE IF NOT EXISTS public.market_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT market_conversations_one_buyer_per_product UNIQUE (product_id,buyer_id),
  CONSTRAINT market_conversations_no_self_chat CHECK (buyer_id <> seller_id)
);
CREATE INDEX IF NOT EXISTS market_conversations_buyer_created_idx ON public.market_conversations (buyer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS market_conversations_seller_created_idx ON public.market_conversations (seller_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.market_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.market_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(trim(message)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS market_messages_conversation_created_idx ON public.market_messages (conversation_id,created_at ASC);
CREATE INDEX IF NOT EXISTS market_messages_conversation_unread_idx ON public.market_messages (conversation_id,read_at) WHERE read_at IS NULL;
ALTER TABLE public.market_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_conversations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.market_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.market_conversations TO authenticated;
GRANT SELECT, INSERT ON TABLE public.market_messages TO authenticated;
GRANT UPDATE (read_at) ON TABLE public.market_messages TO authenticated;
CREATE POLICY market_conversations_select_participant ON public.market_conversations FOR SELECT TO authenticated
USING (buyer_id=(SELECT auth.uid()) OR seller_id=(SELECT auth.uid()));
CREATE POLICY market_conversations_insert_buyer_active_listing ON public.market_conversations FOR INSERT TO authenticated
WITH CHECK (buyer_id=(SELECT auth.uid()) AND buyer_id<>seller_id AND EXISTS (SELECT 1 FROM public.products p WHERE p.id=market_conversations.product_id AND p.seller_id=market_conversations.seller_id AND p.status='active'));
CREATE POLICY market_messages_select_participant ON public.market_messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.market_conversations c WHERE c.id=conversation_id AND (c.buyer_id=(SELECT auth.uid()) OR c.seller_id=(SELECT auth.uid()))));
CREATE POLICY market_messages_insert_participant ON public.market_messages FOR INSERT TO authenticated
WITH CHECK (sender_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.market_conversations c WHERE c.id=conversation_id AND (c.buyer_id=(SELECT auth.uid()) OR c.seller_id=(SELECT auth.uid()))));
CREATE POLICY market_messages_update_recipient_read_state ON public.market_messages FOR UPDATE TO authenticated
USING (sender_id<>(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.market_conversations c WHERE c.id=conversation_id AND (c.buyer_id=(SELECT auth.uid()) OR c.seller_id=(SELECT auth.uid()))))
WITH CHECK (sender_id<>(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.market_conversations c WHERE c.id=conversation_id AND (c.buyer_id=(SELECT auth.uid()) OR c.seller_id=(SELECT auth.uid()))));
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='market_messages') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.market_messages; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='market_conversations') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.market_conversations; END IF;
  END IF;
END $$;
COMMIT;
