BEGIN;

-- Game state is now computed by the authenticated game-actions Edge Function.
-- This atomic RPC is service-role only and checks participant, turn and move version.
CREATE OR REPLACE FUNCTION public.apply_game_action_result(
  p_room_id uuid,
  p_expected_move_no integer,
  p_actor_user_id uuid,
  p_next_state jsonb,
  p_next_turn uuid,
  p_next_status text,
  p_winner_id uuid DEFAULT NULL
) RETURNS public.game_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_room public.game_rooms;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';
  END IF;
  IF p_actor_user_id IS NULL OR p_expected_move_no IS NULL OR p_expected_move_no < 0 THEN
    RAISE EXCEPTION 'Invalid actor or move number' USING ERRCODE='22023';
  END IF;
  IF p_next_state IS NULL OR octet_length(p_next_state::text) > 24576 THEN
    RAISE EXCEPTION 'Invalid or oversized game state' USING ERRCODE='22023';
  END IF;
  IF p_next_status NOT IN ('playing','finished') THEN
    RAISE EXCEPTION 'Invalid next status' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_room FROM public.game_rooms WHERE id=p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found' USING ERRCODE='P0002'; END IF;
  IF v_room.status <> 'playing' OR v_room.player2_id IS NULL THEN
    RAISE EXCEPTION 'Game is not active' USING ERRCODE='55000';
  END IF;
  IF p_actor_user_id NOT IN (v_room.player1_id, v_room.player2_id) THEN
    RAISE EXCEPTION 'Actor is not a room participant' USING ERRCODE='42501';
  END IF;
  IF v_room.current_turn IS DISTINCT FROM p_actor_user_id THEN
    RAISE EXCEPTION 'It is not the actor turn' USING ERRCODE='42501';
  END IF;
  IF v_room.move_no <> p_expected_move_no THEN
    RAISE EXCEPTION 'Stale move; refresh the room' USING ERRCODE='40001';
  END IF;
  IF p_next_turn IS NOT NULL AND p_next_turn NOT IN (v_room.player1_id, v_room.player2_id) THEN
    RAISE EXCEPTION 'Invalid next player' USING ERRCODE='22023';
  END IF;
  IF p_next_status='playing' AND (p_next_turn IS NULL OR p_winner_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Active games require a next turn and no winner' USING ERRCODE='22023';
  END IF;
  IF p_next_status='finished' AND p_next_turn IS NOT NULL THEN
    RAISE EXCEPTION 'Finished games cannot have a next turn' USING ERRCODE='22023';
  END IF;
  IF p_winner_id IS NOT NULL AND p_winner_id NOT IN (v_room.player1_id, v_room.player2_id) THEN
    RAISE EXCEPTION 'Winner must be a room participant' USING ERRCODE='22023';
  END IF;
  UPDATE public.game_rooms
     SET state=p_next_state, current_turn=p_next_turn, status=p_next_status,
         winner_id=p_winner_id, move_no=move_no+1, updated_at=now()
   WHERE id=v_room.id RETURNING * INTO v_room;
  RETURN v_room;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_game_action_result(uuid,integer,uuid,jsonb,uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_game_action_result(uuid,integer,uuid,jsonb,uuid,text,uuid) TO service_role;
-- Retain the old RPC for rollback records but remove direct state-write access from app users.
REVOKE EXECUTE ON FUNCTION public.submit_game_move(uuid,integer,jsonb,uuid,text,uuid) FROM PUBLIC, anon, authenticated;
-- Clients may read rooms for realtime synchronization, but room creation and state writes are server-owned.
REVOKE ALL ON TABLE public.game_rooms FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.game_rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.game_rooms TO service_role;
-- Keep the two intentionally authenticated SECURITY DEFINER helpers pinned to an empty search_path.
ALTER FUNCTION public.join_game_room(text, text) SET search_path TO '';
DO $hardening$
BEGIN
  IF to_regprocedure('public.can_review_marketplace_product(bigint,uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.can_review_marketplace_product(bigint, uuid) SET search_path TO ''''';
  END IF;
END;
$hardening$;
-- The legacy mutation RPC is retained for rollback history but is not callable by application roles.
ALTER FUNCTION public.submit_game_move(uuid, integer, jsonb, uuid, text, uuid) SET search_path TO '';

COMMIT;