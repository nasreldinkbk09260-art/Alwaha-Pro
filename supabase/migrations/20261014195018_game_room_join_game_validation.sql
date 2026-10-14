-- Prevent joining and starting a room from the wrong game category.
BEGIN;
CREATE OR REPLACE FUNCTION public.join_game_room(p_room_code text, p_expected_game_id text)
RETURNS public.game_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_room public.game_rooms;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_room_code IS NULL OR upper(trim(p_room_code)) !~ '^[A-HJ-NP-Z2-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid room code';
  END IF;
  IF p_expected_game_id IS NULL OR p_expected_game_id NOT IN ('chess', 'ludo', 'war') THEN
    RAISE EXCEPTION 'Invalid expected game';
  END IF;
  SELECT * INTO v_room FROM public.game_rooms
   WHERE room_code = upper(trim(p_room_code)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.game_id <> p_expected_game_id THEN RAISE EXCEPTION 'Room belongs to another game'; END IF;
  IF v_room.player1_id = v_uid OR v_room.player2_id = v_uid THEN RETURN v_room; END IF;
  IF v_room.status <> 'waiting' OR v_room.player2_id IS NOT NULL THEN
    RAISE EXCEPTION 'Room is not waiting for another player';
  END IF;
  UPDATE public.game_rooms SET player2_id = v_uid, status = 'playing', current_turn = player1_id, updated_at = now()
   WHERE id = v_room.id RETURNING * INTO v_room;
  RETURN v_room;
END;
$function$;
REVOKE ALL ON FUNCTION public.join_game_room(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_game_room(text, text) TO authenticated;
COMMIT;
