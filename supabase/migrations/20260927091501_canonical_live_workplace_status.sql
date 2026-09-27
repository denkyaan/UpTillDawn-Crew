create or replace function upt_private.current_session_workplace(p_work_session uuid)
returns uuid
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  select coalesce(
    (
      select wt.to_workplace_id
      from public.workplace_transitions wt
      where wt.work_session_id=p_work_session
      order by wt.confirmed_at desc,wt.id desc
      limit 1
    ),
    (
      select s.workplace_id
      from public.work_sessions ws
      join public.shifts s on s.id=ws.shift_id
      where ws.id=p_work_session
    )
  );
$$;

revoke all on function upt_private.current_session_workplace(uuid)
from public,anon,authenticated;

create or replace function public.upt_staff_workplace_live_status()
returns table(
  session_id uuid,
  user_id uuid,
  full_name text,
  workplace_id uuid,
  workplace_name text,
  status text
)
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  with own_workplaces as (
    select distinct s.event_id,s.workplace_id
    from public.shifts s
    join public.events e on e.id=s.event_id
    where s.user_id=auth.uid()
      and (s.status is null or s.status <> 'cancelled'::shift_status)
      and (s.response_status is null or s.response_status <> 'declined')
      and e.status<>'archived'
      and now() between e.start_at and e.end_at
  ),
  active_sessions as (
    select
      ws.id,
      ws.user_id,
      ws.event_id,
      upt_private.current_session_workplace(ws.id) as workplace_id
    from public.work_sessions ws
    where ws.ended_at is null
  )
  select
    a.id as session_id,
    a.user_id,
    p.full_name,
    a.workplace_id,
    w.name as workplace_name,
    case when exists(
      select 1
      from public.break_sessions bs
      where bs.work_session_id=a.id
        and bs.ended_at is null
    ) then 'PAUZE' else 'WERKT' end as status
  from active_sessions a
  join own_workplaces ow
    on ow.event_id=a.event_id
   and ow.workplace_id=a.workplace_id
  join public.profiles p
    on p.id=a.user_id
   and p.approved=true
  join public.workplaces w
    on w.id=a.workplace_id
  where auth.uid() is not null
    and public.upt_is_approved()
    and public.upt_effective_role(auth.uid()) in ('employee','staff')
    and a.user_id<>auth.uid()
  order by w.name,p.full_name,a.id;
$$;

revoke all on function public.upt_staff_workplace_live_status() from public,anon;
grant execute on function public.upt_staff_workplace_live_status() to authenticated;

create or replace function public.upt_manager_live_sessions()
returns table(
  session_id uuid,
  user_id uuid,
  event_id uuid,
  shift_id uuid,
  workplace_id uuid,
  workplace_name text,
  started_at timestamptz
)
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  with active_sessions as (
    select
      ws.id as session_id,
      ws.user_id,
      ws.event_id,
      ws.shift_id,
      ws.started_at,
      upt_private.current_session_workplace(ws.id) as workplace_id
    from public.work_sessions ws
    where ws.ended_at is null
  )
  select
    a.session_id,
    a.user_id,
    a.event_id,
    a.shift_id,
    a.workplace_id,
    w.name as workplace_name,
    a.started_at
  from active_sessions a
  join public.workplaces w on w.id=a.workplace_id
  where public.upt_is_approved()
    and (
      public.upt_is_admin(auth.uid())
      or public.upt_is_responsible(a.event_id,a.workplace_id,auth.uid())
    )
  order by w.name,a.started_at,a.session_id;
$$;

revoke all on function public.upt_manager_live_sessions() from public,anon;
grant execute on function public.upt_manager_live_sessions() to authenticated;
