-- End-to-end administrative roster lifecycle: assignable future shifts,
-- Admin approval and notifications. No event or existing shift data is mutated
-- by installing this migration.
--
-- start_time/end_time in public.shifts are NOT NULL scheduled mirror columns,
-- not recorded work-session timestamps. The historical roster apply function
-- treated their presence as "work already started" and rejected every shift.
-- Delegate to the canonical upt_update_shift RPC for all actual changes.

create or replace function public.upt_admin_roster_shift_options()
returns table(id uuid,event_id uuid,scheduled_start timestamptz,scheduled_end timestamptz)
language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then
  raise exception 'Administration authorization required' using errcode='42501';
 end if;
 return query
 select s.id,s.event_id,s.scheduled_start,s.scheduled_end
 from public.shifts s
 where s.status='scheduled'
   and s.scheduled_start>now()
   and s.scheduled_end>now()
   and not exists(select 1 from public.work_sessions ws where ws.shift_id=s.id)
 order by s.scheduled_start asc,s.id asc
 limit 1000;
end;
$$;
revoke all on function public.upt_admin_roster_shift_options() from public,anon;
grant execute on function public.upt_admin_roster_shift_options() to authenticated;

create or replace function public.upt_admin_roster_target(p_id uuid,p_shift uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare
 v_proposal public.admin_roster_proposals%rowtype;
 v_shift public.shifts%rowtype;
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then
  raise exception 'Administration authorization required' using errcode='42501';
 end if;
 select * into v_proposal from public.admin_roster_proposals
 where id=p_id for update;
 if not found or v_proposal.status<>'draft'
    or (v_proposal.created_by<>auth.uid() and not public.upt_is_admin())
    or v_proposal.proposed_start<=now() then
  raise exception 'Only a valid future draft can select a shift' using errcode='22023';
 end if;
 select * into v_shift from public.shifts where id=p_shift for update;
 if not found or v_shift.event_id<>v_proposal.event_id
    or v_shift.status<>'scheduled'
    or v_shift.scheduled_start<=now() or v_shift.scheduled_end<=now()
    or exists(select 1 from public.work_sessions ws where ws.shift_id=v_shift.id) then
  raise exception 'Target must be an unworked future shift from this event' using errcode='22023';
 end if;
 update public.admin_roster_proposals
 set target_shift_id=v_shift.id,updated_at=now()
 where id=v_proposal.id and status='draft';
end;
$$;
revoke all on function public.upt_admin_roster_target(uuid,uuid) from public,anon;
grant execute on function public.upt_admin_roster_target(uuid,uuid) to authenticated;

create or replace function public.upt_admin_roster_submit(p_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_proposal public.admin_roster_proposals%rowtype;
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then
  raise exception 'Administration authorization required' using errcode='42501';
 end if;
 select * into v_proposal from public.admin_roster_proposals
 where id=p_id for update;
 if not found or v_proposal.status<>'draft'
    or (v_proposal.created_by<>auth.uid() and not public.upt_is_admin())
    or v_proposal.target_shift_id is null
    or v_proposal.proposed_start<=now() then
  raise exception 'A future draft with an assigned shift is required' using errcode='22023';
 end if;
 if not exists (
  select 1 from public.shifts s
  where s.id=v_proposal.target_shift_id
    and s.event_id=v_proposal.event_id
    and s.status='scheduled'
    and s.scheduled_start>now() and s.scheduled_end>now()
    and not exists(select 1 from public.work_sessions ws where ws.shift_id=s.id)
 ) then
  raise exception 'Target shift is no longer assignable' using errcode='22023';
 end if;
 update public.admin_roster_proposals
 set status='submitted',updated_at=now()
 where id=v_proposal.id and status='draft';
end;
$$;
revoke all on function public.upt_admin_roster_submit(uuid) from public,anon;
grant execute on function public.upt_admin_roster_submit(uuid) to authenticated;

create or replace function public.upt_admin_roster_apply(p_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare
 v_proposal public.admin_roster_proposals%rowtype;
 v_shift public.shifts%rowtype;
begin
 if auth.uid() is null or not public.upt_is_admin()
    or not public.upt_is_approved() then
  raise exception 'Admin authorization required' using errcode='42501';
 end if;
 select * into v_proposal from public.admin_roster_proposals
 where id=p_id for update;
 if not found or v_proposal.status<>'approved'
    or v_proposal.applied_at is not null
    or v_proposal.target_shift_id is null then
  raise exception 'Approved, unapplied roster with a target shift required' using errcode='22023';
 end if;
 select * into v_shift from public.shifts
 where id=v_proposal.target_shift_id for update;
 if not found or v_shift.event_id<>v_proposal.event_id
    or v_shift.status<>'scheduled'
    or v_shift.scheduled_start<=now() or v_shift.scheduled_end<=now()
    or v_proposal.proposed_start<=now()
    or exists(select 1 from public.work_sessions ws where ws.shift_id=v_shift.id) then
  raise exception 'Cannot change a started, completed or cancelled shift' using errcode='22023';
 end if;

 -- Canonical shift mutation validates event windows, staffing capacity,
 -- overlapping assignments, the shift type and updates both scheduled
 -- time and legacy start_time/end_time mirrors. It also resets confirmation
 -- and triggers the existing assigned-worker notification and audit.
 perform public.upt_update_shift(
  v_shift.id,v_shift.role_name,
  v_proposal.proposed_start,v_proposal.proposed_end,
  v_shift.overlap_allowed,v_shift.shift_kind
 );

 update public.admin_roster_proposals
 set applied_at=now(),applied_by=auth.uid(),updated_at=now()
 where id=v_proposal.id and status='approved' and applied_at is null;
 if not found then
  raise exception 'Roster was already applied' using errcode='23505';
 end if;
end;
$$;
revoke all on function public.upt_admin_roster_apply(uuid) from public,anon;
grant execute on function public.upt_admin_roster_apply(uuid) to authenticated;

-- Notifications are coupled transactionally with the state transition:
-- failed proposals and failed shift applications never send misleading mail
-- or leave a visible notification. Existing shift-change trigger notifies the
-- assigned staff member separately; do not send that notification twice.
create or replace function upt_administration_private.notify_roster_lifecycle()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if old.status='draft' and new.status='submitted' then
  insert into public.crew_notifications(user_id,title,body,kind,link)
  select p.id,
    'Rooster wacht op goedkeuring',
    left('Controleer rooster: '||new.title,500),
    'info','/portals/administration/rosters'
  from public.profiles p
  where p.id<>new.created_by
    and p.approved=true and coalesce(p.account_blocked,false)=false
    and (p.role='admin' or upt_private.is_app_owner(p.id));
 elsif old.status='submitted' and new.status in ('approved','rejected') then
  insert into public.crew_notifications(user_id,title,body,kind,link)
  values(
   new.created_by,
   case when new.status='approved'
    then 'Rooster goedgekeurd' else 'Rooster afgewezen' end,
   left(new.title,500),
   'info','/portals/administration/rosters'
  );
 elsif old.applied_at is null and new.applied_at is not null
   and new.created_by is distinct from new.applied_by then
  insert into public.crew_notifications(user_id,title,body,kind,link)
  values(new.created_by,'Rooster toegepast',left(new.title,500),
         'info','/portals/administration/rosters');
 end if;
 return new;
end;
$$;
revoke all on function upt_administration_private.notify_roster_lifecycle()
 from public,anon,authenticated;
drop trigger if exists upt_admin_roster_lifecycle_notify
 on public.admin_roster_proposals;
create trigger upt_admin_roster_lifecycle_notify
after update of status,applied_at on public.admin_roster_proposals
for each row execute function
upt_administration_private.notify_roster_lifecycle();
