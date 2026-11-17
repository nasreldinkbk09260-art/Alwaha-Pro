BEGIN;
DO $$
DECLARE v_rls boolean; v_user uuid:=gen_random_uuid(); v_ticket uuid; v_owner uuid;
BEGIN
 SELECT relrowsecurity INTO v_rls FROM pg_class WHERE oid='public.support_tickets'::regclass;
 IF NOT coalesce(v_rls,false) THEN RAISE EXCEPTION 'support_tickets RLS disabled'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets') THEN RAISE EXCEPTION 'client policies must not exist'; END IF;
 IF has_table_privilege('anon','public.support_tickets','SELECT') OR has_table_privilege('anon','public.support_tickets','INSERT')
 OR has_table_privilege('authenticated','public.support_tickets','SELECT') OR has_table_privilege('authenticated','public.support_tickets','INSERT')
 OR has_table_privilege('authenticated','public.support_tickets','UPDATE') THEN RAISE EXCEPTION 'client privileges leaked'; END IF;
 IF NOT has_table_privilege('service_role','public.support_tickets','SELECT') OR NOT has_table_privilege('service_role','public.support_tickets','INSERT')
 OR NOT has_table_privilege('service_role','public.support_tickets','UPDATE') THEN RAISE EXCEPTION 'service role grants missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='support_tickets_queue_idx')
 OR NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='support_tickets_user_created_idx') THEN RAISE EXCEPTION 'indexes missing'; END IF;
 INSERT INTO auth.users(id) VALUES(v_user);
 INSERT INTO public.support_tickets(user_id,category,subject,description,priority,triage_label)
 VALUES(v_user,'bug','اختبار بلاغ الدعم','اختبار حفظ سجل الدعم في بيئة الاختبار فقط',35,'possible_crash') RETURNING id INTO v_ticket;
 DELETE FROM auth.users WHERE id=v_user;
 SELECT user_id INTO v_owner FROM public.support_tickets WHERE id=v_ticket;
 IF v_owner IS NOT NULL THEN RAISE EXCEPTION 'ticket user id was not anonymized'; END IF;
 BEGIN
  INSERT INTO public.support_tickets(category,subject,description) VALUES('invalid','عنوان صحيح','وصف اختبار طويل بما يكفي');
  RAISE EXCEPTION 'invalid category accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
ROLLBACK;
