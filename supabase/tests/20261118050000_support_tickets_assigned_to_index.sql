DO $test$
DECLARE
  column_exists boolean;
  index_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='support_tickets'
      AND column_name='assigned_to'
  ) INTO column_exists;

  IF NOT column_exists THEN
    RAISE EXCEPTION 'support_tickets.assigned_to column is missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='support_tickets'
      AND indexname='support_tickets_assigned_to_idx'
      AND indexdef ILIKE '%(assigned_to)%'
  ) INTO index_exists;

  IF NOT index_exists THEN
    RAISE EXCEPTION 'support_tickets assigned_to index is missing';
  END IF;
END
$test$;

SELECT 'SUPPORT_TICKETS_ASSIGNED_TO_INDEX=PASS' AS result;
