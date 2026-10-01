create table if not exists public.timesheets (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'open' check(status in ('open','submitted','approved','rejected','locked')),
 submitted_at timestamptz, reviewed_at timestamptz, reviewed_by uuid references public.profiles(id) on delete set null,
 rejection_reason text, locked_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(event_id,user_id)
);
create index if not exists timesheets_event_status_idx on public.timesheets(event_id,status);
create index if not exists timesheets_user_id_idx on public.timesheets(user_id);
create index if not exists timesheets_reviewed_by_idx on public.timesheets(reviewed_by);
alter table public.timesheets enable row level security;
create policy timesheets_read on public.timesheets for select to authenticated using(user_id=auth.uid() or public.upt_is_admin(auth.uid()) or exists(select 1 from public.responsible_assignments ra where ra.event_id=timesheets.event_id and ra.user_id=auth.uid()));
revoke all on public.timesheets from anon,authenticated; grant select on public.timesheets to authenticated;

create or replace function public.upt_submit_timesheet(p_event uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.timesheets%rowtype;
begin
 if auth.uid() is null or not public.upt_is_approved() then raise exception 'Not authorized'; end if;
 if not exists(select 1 from public.event_members where event_id=p_event and user_id=auth.uid()) then raise exception 'Not an event member'; end if;
 insert into public.timesheets(event_id,user_id,status,submitted_at,updated_at) values(p_event,auth.uid(),'submitted',now(),now())
 on conflict(event_id,user_id) do update set status='submitted',submitted_at=now(),reviewed_at=null,reviewed_by=null,rejection_reason=null,locked_at=null,updated_at=now()
 where timesheets.status in ('open','rejected') returning * into v;
 if not found then raise exception 'Timesheet cannot be submitted from current status'; end if;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'TIMESHEET_SUBMITTED','timesheet',v.id,jsonb_build_object('event_id',p_event));
 return v.id;
end $$;
create or replace function public.upt_review_timesheet(p_timesheet uuid,p_approve boolean,p_reason text default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.timesheets%rowtype;
begin
 select * into v from public.timesheets where id=p_timesheet for update;
 if not found or v.status<>'submitted' then raise exception 'Timesheet is not submitted'; end if;
 if not (public.upt_is_admin(auth.uid()) or exists(select 1 from public.responsible_assignments ra where ra.event_id=v.event_id and ra.user_id=auth.uid())) then raise exception 'Not authorized'; end if;
 if v.user_id=auth.uid() then raise exception 'Cannot review own timesheet'; end if;
 if not p_approve and coalesce(length(trim(p_reason)),0)=0 then raise exception 'Rejection reason required'; end if;
 update public.timesheets set status=case when p_approve then 'approved' else 'rejected' end,reviewed_at=now(),reviewed_by=auth.uid(),rejection_reason=case when p_approve then null else trim(p_reason) end,updated_at=now() where id=p_timesheet;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),case when p_approve then 'TIMESHEET_APPROVED' else 'TIMESHEET_REJECTED' end,'timesheet',p_timesheet,jsonb_build_object('reason',p_reason));
end $$;
create or replace function public.upt_lock_timesheet(p_timesheet uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.timesheets%rowtype;
begin
 select * into v from public.timesheets where id=p_timesheet for update;
 if not found or v.status<>'approved' then raise exception 'Timesheet is not approved'; end if;
 if not public.upt_is_admin(auth.uid()) then raise exception 'Admin required'; end if;
 update public.timesheets set status='locked',locked_at=now(),updated_at=now() where id=p_timesheet;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),'TIMESHEET_LOCKED','timesheet',p_timesheet);
end $$;
revoke all on function public.upt_submit_timesheet(uuid) from public,anon;
revoke all on function public.upt_review_timesheet(uuid,boolean,text) from public,anon;
revoke all on function public.upt_lock_timesheet(uuid) from public,anon;
grant execute on function public.upt_submit_timesheet(uuid) to authenticated;
grant execute on function public.upt_review_timesheet(uuid,boolean,text) to authenticated;
grant execute on function public.upt_lock_timesheet(uuid) to authenticated;
