-- Approved roster proposals can be explicitly applied to one existing event shift.
alter table public.admin_roster_proposals add column if not exists target_shift_id uuid references public.shifts(id) on delete set null;
alter table public.admin_roster_proposals add column if not exists applied_at timestamptz;
alter table public.admin_roster_proposals add column if not exists applied_by uuid references auth.users(id);
create or replace function public.upt_admin_roster_apply(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_proposal public.admin_roster_proposals%rowtype;
declare v_shift public.shifts%rowtype;
begin
 if auth.uid() is null or not public.upt_is_admin() or not public.upt_is_approved() then
  raise exception 'Admin authorization required';
 end if;
 select * into v_proposal from public.admin_roster_proposals where id=p_id for update;
 if not found or v_proposal.status <> 'approved' or v_proposal.applied_at is not null or v_proposal.target_shift_id is null then
  raise exception 'Approved, unapplied proposal with target shift required';
 end if;
 select * into v_shift from public.shifts where id=v_proposal.target_shift_id for update;
 if not found or v_shift.event_id <> v_proposal.event_id then raise exception 'Shift event mismatch'; end if;
 if v_shift.user_id is not null and exists (
  select 1 from public.shifts other
  where other.user_id=v_shift.user_id and other.id<>v_shift.id
    and other.scheduled_start<v_proposal.proposed_end and other.scheduled_end>v_proposal.proposed_start
    and not coalesce(other.overlap_allowed,false) and not coalesce(v_shift.overlap_allowed,false)
 ) then raise exception 'Overlapping assigned shift'; end if;
 update public.shifts set scheduled_start=v_proposal.proposed_start,scheduled_end=v_proposal.proposed_end,updated_at=now()
 where id=v_shift.id;
 update public.admin_roster_proposals set applied_at=now(),applied_by=auth.uid(),updated_at=now()
 where id=v_proposal.id;
end $$;
revoke all on function public.upt_admin_roster_apply(uuid) from public,anon;
grant execute on function public.upt_admin_roster_apply(uuid) to authenticated;
