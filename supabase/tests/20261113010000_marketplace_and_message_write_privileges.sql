-- Regression checks for client write privileges and marketplace lifecycle guards.
DO $test$
BEGIN
  IF has_table_privilege('authenticated', 'public.products', 'INSERT')
     OR has_table_privilege('authenticated', 'public.products', 'UPDATE') THEN
    RAISE EXCEPTION 'products must not expose table-wide INSERT/UPDATE to authenticated';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.products', 'seller_id', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.products', 'title', 'INSERT')
     OR has_column_privilege('authenticated', 'public.products', 'status', 'INSERT')
     OR has_column_privilege('authenticated', 'public.products', 'sold_to', 'INSERT')
     OR has_column_privilege('authenticated', 'public.products', 'seller_email', 'INSERT') THEN
    RAISE EXCEPTION 'products INSERT column grants are not least-privilege';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.products', 'status', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.products', 'archived_at', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.products', 'promoted_until', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.products', 'seller_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.products', 'sold_to', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.products', 'sold_at', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.products', 'seller_email', 'UPDATE') THEN
    RAISE EXCEPTION 'products UPDATE column grants are not least-privilege';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.products'::regclass
      AND tgname = 'products_guard_client_lifecycle'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'products lifecycle guard trigger is missing';
  END IF;

  IF has_table_privilege('authenticated', 'public.messages', 'INSERT')
     OR has_table_privilege('authenticated', 'public.messages', 'UPDATE') THEN
    RAISE EXCEPTION 'messages must not expose table-wide INSERT/UPDATE to authenticated';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.messages', 'sender_id', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.messages', 'receiver_id', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.messages', 'message', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.messages', 'reply_to_id', 'INSERT')
     OR has_column_privilege('authenticated', 'public.messages', 'read_at', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.messages', 'read_at', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.messages', 'message', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.messages', 'sender_id', 'UPDATE') THEN
    RAISE EXCEPTION 'messages column grants are not least-privilege';
  END IF;

  IF has_table_privilege('authenticated', 'public.verification_requests', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.verification_requests', 'status', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.verification_requests', 'reviewed_at', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.verification_requests', 'reviewed_by', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.verification_requests', 'reason', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.verification_requests', 'user_id', 'UPDATE') THEN
    RAISE EXCEPTION 'verification_requests update grants are not least-privilege';
  END IF;
END;
$test$;
