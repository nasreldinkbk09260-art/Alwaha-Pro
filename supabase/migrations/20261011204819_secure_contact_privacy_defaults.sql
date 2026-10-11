-- Privacy defaults and safe contact visibility for Alwaha-Pro.
begin;
alter table public.users alter column hide_email set default true;
alter table public.users alter column hide_phone set default true;
update public.users set hide_email=true, hide_phone=true, updated_at=now()
where hide_email is distinct from true or hide_phone is distinct from true;

create or replace view public.user_directory as
select id,first_name,last_name,
  case when auth.uid()=id or public.is_admin() then identifier else null::text end as identifier,
  case when auth.uid()=id or public.is_admin() then phone else null::text end as phone,
  avatar_url,is_verified,created_at,gender
from public.users;
revoke all privileges on public.user_directory from public,anon,authenticated;
grant select on public.user_directory to anon,authenticated;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  configured_admin_email text;
  metadata_birthdate text;
  metadata_phone text;
begin
  select value into configured_admin_email from public.app_settings where key='initial_admin_email' limit 1;
  metadata_birthdate:=nullif(new.raw_user_meta_data->>'birthdate','');
  metadata_phone:=nullif(new.raw_user_meta_data->>'phone','');
  insert into public.users(id,first_name,last_name,identifier,phone,gender,birthdate,avatar_url,hide_email,hide_phone,is_admin)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name',''),
    coalesce(new.raw_user_meta_data->>'last_name',''),
    lower(coalesce(new.email,new.phone,new.id::text)),
    coalesce(metadata_phone,new.phone,''),
    case when coalesce(new.raw_user_meta_data->>'gender','ذكر') in ('ذكر','أنثى') then coalesce(new.raw_user_meta_data->>'gender','ذكر') else 'ذكر' end,
    case when metadata_birthdate is not null then metadata_birthdate::date else null end,
    nullif(new.raw_user_meta_data->>'avatar_url',''),
    coalesce((new.raw_user_meta_data->>'hide_email')::boolean,true),
    coalesce((new.raw_user_meta_data->>'hide_phone')::boolean,true),
    lower(coalesce(configured_admin_email,''))<>'' and lower(configured_admin_email)=lower(coalesce(new.email,''))
  )
  on conflict(id) do update set
    identifier=excluded.identifier,
    phone=case when nullif(excluded.phone,'') is not null then excluded.phone else public.users.phone end,
    is_admin=public.users.is_admin or excluded.is_admin,
    updated_at=now();
  return new;
end;
$function$;
commit;
