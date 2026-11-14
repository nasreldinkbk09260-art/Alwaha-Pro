-- Multiplayer rooms for Alwaha-Pro 2.8.3. Apply through the Supabase migration workflow.
begin;

create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique check (room_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  game_id text not null check (game_id in ('chess','ludo','war')),
  created_by uuid not null references auth.users(id) on delete cascade,
  player1_id uuid not null references auth.users(id) on delete cascade,
  player2_id uuid references auth.users(id) on delete cascade,
  current_turn uuid references auth.users(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting','playing','finished')),
  state jsonb not null default '{}'::jsonb,
  winner_id uuid references auth.users(id) on delete set null,
  move_no integer not null default 0 check (move_no >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_rooms_distinct_players check (player2_id is null or player1_id <> player2_id),
  constraint game_rooms_creator_is_player1 check (created_by = player1_id)
);

create index if not exists game_rooms_waiting_idx on public.game_rooms(game_id, created_at desc) where status='waiting';
create index if not exists game_rooms_player1_idx on public.game_rooms(player1_id, updated_at desc);
create index if not exists game_rooms_player2_idx on public.game_rooms(player2_id, updated_at desc);

alter table public.game_rooms enable row level security;
revoke all on table public.game_rooms from public, anon, authenticated;
grant select, insert on table public.game_rooms to authenticated;

drop policy if exists game_rooms_select_participant on public.game_rooms;
create policy game_rooms_select_participant on public.game_rooms
  for select to authenticated
  using (player1_id = (select auth.uid()) or player2_id = (select auth.uid()));

drop policy if exists game_rooms_insert_creator on public.game_rooms;
create policy game_rooms_insert_creator on public.game_rooms
  for insert to authenticated
  with check (
    created_by = (select auth.uid()) and
    player1_id = (select auth.uid()) and
    player2_id is null and
    status = 'waiting' and
    current_turn = (select auth.uid()) and
    winner_id is null and move_no = 0 and
    octet_length(state::text) <= 24576
  );

create or replace function public.join_game_room(p_room_code text)
returns public.game_rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_room public.game_rooms;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_room_code is null or upper(trim(p_room_code)) !~ '^[A-HJ-NP-Z2-9]{6}$' then
    raise exception 'Invalid room code';
  end if;
  select * into v_room from public.game_rooms
    where room_code = upper(trim(p_room_code)) for update;
  if not found then raise exception 'Room not found'; end if;
  if v_room.player1_id = v_uid or v_room.player2_id = v_uid then return v_room; end if;
  if v_room.status <> 'waiting' or v_room.player2_id is not null then
    raise exception 'Room is not waiting for another player';
  end if;
  update public.game_rooms
    set player2_id = v_uid, status = 'playing', current_turn = player1_id, updated_at = now()
    where id = v_room.id returning * into v_room;
  return v_room;
end;
$function$;

create or replace function public.submit_game_move(
  p_room_id uuid,
  p_expected_move_no integer,
  p_next_state jsonb,
  p_next_turn uuid,
  p_next_status text,
  p_winner_id uuid default null
)
returns public.game_rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_room public.game_rooms;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_next_state is null or octet_length(p_next_state::text) > 24576 then
    raise exception 'Invalid or oversized game state';
  end if;
  if p_next_status not in ('playing','finished') then raise exception 'Invalid next status'; end if;
  select * into v_room from public.game_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_room.status <> 'playing' or v_room.player2_id is null then raise exception 'Game is not active'; end if;
  if v_room.current_turn <> v_uid then raise exception 'It is not your turn'; end if;
  if v_room.move_no <> p_expected_move_no then raise exception 'Stale move; refresh the room'; end if;
  if p_next_turn is not null and p_next_turn not in (v_room.player1_id, v_room.player2_id) then
    raise exception 'Invalid next player';
  end if;
  if p_next_status = 'finished' and p_next_turn is not null then raise exception 'Finished games must not have a next turn'; end if;
  if p_next_status = 'playing' and (p_next_turn is null or p_winner_id is not null) then
    raise exception 'Active games require a turn and cannot have a winner';
  end if;
  if p_winner_id is not null and p_winner_id not in (v_room.player1_id, v_room.player2_id) then
    raise exception 'Winner must be a room participant';
  end if;
  update public.game_rooms set
    state = p_next_state,
    current_turn = p_next_turn,
    status = p_next_status,
    winner_id = p_winner_id,
    move_no = move_no + 1,
    updated_at = now()
  where id = v_room.id returning * into v_room;
  return v_room;
end;
$function$;

revoke all on function public.join_game_room(text) from public, anon;
revoke all on function public.submit_game_move(uuid,integer,jsonb,uuid,text,uuid) from public, anon;
grant execute on function public.join_game_room(text) to authenticated;
grant execute on function public.submit_game_move(uuid,integer,jsonb,uuid,text,uuid) to authenticated;

commit;
