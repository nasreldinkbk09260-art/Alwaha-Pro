DO $assert$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='content_reports_reviewed_by_idx')
 OR NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='content_reports_target_user_id_idx') THEN
  RAISE EXCEPTION 'Content moderation foreign-key indexes are missing';
 END IF;
END;
$assert$;
SELECT 'CONTENT_REPORTS_FK_INDEX_AUDIT=PASS' AS result;
