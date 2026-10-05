-- Driver time split: one work session, alternating event/driving time with audited mileage.
create table if not exists public.driver_sessions(
 id uuid primary key default gen_random_uuid(),
 work_session_id uuid not null references public.work_sessions(id) on delete cascade,
 task_id uuid references public.tasks(id) on delete set null,
 user_id uuid not null references public.profiles(id) on delete cascade,
 event_id uuid not null references public.events(id) on delete cascade,
 started_at timestamptz not null default now(),
 ended_at timestamptz,
 start_latitude numeric,
 start_longitude numeric,
 end_latitude numeric,
 end_longitude numeric,
 expected_km numeric(10,2),
 actual_km numeric(10,2),
 created_at timestamptz not null default now()
);
create unique index if not exists driver_sessions_one_active_per_work_session on public.driver_sessions(work_session_id) where ended_at is null;
create index if not exists driver_sessions_user_event_idx on public.driver_sessions(user_id,event_id,started_at);

alter table public.driver_sessions enable row level security;
drop policy if exists driver_sessions_read on public.driver_sessions;
create policy driver_sessions_read on public.driver_sessions for select to authenticated using(
 user_id=auth.uid() or public.upt_is_admin(auth.uid()) or exists(
  select 1 from public.work_sessions ws
  join public.responsible_assignments ra on ra.event_id=ws.event_id
  join public.workplaces rw on rw.id=ra.workplace_id
  where ws.id=driver_sessions.work_session_id and ra.user_id=auth.uid() and lower(rw.name) like '%backstage%'
 )
);
grant select on public.driver_sessions to authenticated;
revoke insert,update,delete on public.driver_sessions from authenticated,anon;

create or replace function public.upt_start_driving(
 p_work_session uuid,p_task uuid default null,p_latitude numeric default null,p_longitude numeric default null,p_expected_km numeric default null
) returns uuid language plpgsql security definer set search_path='pg_catalog','public','upt_private' as $fn$
declare v_ws public.work_sessions%rowtype; v_id uuid;
begin
 select * into v_ws from public.work_sessions where id=p_work_session and user_id=auth.uid() and ended_at is null for update;
 if not found then raise exception 'Geen actieve werkregistratie.'; end if;
 if exists(select 1 from public.break_sessions where work_session_id=p_work_session and ended_at is null) then raise exception 'Stop eerst je pauze.'; end if;
 if not exists(select 1 from public.shifts s join public.workplaces w on w.id=s.workplace_id where s.id=v_ws.shift_id and lower(w.name)='driver') then raise exception 'Alleen een Driver-shift kan Driving starten.'; end if;
 if exists(select 1 from public.driver_sessions where work_session_id=p_work_session and ended_at is null) then raise exception 'Driving is al actief.'; end if;
 if p_task is not null and not exists(select 1 from public.task_assignments a join public.driver_task_details d on d.task_id=a.task_id where a.task_id=p_task and a.user_id=auth.uid()) then raise exception 'Deze rit is niet aan jou toegewezen.'; end if;
 insert into public.driver_sessions(work_session_id,task_id,user_id,event_id,start_latitude,start_longitude,expected_km)
 values(p_work_session,p_task,auth.uid(),v_ws.event_id,p_latitude,p_longitude,p_expected_km) returning id into v_id;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'START_DRIVING','driver_session',v_id,jsonb_build_object('work_session_id',p_work_session,'task_id',p_task,'expected_km',p_expected_km));
 return v_id;
end $fn$;

create or replace function public.upt_stop_driving(
 p_driver_session uuid,p_latitude numeric default null,p_longitude numeric default null,p_actual_km numeric default null
) returns void language plpgsql security definer set search_path='pg_catalog','public','upt_private' as $fn$
declare v_row public.driver_sessions%rowtype;
begin
 select * into v_row from public.driver_sessions where id=p_driver_session and user_id=auth.uid() and ended_at is null for update;
 if not found then raise exception 'Geen actieve Driving-registratie.'; end if;
 update public.driver_sessions set ended_at=now(),end_latitude=p_latitude,end_longitude=p_longitude,actual_km=coalesce(p_actual_km,expected_km) where id=p_driver_session;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'STOP_DRIVING','driver_session',p_driver_session,jsonb_build_object('work_session_id',v_row.work_session_id,'actual_km',coalesce(p_actual_km,v_row.expected_km)));
end $fn$;

revoke all on function public.upt_start_driving(uuid,uuid,numeric,numeric,numeric) from public,anon;
revoke all on function public.upt_stop_driving(uuid,numeric,numeric,numeric) from public,anon;
grant execute on function public.upt_start_driving(uuid,uuid,numeric,numeric,numeric) to authenticated;
grant execute on function public.upt_stop_driving(uuid,numeric,numeric,numeric) to authenticated;

create or replace function public.upt_driver_time_summary(p_work_session uuid)
returns table(event_seconds bigint,driving_seconds bigint,total_km numeric)
language sql stable security definer set search_path='pg_catalog','public','upt_private' as $fn$
 with ws as(select started_at,coalesce(ended_at,now()) ended_at from public.work_sessions where id=p_work_session and (user_id=auth.uid() or public.upt_is_admin(auth.uid()))),
 d as(select sum(extract(epoch from(coalesce(ds.ended_at,now())-ds.started_at))) drive,sum(coalesce(ds.actual_km,ds.expected_km,0)) km from public.driver_sessions ds where ds.work_session_id=p_work_session)
 select greatest(0,extract(epoch from(ws.ended_at-ws.started_at))-coalesce(d.drive,0))::bigint,coalesce(d.drive,0)::bigint,coalesce(d.km,0) from ws cross join d
$fn$;
grant execute on function public.upt_driver_time_summary(uuid) to authenticated;

-- Driver has no separate responsible lead: Backstage Management supervises Driver operationally.
create or replace function public.upt_is_driver_supervisor(p_event uuid,p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path='pg_catalog','public' as $fn$
 select public.upt_is_admin(p_uid) or exists(
  select 1 from public.responsible_assignments ra join public.workplaces w on w.id=ra.workplace_id
  where ra.event_id=p_event and ra.user_id=p_uid and lower(w.name) like '%backstage%'
 )
$fn$;
grant execute on function public.upt_is_driver_supervisor(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
