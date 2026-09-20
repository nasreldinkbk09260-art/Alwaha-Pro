-- Alwaha-Pro 2.8.2 — production Supabase migration
-- Auth + RLS + Storage + Realtime + posts + likes + reels + chat + friends + notifications + verification + games.
--
-- This migration is upgrade-aware:
-- 1) If public.users is the old bigint/password table, legacy app tables are renamed
--    with a timestamp suffix and a new Auth/RLS schema is created.
-- 2) If public.users is already UUID-linked to auth.users (from the previous Alwaha-Pro
--    Auth/RLS migration), the current data is kept and the new capabilities are added.
--
-- Passwords are never stored in public.users. Supabase Auth owns credentials.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '180s';

-- -----------------------------------------------------------------------------
-- 1) Detect the old custom-password schema and archive it only when necessary.
-- -----------------------------------------------------------------------------
do $$
declare
    t text;
    suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISS');
    legacy_names text[] := array[
        'game_scores','reels','notifications','verification_requests',
        'friend_requests','messages','comments','products','posts','users'
    ];
    users_is_auth_uuid boolean := false;
begin
    select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'users'
          and column_name = 'id'
          and udt_name = 'uuid'
    ) into users_is_auth_uuid;

    if not users_is_auth_uuid then
        foreach t in array legacy_names loop
            if to_regclass('public.' || t) is not null then
                execute format('alter table public.%I rename to %I', t, t || '_legacy_' || suffix);
            end if;
        end loop;
    end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2) Remove only Alwaha-Pro objects we own so this migration can upgrade the
--    previous 2.8.x Auth/RLS schema without copying or exposing old rows.
-- -----------------------------------------------------------------------------
drop view if exists public.user_directory cascade;
drop view if exists public.post_like_counts cascade;
drop view if exists public.reel_like_counts cascade;

drop function if exists public.is_admin() cascade;
drop function if exists public.handle_new_auth_user() cascade;
drop function if exists public.handle_auth_user_update() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.notify_on_message() cascade;
drop function if exists public.notify_on_friend_request() cascade;
drop function if exists public.notify_on_comment() cascade;
drop function if exists public.notify_on_like() cascade;
drop function if exists public.handle_verification_status() cascade;

-- -----------------------------------------------------------------------------
-- 3) Private app configuration used only by server-side trigger functions.
--    It has no API grants/RLS access for normal clients.
-- -----------------------------------------------------------------------------
create table if not exists public.app_settings (
    key text primary key,
    value text not null,
    updated_at timestamptz not null default now()
);
revoke all on table public.app_settings from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4) Auth profile table. Existing modern rows are preserved.
-- -----------------------------------------------------------------------------
create table if not exists public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    first_name text not null default '',
    last_name text not null default '',
    identifier text not null unique,
    phone text not null default '',
    gender text not null default 'ذكر',
    birthdate date,
    avatar_url text,
    is_verified boolean not null default false,
    is_admin boolean not null default false,
    hide_email boolean not null default false,
    hide_phone boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.users add column if not exists first_name text not null default '';
alter table public.users add column if not exists last_name text not null default '';
alter table public.users add column if not exists identifier text;
alter table public.users add column if not exists phone text not null default '';
alter table public.users add column if not exists gender text not null default 'ذكر';
alter table public.users add column if not exists birthdate date;
alter table public.users add column if not exists avatar_url text;
alter table public.users add column if not exists is_verified boolean not null default false;
alter table public.users add column if not exists is_admin boolean not null default false;
alter table public.users add column if not exists hide_email boolean not null default false;
alter table public.users add column if not exists hide_phone boolean not null default true;
alter table public.users add column if not exists created_at timestamptz not null default now();
alter table public.users add column if not exists updated_at timestamptz not null default now();

-- Ensure the profile identifier is populated and unique for the Auth users.
update public.users u
set identifier = lower(coalesce(au.email, au.phone, au.id::text))
from auth.users au
where u.id = au.id
  and nullif(trim(coalesce(u.identifier,'')),'') is null;

create unique index if not exists users_identifier_unique_idx on public.users(identifier);
create index if not exists users_phone_idx on public.users(phone);
create index if not exists users_created_at_idx on public.users(created_at desc);

-- -----------------------------------------------------------------------------
-- 5) Home posts + persistent likes.
-- -----------------------------------------------------------------------------
create table if not exists public.posts (
    id bigint generated by default as identity primary key,
    author_id uuid references auth.users(id) on delete set null,
    author_name text not null default 'مستخدم',
    content text not null,
    post_type text not null default 'عام',
    image_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
alter table public.posts add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.posts add column if not exists author_name text not null default 'مستخدم';
alter table public.posts add column if not exists content text not null default '';
alter table public.posts add column if not exists post_type text not null default 'عام';
alter table public.posts add column if not exists image_url text;
alter table public.posts add column if not exists created_at timestamptz not null default now();
alter table public.posts add column if not exists updated_at timestamptz not null default now();
create index if not exists posts_author_id_idx on public.posts(author_id);
create index if not exists posts_created_at_idx on public.posts(created_at desc);

create table if not exists public.post_likes (
    post_id bigint not null references public.posts(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (post_id, user_id)
);
create index if not exists post_likes_user_idx on public.post_likes(user_id);

create view public.post_like_counts as
select post_id, count(*)::bigint as likes_count
from public.post_likes
group by post_id;

-- -----------------------------------------------------------------------------
-- 6) Marketplace. image_urls keeps the multiple-image upload button functional.
-- -----------------------------------------------------------------------------
create table if not exists public.products (
    id bigint generated by default as identity primary key,
    seller_id uuid references auth.users(id) on delete set null,
    title text not null,
    price text not null,
    category text not null default 'أخرى',
    description text not null,
    image_url text,
    image_urls jsonb not null default '[]'::jsonb,
    seller_email text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
alter table public.products add column if not exists seller_id uuid references auth.users(id) on delete set null;
alter table public.products add column if not exists title text not null default '';
alter table public.products add column if not exists price text not null default '';
alter table public.products add column if not exists category text not null default 'أخرى';
alter table public.products add column if not exists description text not null default '';
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists image_urls jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists seller_email text not null default '';
alter table public.products add column if not exists created_at timestamptz not null default now();
alter table public.products add column if not exists updated_at timestamptz not null default now();
update public.products set image_urls = jsonb_build_array(image_url) where jsonb_typeof(image_urls) = 'array' and jsonb_array_length(image_urls) = 0 and nullif(image_url,'') is not null;
create index if not exists products_seller_id_idx on public.products(seller_id);
create index if not exists products_created_at_idx on public.products(created_at desc);
create index if not exists products_category_idx on public.products(category);

-- -----------------------------------------------------------------------------
-- 7) Comments, Reels and Reel likes.
-- -----------------------------------------------------------------------------
create table if not exists public.comments (
    id bigint generated by default as identity primary key,
    target_id text not null,
    target_type text not null default 'post',
    user_id uuid not null references auth.users(id) on delete cascade,
    author_name text not null default 'مستخدم',
    content text not null,
    created_at timestamptz not null default now()
);
alter table public.comments add column if not exists target_id text;
alter table public.comments add column if not exists target_type text not null default 'post';
alter table public.comments add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.comments add column if not exists author_name text not null default 'مستخدم';
alter table public.comments add column if not exists content text not null default '';
alter table public.comments add column if not exists created_at timestamptz not null default now();
create index if not exists comments_target_idx on public.comments(target_type, target_id, created_at asc);
create index if not exists comments_user_id_idx on public.comments(user_id);

create table if not exists public.reels (
    id bigint generated by default as identity primary key,
    author_id uuid references auth.users(id) on delete set null,
    title text not null default 'ريلز جديد',
    author_name text not null default 'مستخدم',
    media_url text,
    likes_count bigint not null default 0,
    comments_count bigint not null default 0,
    created_at timestamptz not null default now()
);
alter table public.reels add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.reels add column if not exists title text not null default 'ريلز جديد';
alter table public.reels add column if not exists author_name text not null default 'مستخدم';
alter table public.reels add column if not exists media_url text;
alter table public.reels add column if not exists likes_count bigint not null default 0;
alter table public.reels add column if not exists comments_count bigint not null default 0;
alter table public.reels add column if not exists created_at timestamptz not null default now();
create index if not exists reels_author_id_idx on public.reels(author_id);
create index if not exists reels_created_at_idx on public.reels(created_at desc);

create table if not exists public.reel_likes (
    reel_id bigint not null references public.reels(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (reel_id, user_id)
);
create index if not exists reel_likes_user_idx on public.reel_likes(user_id);

create view public.reel_like_counts as
select reel_id, count(*)::bigint as likes_count
from public.reel_likes
group by reel_id;

-- -----------------------------------------------------------------------------
-- 8) Chat, friends, notifications, verification and game scores.
-- -----------------------------------------------------------------------------
create table if not exists public.messages (
    id bigint generated by default as identity primary key,
    sender_id uuid not null references auth.users(id) on delete cascade,
    receiver_id uuid not null references auth.users(id) on delete cascade,
    message text not null,
    created_at timestamptz not null default now(),
    read_at timestamptz,
    constraint messages_not_self check (sender_id <> receiver_id)
);
create index if not exists messages_sender_receiver_idx on public.messages(sender_id, receiver_id, created_at desc);
create index if not exists messages_receiver_sender_idx on public.messages(receiver_id, sender_id, created_at desc);

create table if not exists public.friend_requests (
    id bigint generated by default as identity primary key,
    requester_id uuid not null references auth.users(id) on delete cascade,
    target_id uuid not null references auth.users(id) on delete cascade,
    status text not null default 'pending',
    created_at timestamptz not null default now(),
    unique(requester_id, target_id),
    constraint friend_requests_not_self check (requester_id <> target_id)
);
alter table public.friend_requests add column if not exists requester_id uuid references auth.users(id) on delete cascade;
alter table public.friend_requests add column if not exists target_id uuid references auth.users(id) on delete cascade;
alter table public.friend_requests add column if not exists status text not null default 'pending';
alter table public.friend_requests add column if not exists created_at timestamptz not null default now();
create index if not exists friend_requests_target_idx on public.friend_requests(target_id, status, created_at desc);

create table if not exists public.notifications (
    id bigint generated by default as identity primary key,
    recipient_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    body text,
    type text not null default 'info',
    is_read boolean not null default false,
    created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on public.notifications(recipient_id, created_at desc);

create table if not exists public.verification_requests (
    id bigint generated by default as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    reason text not null,
    status text not null default 'pending',
    created_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by uuid references auth.users(id) on delete set null
);
alter table public.verification_requests add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.verification_requests add column if not exists reason text not null default '';
alter table public.verification_requests add column if not exists status text not null default 'pending';
alter table public.verification_requests add column if not exists created_at timestamptz not null default now();
alter table public.verification_requests add column if not exists reviewed_at timestamptz;
alter table public.verification_requests add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
create index if not exists verification_requests_user_idx on public.verification_requests(user_id, created_at desc);
create index if not exists verification_requests_status_idx on public.verification_requests(status, created_at desc);
create unique index if not exists verification_one_pending_per_user_idx on public.verification_requests(user_id) where status = 'pending';

create table if not exists public.game_scores (
    id bigint generated by default as identity primary key,
    user_id uuid references auth.users(id) on delete cascade,
    game_id text not null,
    score bigint not null default 0,
    created_at timestamptz not null default now()
);
create index if not exists game_scores_user_idx on public.game_scores(user_id, game_id, created_at desc);
create index if not exists game_scores_game_idx on public.game_scores(game_id, score desc);

-- -----------------------------------------------------------------------------
-- 9) Timestamp helper and admin helper.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users for each row execute function public.set_updated_at();
drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at before update on public.posts for each row execute function public.set_updated_at();
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (
        select 1 from public.users
        where id = auth.uid() and is_admin = true
    );
$$;

-- -----------------------------------------------------------------------------
-- 10) Auth triggers. Credentials stay in auth.users; profile fields stay here.
--     initial_admin_email is private and is populated by GitHub Actions when the
--     optional ALWAHA_ADMIN_EMAIL secret is configured.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    configured_admin_email text;
begin
    select value into configured_admin_email
    from public.app_settings
    where key = 'initial_admin_email'
    limit 1;

    insert into public.users (
        id, first_name, last_name, identifier, phone, gender, birthdate,
        avatar_url, hide_email, hide_phone, is_admin
    ) values (
        new.id,
        coalesce(new.raw_user_meta_data->>'first_name',''),
        coalesce(new.raw_user_meta_data->>'last_name',''),
        lower(coalesce(new.email, new.phone, new.id::text)),
        coalesce(new.phone,''),
        case when coalesce(new.raw_user_meta_data->>'gender','ذكر') in ('ذكر','أنثى')
             then coalesce(new.raw_user_meta_data->>'gender','ذكر') else 'ذكر' end,
        case
            when coalesce(new.raw_user_meta_data->>'birthdate','') <> ''
            then (new.raw_user_meta_data->>'birthdate')::date
            else null
        end,
        nullif(new.raw_user_meta_data->>'avatar_url',''),
        coalesce((new.raw_user_meta_data->>'hide_email')::boolean,false),
        coalesce((new.raw_user_meta_data->>'hide_phone')::boolean,true),
        lower(coalesce(configured_admin_email,'')) <> ''
            and lower(configured_admin_email) = lower(coalesce(new.email,''))
    )
    on conflict (id) do update set
        identifier = excluded.identifier,
        phone = excluded.phone,
        is_admin = public.users.is_admin or excluded.is_admin,
        updated_at = now();
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.handle_auth_user_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    configured_admin_email text;
begin
    select value into configured_admin_email from public.app_settings where key='initial_admin_email' limit 1;
    update public.users
       set identifier = lower(coalesce(new.email, new.phone, new.id::text)),
           phone = coalesce(new.phone,''),
           is_admin = is_admin or (lower(coalesce(configured_admin_email,'')) <> '' and lower(configured_admin_email)=lower(coalesce(new.email,''))),
           updated_at = now()
     where id = new.id;
    return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of email, phone on auth.users
for each row execute function public.handle_auth_user_update();

-- -----------------------------------------------------------------------------
-- 11) Safe user directory view. Only selected profile fields are exposed.
-- -----------------------------------------------------------------------------
drop view if exists public.user_directory cascade;
create view public.user_directory as
select
    id,
    first_name,
    last_name,
    case when hide_email then null else identifier end as identifier,
    case when hide_phone then null else phone end as phone,
    avatar_url,
    is_verified,
    created_at
from public.users;

-- -----------------------------------------------------------------------------
-- 12) Server-side notifications.
-- -----------------------------------------------------------------------------
create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    insert into public.notifications(recipient_id, title, body, type)
    values (
        new.receiver_id,
        'رسالة جديدة',
        jsonb_build_object('message_id', new.id, 'sender_id', new.sender_id)::text,
        'message'
    );
    return new;
end;
$$;

drop trigger if exists messages_notify_trigger on public.messages;
create trigger messages_notify_trigger after insert on public.messages for each row execute function public.notify_on_message();

create or replace function public.notify_on_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    requester_name text;
begin
    select trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) into requester_name
    from public.users where id = new.requester_id;
    insert into public.notifications(recipient_id, title, body, type)
    values (
        new.target_id,
        'طلب صداقة جديد',
        jsonb_build_object('friend_request_id', new.id, 'requester_id', new.requester_id, 'requester_name', coalesce(requester_name,'مستخدم'))::text,
        'friend_request'
    );
    return new;
end;
$$;

drop trigger if exists friend_requests_notify_trigger on public.friend_requests;
create trigger friend_requests_notify_trigger after insert on public.friend_requests for each row execute function public.notify_on_friend_request();

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    owner_id uuid;
    target_num bigint;
begin
    if new.target_id ~ '^[0-9]+$' then
        target_num := new.target_id::bigint;
        if new.target_type = 'post' then
            select author_id into owner_id from public.posts where id = target_num;
        elsif new.target_type = 'reel' then
            select author_id into owner_id from public.reels where id = target_num;
        end if;
    end if;

    if owner_id is not null and owner_id <> new.user_id then
        insert into public.notifications(recipient_id, title, body, type)
        values (
            owner_id,
            'تعليق جديد',
            jsonb_build_object('target_type', new.target_type, 'target_id', new.target_id, 'comment_id', new.id, 'author_name', new.author_name)::text,
            'comment'
        );
    end if;
    return new;
end;
$$;

drop trigger if exists comments_notify_trigger on public.comments;
create trigger comments_notify_trigger after insert on public.comments for each row execute function public.notify_on_comment();

create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    owner_id uuid;
    liked_name text;
    like_target bigint;
begin
    select trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) into liked_name
    from public.users where id = new.user_id;

    if TG_TABLE_NAME = 'post_likes' then
        like_target := new.post_id;
        select author_id into owner_id from public.posts where id = like_target;
        if owner_id is not null and owner_id <> new.user_id then
            insert into public.notifications(recipient_id, title, body, type)
            values(owner_id, 'إعجاب جديد بمنشورك', jsonb_build_object('post_id', like_target, 'user_id', new.user_id, 'user_name', coalesce(liked_name,'مستخدم'))::text, 'like');
        end if;
    else
        like_target := new.reel_id;
        select author_id into owner_id from public.reels where id = like_target;
        if owner_id is not null and owner_id <> new.user_id then
            insert into public.notifications(recipient_id, title, body, type)
            values(owner_id, 'إعجاب جديد بالريلز', jsonb_build_object('reel_id', like_target, 'user_id', new.user_id, 'user_name', coalesce(liked_name,'مستخدم'))::text, 'like');
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists post_likes_notify_trigger on public.post_likes;
create trigger post_likes_notify_trigger after insert on public.post_likes for each row execute function public.notify_on_like();
drop trigger if exists reel_likes_notify_trigger on public.reel_likes;
create trigger reel_likes_notify_trigger after insert on public.reel_likes for each row execute function public.notify_on_like();

create or replace function public.handle_verification_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if new.status = 'approved' and old.status is distinct from 'approved' then
        update public.users set is_verified = true, updated_at = now() where id = new.user_id;
        insert into public.notifications(recipient_id, title, body, type)
        values(new.user_id, 'تم توثيق حسابك', 'تمت الموافقة على طلب التوثيق.', 'verification');
    elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
        insert into public.notifications(recipient_id, title, body, type)
        values(new.user_id, 'تم رفض طلب التوثيق', coalesce(new.reason,'راجع الطلب مع الإدارة.'), 'verification');
    end if;
    return new;
end;
$$;

drop trigger if exists verification_status_trigger on public.verification_requests;
create trigger verification_status_trigger after update of status on public.verification_requests for each row execute function public.handle_verification_status();

-- -----------------------------------------------------------------------------
-- 13) Storage bucket and policies. Files are stored under <auth-user-id>/<folder>/...
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media','media',true,52428800,array['image/*','video/*'])
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists media_objects_insert_own on storage.objects;
drop policy if exists media_objects_update_own on storage.objects;
drop policy if exists media_objects_delete_own on storage.objects;
create policy media_objects_insert_own on storage.objects
for insert to authenticated
with check (bucket_id='media' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy media_objects_update_own on storage.objects
for update to authenticated
using (bucket_id='media' and (storage.foldername(name))[1]=(select auth.uid()::text))
with check (bucket_id='media' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy media_objects_delete_own on storage.objects
for delete to authenticated
using (bucket_id='media' and (storage.foldername(name))[1]=(select auth.uid()::text));

-- -----------------------------------------------------------------------------
-- 14) RLS and grants. Client updates to public.users cannot touch is_admin/is_verified.
-- -----------------------------------------------------------------------------
revoke all on table public.users from anon, authenticated;
revoke all on table public.posts from anon, authenticated;
revoke all on table public.post_likes from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.comments from anon, authenticated;
revoke all on table public.reels from anon, authenticated;
revoke all on table public.reel_likes from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on table public.friend_requests from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;
revoke all on table public.verification_requests from anon, authenticated;
revoke all on table public.game_scores from anon, authenticated;

alter table public.users enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.products enable row level security;
alter table public.comments enable row level security;
alter table public.reels enable row level security;
alter table public.reel_likes enable row level security;
alter table public.messages enable row level security;
alter table public.friend_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.verification_requests enable row level security;
alter table public.game_scores enable row level security;

-- Drop policies owned by this migration before recreating them.
do $$
declare
    r record;
begin
    for r in select schemaname, tablename, policyname
             from pg_policies
             where schemaname in ('public','storage')
               and policyname in (
                 'users_select_own','users_update_own','users_delete_own',
                 'posts_select_public','posts_insert_own','posts_update_own','posts_delete_own',
                 'post_likes_select_own','post_likes_insert_own','post_likes_delete_own',
                 'products_select_public','products_insert_own','products_update_own','products_delete_own',
                 'comments_select_public','comments_insert_own','comments_update_own','comments_delete_own',
                 'reels_select_public','reels_insert_own','reels_update_own','reels_delete_own',
                 'reel_likes_select_own','reel_likes_insert_own','reel_likes_delete_own',
                 'messages_select_participant','messages_insert_sender','messages_update_receiver','messages_delete_sender',
                 'friend_requests_select_participant','friend_requests_insert_requester','friend_requests_update_target','friend_requests_update_requester','friend_requests_delete_requester',
                 'notifications_select_own','notifications_update_own',
                 'verification_insert_own','verification_select_own_or_admin','verification_update_admin',
                 'game_scores_select_public','game_scores_insert_own','game_scores_update_own','game_scores_delete_own'
               )
    loop
        execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    end loop;
end $$;

-- Users: own profile; update only safe columns through explicit grants below.
create policy users_select_own on public.users for select to authenticated using ((select auth.uid())=id);
create policy users_update_own on public.users for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy users_delete_own on public.users for delete to authenticated using ((select auth.uid())=id);

-- Public feed/market/comments/reels reads.
create policy posts_select_public on public.posts for select to anon, authenticated using (true);
create policy posts_insert_own on public.posts for insert to authenticated with check ((select auth.uid())=author_id);
create policy posts_update_own on public.posts for update to authenticated using ((select auth.uid())=author_id) with check ((select auth.uid())=author_id);
create policy posts_delete_own on public.posts for delete to authenticated using ((select auth.uid())=author_id);

create policy post_likes_select_own on public.post_likes for select to authenticated using ((select auth.uid())=user_id);
create policy post_likes_insert_own on public.post_likes for insert to authenticated with check ((select auth.uid())=user_id);
create policy post_likes_delete_own on public.post_likes for delete to authenticated using ((select auth.uid())=user_id);

create policy products_select_public on public.products for select to anon, authenticated using (true);
create policy products_insert_own on public.products for insert to authenticated with check ((select auth.uid())=seller_id);
create policy products_update_own on public.products for update to authenticated using ((select auth.uid())=seller_id) with check ((select auth.uid())=seller_id);
create policy products_delete_own on public.products for delete to authenticated using ((select auth.uid())=seller_id);

create policy comments_select_public on public.comments for select to anon, authenticated using (true);
create policy comments_insert_own on public.comments for insert to authenticated with check ((select auth.uid())=user_id);
create policy comments_update_own on public.comments for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy comments_delete_own on public.comments for delete to authenticated using ((select auth.uid())=user_id);

create policy reels_select_public on public.reels for select to anon, authenticated using (true);
create policy reels_insert_own on public.reels for insert to authenticated with check ((select auth.uid())=author_id);
create policy reels_update_own on public.reels for update to authenticated using ((select auth.uid())=author_id) with check ((select auth.uid())=author_id);
create policy reels_delete_own on public.reels for delete to authenticated using ((select auth.uid())=author_id);

create policy reel_likes_select_own on public.reel_likes for select to authenticated using ((select auth.uid())=user_id);
create policy reel_likes_insert_own on public.reel_likes for insert to authenticated with check ((select auth.uid())=user_id);
create policy reel_likes_delete_own on public.reel_likes for delete to authenticated using ((select auth.uid())=user_id);

create policy messages_select_participant on public.messages for select to authenticated using ((select auth.uid())=sender_id or (select auth.uid())=receiver_id);
create policy messages_insert_sender on public.messages for insert to authenticated with check ((select auth.uid())=sender_id);
create policy messages_update_receiver on public.messages for update to authenticated using ((select auth.uid())=receiver_id) with check ((select auth.uid())=receiver_id);
create policy messages_delete_sender on public.messages for delete to authenticated using ((select auth.uid())=sender_id);

create policy friend_requests_select_participant on public.friend_requests for select to authenticated using ((select auth.uid())=requester_id or (select auth.uid())=target_id);
create policy friend_requests_insert_requester on public.friend_requests for insert to authenticated with check ((select auth.uid())=requester_id and requester_id<>target_id and status='pending');
create policy friend_requests_update_target on public.friend_requests for update to authenticated using ((select auth.uid())=target_id) with check ((select auth.uid())=target_id and status in ('accepted','rejected'));
create policy friend_requests_update_requester on public.friend_requests for update to authenticated using ((select auth.uid())=requester_id) with check ((select auth.uid())=requester_id and status='cancelled');
create policy friend_requests_delete_requester on public.friend_requests for delete to authenticated using ((select auth.uid())=requester_id);

create policy notifications_select_own on public.notifications for select to authenticated using ((select auth.uid())=recipient_id);
create policy notifications_update_own on public.notifications for update to authenticated using ((select auth.uid())=recipient_id) with check ((select auth.uid())=recipient_id);

create policy verification_insert_own on public.verification_requests for insert to authenticated with check ((select auth.uid())=user_id);
create policy verification_select_own_or_admin on public.verification_requests for select to authenticated using ((select auth.uid())=user_id or public.is_admin());
create policy verification_update_admin on public.verification_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy game_scores_select_public on public.game_scores for select to anon, authenticated using (true);
create policy game_scores_insert_own on public.game_scores for insert to authenticated with check ((select auth.uid())=user_id);
create policy game_scores_update_own on public.game_scores for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy game_scores_delete_own on public.game_scores for delete to authenticated using ((select auth.uid())=user_id);

-- Explicit grants. User profile admin/verification flags are intentionally excluded from client UPDATE grants.
grant select on public.posts, public.products, public.comments, public.reels, public.game_scores to anon, authenticated;
grant select on public.post_like_counts, public.reel_like_counts to anon, authenticated;

grant select on public.users to authenticated;
grant update (first_name,last_name,phone,gender,birthdate,avatar_url,hide_email,hide_phone) on public.users to authenticated;
grant delete on public.users to authenticated;

grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, delete on public.post_likes to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.comments to authenticated;
grant select, insert, update, delete on public.reels to authenticated;
grant select, insert, delete on public.reel_likes to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.friend_requests to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert, update on public.verification_requests to authenticated;
grant select, insert, update, delete on public.game_scores to authenticated;
grant select on public.user_directory to authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- -----------------------------------------------------------------------------
-- 15) Realtime publication.
-- -----------------------------------------------------------------------------
do $$
begin
    begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.comments; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.friend_requests; exception when duplicate_object then null; end;
end $$;

-- -----------------------------------------------------------------------------
-- 16) Backfill/repair Auth profiles, preserving compatible legacy profile data.
-- -----------------------------------------------------------------------------
insert into public.users (
    id, first_name, last_name, identifier, phone, gender, birthdate, avatar_url, hide_email, hide_phone, is_admin
)
select
    au.id,
    coalesce(au.raw_user_meta_data->>'first_name',''),
    coalesce(au.raw_user_meta_data->>'last_name',''),
    lower(coalesce(au.email, au.phone, au.id::text)),
    coalesce(au.phone,''),
    case when coalesce(au.raw_user_meta_data->>'gender','ذكر') in ('ذكر','أنثى') then coalesce(au.raw_user_meta_data->>'gender','ذكر') else 'ذكر' end,
    case when coalesce(au.raw_user_meta_data->>'birthdate','') <> '' then (au.raw_user_meta_data->>'birthdate')::date else null end,
    nullif(au.raw_user_meta_data->>'avatar_url',''),
    coalesce((au.raw_user_meta_data->>'hide_email')::boolean,false),
    coalesce((au.raw_user_meta_data->>'hide_phone')::boolean,true),
    exists(select 1 from public.app_settings s where s.key='initial_admin_email' and lower(s.value)=lower(coalesce(au.email,'')))
from auth.users au
where au.email is not null or au.phone is not null
on conflict (id) do update set
    identifier = excluded.identifier,
    phone = excluded.phone,
    is_admin = public.users.is_admin or excluded.is_admin;

-- Repair any rows that still have no identifier (possible only from hand-created legacy rows).
update public.users
set identifier = lower(id::text)
where nullif(trim(coalesce(identifier,'')),'') is null;

-- Optional legacy profile restoration for Auth users that already existed before this migration.
do $$
declare
    legacy_users_table text;
    latest_products_table text;
begin
    select table_name into legacy_users_table
    from information_schema.tables
    where table_schema='public' and table_name like 'users_legacy_%'
    order by table_name desc limit 1;

    if legacy_users_table is not null then
        execute format($q$
            update public.users u
               set first_name = coalesce(nullif(l.first_name,''),u.first_name),
                   last_name = coalesce(nullif(l.last_name,''),u.last_name),
                   phone = coalesce(nullif(l.phone,''),u.phone),
                   gender = case when l.gender in ('ذكر','أنثى') then l.gender else u.gender end,
                   birthdate = coalesce(l.birthdate,u.birthdate),
                   avatar_url = coalesce(nullif(l.avatar_url,''),u.avatar_url),
                   is_verified = u.is_verified or coalesce(l.is_verified,false),
                   hide_email = coalesce(l.hide_email,u.hide_email),
                   hide_phone = coalesce(l.hide_phone,u.hide_phone),
                   updated_at = now()
            from auth.users au
            join public.%I l on lower(coalesce(au.email,''))=lower(coalesce(l.identifier,'')) or (nullif(au.phone,'') is not null and au.phone=l.identifier)
            where u.id=au.id
        $q$, legacy_users_table);
    end if;

    select table_name into latest_products_table
    from information_schema.tables
    where table_schema='public' and table_name like 'products_legacy_%'
    order by table_name desc limit 1;

    if latest_products_table is not null then
        execute format($q$
            insert into public.products (seller_id,title,price,category,description,image_url,seller_email,created_at,updated_at)
            select u.id,p.title,p.price,coalesce(p.category,'أخرى'),p.description,p.image_url,coalesce(p.seller_email,''),coalesce(p.created_at,now()),coalesce(p.updated_at,now())
            from public.%I p
            left join public.users u on lower(u.identifier)=lower(coalesce(p.seller_email,''))
            where p.title is not null
              and not exists (
                  select 1 from public.products x
                  where x.title=p.title and x.seller_email=coalesce(p.seller_email,'')
              )
        $q$, latest_products_table);
    end if;
end $$;

-- Update admin state after a GitHub Action sets initial_admin_email.
update public.users u
set is_admin = true, updated_at = now()
where exists (
    select 1 from public.app_settings s
    where s.key='initial_admin_email'
      and lower(s.value)=lower(u.identifier)
);

commit;
