-- New-shift proposals within the existing draft -> review -> explicit Admin
-- application workflow. Existing "modify shift" proposals remain compatible.
alter table public.admin_roster_proposals
 add column if not exists plan_kind text not null default 'update';
alter table public.admin_roster_proposals
 add column if not exists planned_workplace_id uuid references public.workplaces(id) on delete set null;
alter table public.admin_roster_proposals
 add column if not exists planned_user_id uuid references public.profiles(id) on delete set null;
alter table public.admin_roster_proposals
 add column if not exists planned_role_name text;
alter table public.admin_roster_proposals
 add column if not exists planned_shift_kind text;
alter table public.admin_roster_proposals
 add column if not exists planned_overlap_allowed boolean not null default false;
alter table public.admin_roster_proposals
 add column if not exists created_shift_id uuid references public.shifts(id) on delete set null;

alter table public.admin_roster_proposals
 drop constraint if exists admin_roster_plan_kind_check;
alter table public.admin_roster_proposals
 add constraint admin_roster_plan_kind_check
 check(plan_kind in ('update','create'));
alter table public.admin_roster_proposals
 drop constraint if exists admin_roster_planned_role_check;
alter table public.admin_roster_proposals
 add constraint admin_roster_planned_role_check
 check(planned_role_name is null or length(trim(planned_role_name)) between 1 and 200);
alter table public.admin_roster_proposals
 drop constraint if exists admin_roster_planned_kind_check;
alter table public.admin_roster_proposals
 add constraint admin_roster_planned_kind_check
 check(planned_shift_kind is null or planned_shift_kind in ('event','setup','breakdown'));
create index if not exists admin_roster_planned_user_idx
 on public.admin_roster_proposals(planned_user_id) where planned_user_id is not null;
create index if not exists admin_roster_planned_workplace_idx
 on public.admin_roster_proposals(planned_workplace_id) where planned_workplace_id is not null;
create unique index if not exists admin_roster_created_shift_unique
 on public.admin_roster_proposals(created_shift_id) where created_shift_id is not null;

-- Structured, minimal shift creation candidates for Administration staff.
-- This is safer than granting the portal direct SELECT on every shift,
-- workplace, event membership and sensitive personnel profile.
create or replace function public.upt_admin_roster_staff_options()
returns table(event_id uuid,user_id uuid,full_name text)
language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then
  raise exception 'Administration authorization required' using errcode='42501';
 end if;
 return query
 select em.event_id,p.id,
   coalesce(nullif(trim(p.full_name),''),left(p.id::text,8))
 from public.event_members em join public.profiles p on p.id=em.user_id
 where p.approved=true and coalesce(p.account_blocked,false)=false
   and exists(select 1 from public.events e
     where e.id=em.event_id and e.end_at>now() and e.archived_at is null)
 order by em.event_id,p.full_name,p.id
 limit 1000;
end;
$$;
revoke all on function public.upt_admin_roster_staff_options() from public,anon;
grant execute on function public.upt_admin_roster_staff_options() to authenticated;

create or replace function public.upt_admin_roster_workplace_options()
returns table(event_id uuid,workplace_id uuid,name text)
language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then
  raise exception 'Administration authorization required' using errcode='42501';
 end if;
 return query
 select w.event_id,w.id,w.name
 from public.workplaces w
 join public.events e on e.id=w.event_id
 where w.is_active=true and e.end_at>now() and e.archived_at is null
 order by w.event_id,w.sort_order,w.name,w.id
 limit 1000;
end;
$$;
revoke all on function public.upt_admin_roster_workplace_options() from public,anon;
grant execute on function public.upt_admin_roster_workplace_options() to authenticated;

-- The creator can prepare a new shift without having the privileges to
-- create one. The Admin will later approve and execute it explicitly.
create or replace function public.upt_admin_roster_plan_new(
 p_id uuid,p_workplace uuid,p_user uuid,p_role_name text,
 p_shift_kind text default 'event',p_overlap_allowed boolean default false
) returns void language plpgsql security definer set search_path=''
as $$
declare
 v_plan public.admin_roster_proposals%rowtype;
 v_start timestamptz;
 v_end timestamptz;
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then
  raise exception 'Administration authorization required' using errcode='42501';
 end if;
 select * into v_plan from public.admin_roster_proposals where id=p_id for update;
 if not found or v_plan.status<>'draft'
   or (v_plan.created_by<>auth.uid() and not public.upt_is_admin())
   or v_plan.proposed_start<=now() then
  raise exception 'Only the author may prepare an open future roster' using errcode='22023';
 end if;
 if p_role_name is null or length(trim(p_role_name)) not between 1 and 200
   or p_shift_kind not in ('event','setup','breakdown')
   or p_overlap_allowed is null then
  raise exception 'Invalid new shift details' using errcode='22023';
 end if;
 select e.start_at,e.end_at into v_start,v_end
 from public.events e where e.id=v_plan.event_id and e.archived_at is null;
 if v_start is null
    or (p_shift_kind='event' and
      (v_plan.proposed_start<v_start or v_plan.proposed_end>v_end))
    or (p_shift_kind='setup' and
      (v_plan.proposed_start<v_start-interval '3 days' or v_plan.proposed_end>v_end))
    or (p_shift_kind='breakdown' and
      (v_plan.proposed_start<v_start or v_plan.proposed_end>v_end+interval '3 days')) then
  raise exception 'Proposed shift falls outside its event window' using errcode='22023';
 end if;
 if not exists(select 1 from public.workplaces w
    where w.id=p_workplace and w.event_id=v_plan.event_id and w.is_active=true) then
  raise exception 'Active workplace from same event required' using errcode='22023';
 end if;
 if not exists(select 1 from public.event_members em
    join public.profiles p on p.id=em.user_id
    where em.user_id=p_user and em.event_id=v_plan.event_id
      and p.approved=true and coalesce(p.account_blocked,false)=false) then
  raise exception 'Approved event member required' using errcode='22023';
 end if;

 update public.admin_roster_proposals
 set plan_kind='create',target_shift_id=null,
     planned_workplace_id=p_workplace,planned_user_id=p_user,
     planned_role_name=trim(p_role_name),planned_shift_kind=p_shift_kind,
     planned_overlap_allowed=p_overlap_allowed,created_shift_id=null,
     updated_at=now()
 where id=v_plan.id and status='draft';
end;
$$;
revoke all on function public.upt_admin_roster_plan_new(uuid,uuid,uuid,text,text,boolean)
 from public,anon;
grant execute on function public.upt_admin_roster_plan_new(uuid,uuid,uuid,text,text,boolean)
 to authenticated;

-- Selecting an existing target changes this proposal back to modification
-- mode, clearing any abandoned new-shift draft payload in one transaction.
create or replace function public.upt_admin_roster_target(p_id uuid,p_shift uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare
 v_plan public.admin_roster_proposals%rowtype;
 v_shift public.shifts%rowtype;
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then
  raise exception 'Administration authorization required' using errcode='42501';
 end if;
 select * into v_plan from public.admin_roster_proposals where id=p_id for update;
 if not found or v_plan.status<>'draft'
    or (v_plan.created_by<>auth.uid() and not public.upt_is_admin())
    or v_plan.proposed_start<=now() then
  raise exception 'Only a valid future draft can select a shift' using errcode='22023';
 end if;
 select * into v_shift from public.shifts where id=p_shift for update;
 if not found or v_shift.event_id<>v_plan.event_id
    or v_shift.status<>'scheduled'
    or v_shift.scheduled_start<=now() or v_shift.scheduled_end<=now()
    or exists(select 1 from public.work_sessions ws where ws.shift_id=v_shift.id) then
  raise exception 'Target must be an unworked future shift from this event' using errcode='22023';
 end if;
 update public.admin_roster_proposals
 set plan_kind='update',target_shift_id=v_shift.id,
     planned_workplace_id=null,planned_user_id=null,planned_role_name=null,
     planned_shift_kind=null,planned_overlap_allowed=false,
     created_shift_id=null,updated_at=now()
 where id=v_plan.id and status='draft';
end;
$$;
revoke all on function public.upt_admin_roster_target(uuid,uuid) from public,anon;
grant execute on function public.upt_admin_roster_target(uuid,uuid) to authenticated;

create or replace function public.upt_admin_roster_submit(p_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_plan public.admin_roster_proposals%rowtype;
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then
  raise exception 'Administration authorization required' using errcode='42501';
 end if;
 select * into v_plan from public.admin_roster_proposals where id=p_id for update;
 if not found or v_plan.status<>'draft'
    or (v_plan.created_by<>auth.uid() and not public.upt_is_admin())
    or v_plan.proposed_start<=now() then
  raise exception 'A future draft is required' using errcode='22023';
 end if;
 if v_plan.plan_kind='create' then
  if v_plan.planned_workplace_id is null or v_plan.planned_user_id is null
     or v_plan.planned_role_name is null or v_plan.planned_shift_kind is null
     or v_plan.target_shift_id is not null then
   raise exception 'Complete new-shift plan required' using errcode='22023';
  end if;
  if not exists(select 1 from public.workplaces w where w.id=v_plan.planned_workplace_id
    and w.event_id=v_plan.event_id and w.is_active=true)
   or not exists(select 1 from public.event_members em
    join public.profiles p on p.id=em.user_id
    where em.event_id=v_plan.event_id and em.user_id=v_plan.planned_user_id
      and p.approved and not coalesce(p.account_blocked,false)) then
    raise exception 'Planned staff or workplace is no longer available' using errcode='22023';
  end if;
  -- Preliminary concurrency/conflict check; canonical create rechecks when
  -- Admin applies. An approved plan never bypasses existing staff policies.
  if not v_plan.planned_overlap_allowed and exists(
   select 1 from public.shifts s where s.user_id=v_plan.planned_user_id
     and s.status<>'cancelled' and s.response_status<>'declined'
     and s.scheduled_start<v_plan.proposed_end
     and s.scheduled_end>v_plan.proposed_start
  ) then raise exception 'Planned shift overlaps another assignment' using errcode='22023'; end if;
  if upt_private.shift_capacity_would_exceed(
    v_plan.planned_workplace_id,v_plan.planned_user_id,
    v_plan.proposed_start,v_plan.proposed_end,null
  ) then raise exception 'Planned shift exceeds workplace capacity' using errcode='22023'; end if;
 else
  if v_plan.target_shift_id is null or not exists(
   select 1 from public.shifts s
   where s.id=v_plan.target_shift_id and s.event_id=v_plan.event_id
     and s.status='scheduled' and s.scheduled_start>now()
     and s.scheduled_end>now()
     and not exists(select 1 from public.work_sessions ws where ws.shift_id=s.id)
  ) then raise exception 'Target shift is no longer assignable' using errcode='22023'; end if;
 end if;

 update public.admin_roster_proposals
 set status='submitted',updated_at=now()
 where id=v_plan.id and status='draft';
end;
$$;
revoke all on function public.upt_admin_roster_submit(uuid) from public,anon;
grant execute on function public.upt_admin_roster_submit(uuid) to authenticated;

create or replace function public.upt_admin_roster_apply(p_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare
 v_plan public.admin_roster_proposals%rowtype;
 v_shift public.shifts%rowtype;
 v_new_shift uuid;
begin
 if auth.uid() is null or not public.upt_is_admin()
    or not public.upt_is_approved() then
  raise exception 'Admin authorization required' using errcode='42501';
 end if;
 select * into v_plan from public.admin_roster_proposals
 where id=p_id for update;
 if not found or v_plan.status<>'approved' or v_plan.applied_at is not null
    or v_plan.proposed_start<=now() then
  raise exception 'Approved, unapplied future roster required' using errcode='22023';
 end if;
 if v_plan.plan_kind='create' then
  if v_plan.planned_workplace_id is null or v_plan.planned_user_id is null
    or v_plan.planned_role_name is null or v_plan.planned_shift_kind is null
    or v_plan.target_shift_id is not null then
   raise exception 'Missing proposed new shift details' using errcode='22023';
  end if;
  -- Existing canonical Admin-only RPC checks event membership, event window,
  -- capacity, all user conflicts and logs the resulting shift notification.
  v_new_shift:=public.upt_create_shift(
   v_plan.planned_workplace_id,v_plan.planned_user_id,v_plan.planned_role_name,
   v_plan.proposed_start,v_plan.proposed_end,
   v_plan.planned_overlap_allowed,v_plan.planned_shift_kind
  );
  update public.admin_roster_proposals
  set created_shift_id=v_new_shift,applied_at=now(),
      applied_by=auth.uid(),updated_at=now()
  where id=v_plan.id and status='approved' and applied_at is null;
 else
  if v_plan.target_shift_id is null then
   raise exception 'Missing target shift' using errcode='22023';
  end if;
  select * into v_shift from public.shifts
   where id=v_plan.target_shift_id for update;
  if not found or v_shift.event_id<>v_plan.event_id
     or v_shift.status<>'scheduled' or v_shift.scheduled_start<=now()
     or v_shift.scheduled_end<=now()
     or exists(select 1 from public.work_sessions ws where ws.shift_id=v_shift.id) then
   raise exception 'Cannot change a started, completed or cancelled shift' using errcode='22023';
  end if;
  perform public.upt_update_shift(
    v_shift.id,v_shift.role_name,v_plan.proposed_start,v_plan.proposed_end,
    v_shift.overlap_allowed,v_shift.shift_kind
  );
  update public.admin_roster_proposals
  set applied_at=now(),applied_by=auth.uid(),updated_at=now()
  where id=v_plan.id and status='approved' and applied_at is null;
 end if;
 if not found then raise exception 'Roster was already applied' using errcode='23505'; end if;
end;
$$;
revoke all on function public.upt_admin_roster_apply(uuid) from public,anon;
grant execute on function public.upt_admin_roster_apply(uuid) to authenticated;
