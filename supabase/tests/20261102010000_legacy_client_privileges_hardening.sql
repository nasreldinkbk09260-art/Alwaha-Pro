-- Run on a disposable/development Supabase database after the paired migration.
-- Read-only assertions; the transaction is rolled back.
BEGIN;
DO $alwaha_test$
DECLARE
  v_table text;
  v_role text;
  v_privilege text;
  v_tables text[] := ARRAY['public.likes','public.profiles','public.ratings'];
  v_roles text[] := ARRAY['anon','authenticated'];
  v_write_privileges text[] := ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    FOREACH v_role IN ARRAY v_roles LOOP
      IF NOT has_table_privilege(v_role,v_table,'SELECT') THEN
        RAISE EXCEPTION 'Expected SELECT for role % on %',v_role,v_table;
      END IF;
      FOREACH v_privilege IN ARRAY v_write_privileges LOOP
        IF has_table_privilege(v_role,v_table,v_privilege) THEN
          RAISE EXCEPTION 'Unexpected % privilege for role % on %',v_privilege,v_role,v_table;
        END IF;
      END LOOP;
    END LOOP;
    IF EXISTS (
      SELECT 1 FROM pg_class AS c
      JOIN pg_namespace AS n ON n.oid=c.relnamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) AS acl
      WHERE n.nspname='public' AND c.relname=split_part(v_table,'.',2)
        AND acl.grantee=0 AND acl.privilege_type<>'SELECT'
    ) THEN
      RAISE EXCEPTION 'PUBLIC retains non-SELECT ACL on %',v_table;
    END IF;
  END LOOP;
END;
$alwaha_test$;
ROLLBACK;
