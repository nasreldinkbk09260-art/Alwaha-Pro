BEGIN;
CREATE INDEX IF NOT EXISTS content_reports_reviewed_by_idx ON public.content_reports(reviewed_by) WHERE reviewed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS content_reports_target_user_id_idx ON public.content_reports(target_user_id) WHERE target_user_id IS NOT NULL;
COMMIT;
