BEGIN;
-- The client may change only the status of a friend request. Requester and target IDs,
-- primary key, and timestamps must never be editable through the public API.
REVOKE UPDATE ON TABLE public.friend_requests FROM PUBLIC, anon, authenticated;
GRANT UPDATE (status) ON TABLE public.friend_requests TO authenticated;
COMMENT ON TABLE public.friend_requests IS 'Friend-request participant access is enforced by RLS; authenticated clients can update only status.';
COMMIT;
