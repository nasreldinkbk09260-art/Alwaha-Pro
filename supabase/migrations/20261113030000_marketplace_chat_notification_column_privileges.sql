-- Restrict marketplace/chat inserts to user-authored fields and notification updates to read state.
-- Server-generated timestamps, snapshots, sale retention, consent and moderation state are not client-controlled.
BEGIN;

REVOKE INSERT ON TABLE public.market_conversations FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id, product_id, buyer_id, seller_id, created_at, listing_snapshot, archived_at,
  retention_until, retention_notice_sent_at, delete_approved_by_buyer_at, delete_approved_by_seller_at)
  ON TABLE public.market_conversations FROM PUBLIC, anon, authenticated;
GRANT INSERT (product_id, buyer_id, seller_id) ON TABLE public.market_conversations TO authenticated;

REVOKE INSERT ON TABLE public.market_messages FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id, conversation_id, sender_id, message, created_at, read_at, reply_to_id)
  ON TABLE public.market_messages FROM PUBLIC, anon, authenticated;
GRANT INSERT (conversation_id, sender_id, message, reply_to_id) ON TABLE public.market_messages TO authenticated;

REVOKE INSERT ON TABLE public.marketplace_reports FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id, product_id, seller_id, reporter_id, reason, status, created_at, reviewed_at)
  ON TABLE public.marketplace_reports FROM PUBLIC, anon, authenticated;
GRANT INSERT (product_id, seller_id, reporter_id, reason) ON TABLE public.marketplace_reports TO authenticated;

REVOKE INSERT ON TABLE public.marketplace_reviews FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id, product_id, seller_id, reviewer_id, rating, review, created_at)
  ON TABLE public.marketplace_reviews FROM PUBLIC, anon, authenticated;
GRANT INSERT (product_id, seller_id, reviewer_id, rating, review) ON TABLE public.marketplace_reviews TO authenticated;

REVOKE INSERT ON TABLE public.friend_requests FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id, requester_id, target_id, status, created_at)
  ON TABLE public.friend_requests FROM PUBLIC, anon, authenticated;
GRANT INSERT (requester_id, target_id) ON TABLE public.friend_requests TO authenticated;

REVOKE UPDATE ON TABLE public.notifications FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (id, recipient_id, title, body, type, is_read, created_at)
  ON TABLE public.notifications FROM PUBLIC, anon, authenticated;
GRANT UPDATE (is_read) ON TABLE public.notifications TO authenticated;

COMMIT;
