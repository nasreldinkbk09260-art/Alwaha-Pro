BEGIN;
INSERT INTO auth.users(id) VALUES
 ('10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;
INSERT INTO public.game_rooms(room_code,game_id,created_by,player1_id,player2_id,current_turn,status,state,move_no)
VALUES ('G7H2K9','chess','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','playing',jsonb_build_object('fen','start'),0)
ON CONFLICT (room_code) DO NOTHING;
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $$
DECLARE v public.game_rooms;
BEGIN
  SELECT * INTO v FROM public.apply_game_action_result(
    (SELECT id FROM public.game_rooms WHERE room_code='G7H2K9'),0,
    '10000000-0000-4000-8000-000000000001',
    jsonb_build_object('fen','after-valid-move'),
    '10000000-0000-4000-8000-000000000002',
    'playing',NULL
  );
  IF v.move_no<>1 OR v.current_turn<>'10000000-0000-4000-8000-000000000002' OR v.state->>'fen'<>'after-valid-move' THEN
    RAISE EXCEPTION 'Atomic authorized game action update failed';
  END IF;
  IF has_function_privilege('authenticated','public.apply_game_action_result(uuid,integer,uuid,jsonb,uuid,text,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated must not execute service-only game action RPC';
  END IF;
  IF has_function_privilege('anon','public.apply_game_action_result(uuid,integer,uuid,jsonb,uuid,text,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Anon must not execute service-only game action RPC';
  END IF;
  IF has_function_privilege('authenticated','public.submit_game_move(uuid,integer,jsonb,uuid,text,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated legacy direct state mutation RPC must be revoked';
  END IF;
  IF NOT has_table_privilege('authenticated','public.game_rooms','SELECT') OR
     has_table_privilege('authenticated','public.game_rooms','INSERT') OR
     has_table_privilege('authenticated','public.game_rooms','UPDATE') OR
     has_table_privilege('authenticated','public.game_rooms','DELETE') THEN
    RAISE EXCEPTION 'Authenticated clients may read game rooms but must not write them directly';
  END IF;
  IF NOT has_table_privilege('service_role','public.game_rooms','SELECT') OR
     NOT has_table_privilege('service_role','public.game_rooms','INSERT') OR
     NOT has_table_privilege('service_role','public.game_rooms','UPDATE') THEN
    RAISE EXCEPTION 'Service role must retain server-side game room read/write privileges';
  END IF;
  IF NOT has_function_privilege('authenticated','public.join_game_room(text,text)','EXECUTE') OR
     has_function_privilege('anon','public.join_game_room(text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'join_game_room must remain authenticated-only for safe room joining';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='public.join_game_room(text,text)'::regprocedure
                 AND coalesce(p.proconfig,ARRAY[]::text[]) @> ARRAY['search_path=""']::text[]) THEN
    RAISE EXCEPTION 'join_game_room SECURITY DEFINER search_path must be empty';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='public.submit_game_move(uuid,integer,jsonb,uuid,text,uuid)'::regprocedure
                 AND coalesce(p.proconfig,ARRAY[]::text[]) @> ARRAY['search_path=""']::text[]) THEN
    RAISE EXCEPTION 'legacy submit_game_move SECURITY DEFINER search_path must be empty';
  END IF;
  IF to_regprocedure('public.can_review_marketplace_product(bigint,uuid)') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.can_review_marketplace_product(bigint,uuid)')
                   AND coalesce(p.proconfig,ARRAY[]::text[]) @> ARRAY['search_path=""']::text[]) THEN
      RAISE EXCEPTION 'can_review_marketplace_product SECURITY DEFINER search_path must be empty';
    END IF;
  END IF;
END $$;
SELECT set_config('request.jwt.claim.role','authenticated',true);
DO $$
BEGIN
  BEGIN
    PERFORM public.apply_game_action_result(
      (SELECT id FROM public.game_rooms WHERE room_code='G7H2K9'),1,
      '10000000-0000-4000-8000-000000000002',
      jsonb_build_object('fen','unauthorized'),
      '10000000-0000-4000-8000-000000000001',
      'playing',NULL
    );
    RAISE EXCEPTION 'Expected service role claim guard to reject authenticated claim';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $$
BEGIN
  BEGIN
    PERFORM public.apply_game_action_result(
      (SELECT id FROM public.game_rooms WHERE room_code='G7H2K9'),0,
      '10000000-0000-4000-8000-000000000002',
      jsonb_build_object('fen','stale-write'),
      '10000000-0000-4000-8000-000000000001',
      'playing',NULL
    );
    RAISE EXCEPTION 'Expected stale move rejection';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;
END $$;
ROLLBACK;
SELECT 'GAME_ACTIONS_SECURITY=PASS' AS result;