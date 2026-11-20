-- Presence is derived only from authenticated heartbeats, never inferred from account approval.
create table if not exists upt_private.crew_presence (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 last_seen_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table upt_private.crew_presence enable row level security;
revoke all on upt_private.crew_presence from public,anon,authenticated;

create or replace function public.upt_promotion_presence_ping()
returns void language plpgsql security definer
set search_path='pg_catalog','public','upt_private'
as $$
begin
 if auth.uid() is null or not public.upt_is_approved() then
   raise exception 'Geen toegang.';
 end if;
 insert into upt_private.crew_presence(user_id,last_seen_at,updated_at)
 values(auth.uid(),now(),now())
 on conflict(user_id) do update set last_seen_at=now(),updated_at=now();
end;
$$;

create or replace function public.upt_promotion_presence()
returns table(user_id uuid,last_seen_at timestamptz)
language sql stable security definer
set search_path=''
as $$
 select p.user_id,p.last_seen_at from upt_private.crew_presence p
 where exists(
  select 1 from public.upt_promotion_directory() d where d.id=p.user_id
 );
$$;
revoke all on function public.upt_promotion_presence_ping() from public,anon;
revoke all on function public.upt_promotion_presence() from public,anon;
grant execute on function public.upt_promotion_presence_ping() to authenticated;
grant execute on function public.upt_promotion_presence() to authenticated;
notify pgrst,'reload schema';
