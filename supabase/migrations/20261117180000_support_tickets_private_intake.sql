BEGIN;
CREATE TABLE IF NOT EXISTS public.support_tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 category text NOT NULL CHECK(category IN ('bug','account','performance','messaging','calls','marketplace','suggestion','other')),
 subject text NOT NULL CHECK(char_length(subject) BETWEEN 4 AND 120),
 description text NOT NULL CHECK(char_length(description) BETWEEN 12 AND 2400),
 app_version text NOT NULL DEFAULT 'unknown' CHECK(char_length(app_version)<=32),
 platform text NOT NULL DEFAULT 'unknown' CHECK(platform IN ('android','ios','web','unknown')),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','triaged','in_progress','resolved','closed')),
 priority smallint NOT NULL DEFAULT 0 CHECK(priority BETWEEN 0 AND 100),
 triage_label text NOT NULL DEFAULT 'other' CHECK(char_length(triage_label)<=48),
 assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 staff_note text CHECK(staff_note IS NULL OR char_length(staff_note)<=1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.support_tickets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.support_tickets TO service_role;
CREATE INDEX IF NOT EXISTS support_tickets_queue_idx ON public.support_tickets(status,priority DESC,created_at ASC) WHERE status IN ('open','triaged','in_progress');
CREATE INDEX IF NOT EXISTS support_tickets_user_created_idx ON public.support_tickets(user_id,created_at DESC) WHERE user_id IS NOT NULL;
COMMENT ON TABLE public.support_tickets IS 'Private text-only support intake. Edge Function mediated access; no direct client grants or attachments.';
COMMIT;
