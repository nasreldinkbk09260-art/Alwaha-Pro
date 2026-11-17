BEGIN;
ALTER TABLE public.content_reports
  DROP CONSTRAINT IF EXISTS content_reports_reason_check;
ALTER TABLE public.content_reports
  ADD CONSTRAINT content_reports_reason_check
  CHECK (reason IN ('spam','harassment','inappropriate','violence','fraud','child_safety','other'));

ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 0
  CHECK (priority BETWEEN 0 AND 100);

UPDATE public.content_reports
SET priority = CASE WHEN reason='child_safety' THEN 100 ELSE 0 END
WHERE priority <> CASE WHEN reason='child_safety' THEN 100 ELSE 0 END;

CREATE INDEX IF NOT EXISTS content_reports_priority_queue_idx
  ON public.content_reports(priority DESC, created_at ASC)
  WHERE status IN ('pending','under_review');
COMMIT;
