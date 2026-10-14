begin;

-- ============================================================
-- Alwaha-Pro 2.8.2
-- Security fix: replace SECURITY DEFINER like-count views
-- with protected aggregate tables.
--
-- API shape is preserved:
--   public.post_like_counts
--       post_id, likes_count
--
--   public.reel_like_counts
--       reel_id, likes_count
--
-- Raw post_likes / reel_likes remain private.
-- ============================================================


-- ============================================================
-- 1. POST LIKE COUNTS
-- ============================================================

-- The old object was a SECURITY DEFINER VIEW.
-- Remove it before creating the secure aggregate table.

do $$
begin
    if exists (
        select 1
        from pg_class c
        join pg_namespace n
          on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = 'post_like_counts'
          and c.relkind = 'v'
    ) then
        execute 'drop view public.post_like_counts cascade';
    end if;
end
$$;


create table if not exists public.post_like_counts (
    post_id bigint primary key
        references public.posts(id)
        on delete cascade,

    likes_count bigint not null default 0,

    constraint post_like_counts_nonnegative
        check (likes_count >= 0)
);


-- Populate / repair existing counts.

insert into public.post_like_counts (
    post_id,
    likes_count
)
select
    p.id,
    count(pl.post_id)::bigint
from public.posts p
join public.post_likes pl
    on pl.post_id = p.id
group by p.id
on conflict (post_id)
do update
set likes_count = excluded.likes_count;


-- Remove stale aggregate rows.

delete from public.post_like_counts c
where not exists (
    select 1
    from public.post_likes pl
    where pl.post_id = c.post_id
);


-- RLS on aggregate table.

alter table public.post_like_counts enable row level security;


drop policy if exists post_like_counts_select_public
on public.post_like_counts;


create policy post_like_counts_select_public
on public.post_like_counts
for select
to anon, authenticated
using (true);


-- Only SELECT is exposed to application users.

revoke all
on table public.post_like_counts
from anon, authenticated;


grant select
on table public.post_like_counts
to anon, authenticated;


-- ============================================================
-- 2. FUNCTION TO KEEP POST COUNTS SYNCHRONIZED
-- ============================================================

create or replace function public.sync_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin

    if tg_op = 'INSERT' then

        insert into public.post_like_counts (
            post_id,
            likes_count
        )
        values (
            new.post_id,
            1
        )
        on conflict (post_id)
        do update
        set likes_count =
            public.post_like_counts.likes_count + 1;

        return new;

    elsif tg_op = 'DELETE' then

        update public.post_like_counts
        set likes_count =
            greatest(likes_count - 1, 0)
        where post_id = old.post_id;

        delete from public.post_like_counts
        where post_id = old.post_id
          and likes_count <= 0;

        return old;

    end if;

    return null;

end;
$$;


-- Prevent direct RPC execution by normal users.

revoke all
on function public.sync_post_like_count()
from public, anon, authenticated;


-- Replace any previous trigger with one synchronized trigger.

drop trigger if exists post_like_count_sync
on public.post_likes;


create trigger post_like_count_sync
after insert or delete
on public.post_likes
for each row
execute function public.sync_post_like_count();


-- ============================================================
-- 3. REEL LIKE COUNTS
-- ============================================================

do $$
begin
    if exists (
        select 1
        from pg_class c
        join pg_namespace n
          on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = 'reel_like_counts'
          and c.relkind = 'v'
    ) then
        execute 'drop view public.reel_like_counts cascade';
    end if;
end
$$;


create table if not exists public.reel_like_counts (
    reel_id bigint primary key
        references public.reels(id)
        on delete cascade,

    likes_count bigint not null default 0,

    constraint reel_like_counts_nonnegative
        check (likes_count >= 0)
);


-- Populate / repair existing reel counts.

insert into public.reel_like_counts (
    reel_id,
    likes_count
)
select
    r.id,
    count(rl.reel_id)::bigint
from public.reels r
join public.reel_likes rl
    on rl.reel_id = r.id
group by r.id
on conflict (reel_id)
do update
set likes_count = excluded.likes_count;


-- Remove stale aggregate rows.

delete from public.reel_like_counts c
where not exists (
    select 1
    from public.reel_likes rl
    where rl.reel_id = c.reel_id
);


-- RLS.

alter table public.reel_like_counts enable row level security;


drop policy if exists reel_like_counts_select_public
on public.reel_like_counts;


create policy reel_like_counts_select_public
on public.reel_like_counts
for select
to anon, authenticated
using (true);


-- Only SELECT for application users.

revoke all
on table public.reel_like_counts
from anon, authenticated;


grant select
on table public.reel_like_counts
to anon, authenticated;


-- ============================================================
-- 4. FUNCTION TO KEEP REEL COUNTS SYNCHRONIZED
-- ============================================================

create or replace function public.sync_reel_like_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin

    if tg_op = 'INSERT' then

        insert into public.reel_like_counts (
            reel_id,
            likes_count
        )
        values (
            new.reel_id,
            1
        )
        on conflict (reel_id)
        do update
        set likes_count =
            public.reel_like_counts.likes_count + 1;

        return new;

    elsif tg_op = 'DELETE' then

        update public.reel_like_counts
        set likes_count =
            greatest(likes_count - 1, 0)
        where reel_id = old.reel_id;

        delete from public.reel_like_counts
        where reel_id = old.reel_id
          and likes_count <= 0;

        return old;

    end if;

    return null;

end;
$$;


-- Prevent direct RPC execution.

revoke all
on function public.sync_reel_like_count()
from public, anon, authenticated;


-- Replace any previous trigger.

drop trigger if exists reel_like_count_sync
on public.reel_likes;


create trigger reel_like_count_sync
after insert or delete
on public.reel_likes
for each row
execute function public.sync_reel_like_count();


-- ============================================================
-- 5. FINAL GRANTS
-- ============================================================

grant select
on public.post_like_counts,
   public.reel_like_counts
to anon, authenticated;


commit;
