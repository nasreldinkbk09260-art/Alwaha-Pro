BEGIN;
CREATE INDEX IF NOT EXISTS support_tickets_assigned_to_idx
  ON public.support_tickets (assigned_to);
COMMIT;
