DO $$
DECLARE
  v_rls boolean;
  v_policies integer;
BEGIN
  SELECT relrowsecurity INTO v_rls
  FROM pg_class WHERE oid='public.admin_action_logs'::regclass;
  IF NOT COALESCE(v_rls,false) THEN
    RAISE EXCEPTION 'admin_action_logs must have RLS enabled';
  END IF;

  IF has_table_privilege('anon','public.admin_action_logs','SELECT')
     OR has_table_privilege('anon','public.admin_action_logs','INSERT')
     OR has_table_privilege('authenticated','public.admin_action_logs','SELECT')
     OR has_table_privilege('authenticated','public.admin_action_logs','INSERT') THEN
    RAISE EXCEPTION 'Client roles must not access admin_action_logs directly';
  END IF;

  IF NOT has_table_privilege('service_role','public.admin_action_logs','INSERT')
     OR NOT has_table_privilege('service_role','public.admin_action_logs','SELECT')
     OR NOT has_table_privilege('service_role','public.admin_action_logs','UPDATE') THEN
    RAISE EXCEPTION 'service_role must own the admin audit-log access path';
  END IF;

  IF has_sequence_privilege('anon','public.admin_action_logs_id_seq','USAGE')
     OR has_sequence_privilege('authenticated','public.admin_action_logs_id_seq','USAGE')
     OR NOT has_sequence_privilege('service_role','public.admin_action_logs_id_seq','USAGE') THEN
    RAISE EXCEPTION 'admin audit-log identity sequence privileges are not restricted correctly';
  END IF;

  SELECT count(*) INTO v_policies FROM pg_policies
  WHERE schemaname='public' AND tablename='admin_action_logs';
  IF v_policies <> 0 THEN
    RAISE EXCEPTION 'admin_action_logs must not expose client RLS policies';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='admin_action_logs' AND indexname='admin_action_logs_created_at_idx')
     OR NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='admin_action_logs' AND indexname='admin_action_logs_actor_created_idx') THEN
    RAISE EXCEPTION 'admin_action_logs required indexes are missing';
  END IF;
END $$;
