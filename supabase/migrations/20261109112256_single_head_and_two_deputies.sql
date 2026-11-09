-- Exactly one operational Head Admin and two delegated hands.
-- Initial configuration is NOT auto-assigned: 2 existing main-test Admin profiles
-- require the intended Head to explicitly claim the slot from Admin Management.
-- A confirmed Head claim reduces any other active Admin profiles to Staff
-- atomically, without touching records, events, or account approval.
create table if not exists public.upt_organization_leadership (
 slot text primary key check (slot in ('head','left_hand','right_hand')),
 user_id uuid not null unique references public.profiles(id) on delete restrict,
 assigned_by uuid not null references public.profiles(id) on delete restrict,
 assigned_at timestamptz not null default now(),
 managed_portal_grant boolean not null default false
);
create index if not exists upt_organization_leadership_assigned_by_idx
 on public.upt_organization_leadership(assigned_by);
alter table public.upt_organization_leadership enable row level security;
revoke all on public.upt_organization_leadership from public,anon,authenticated;
grant select on public.upt_organization_leadership to authenticated;
drop policy if exists upt_leadership_actor_read on public.upt_organization_leadership;
create policy upt_leadership_actor_read on public.upt_organization_leadership
 for select to authenticated
 using (public.upt_is_admin() or user_id=(select auth.uid()));

-- Once configured, prevent an ordinary Admin-profile edit from creating a
-- second Head or from deactivating the only Head.
create or replace function upt_private.guard_single_head_profile()
returns trigger language plpgsql security definer set search_path='pg_catalog' as $$
declare v_head uuid;
begin
 select user_id into v_head from public.upt_organization_leadership where slot='head';
 if v_head is null then return new; end if;
 if new.id=v_head and
   (new.role<>'admin' or not coalesce(new.approved,false) or coalesce(new.account_blocked,false))
 then
   raise exception 'Transfer Head Admin before deactivating the current Head'
   using errcode='23514';
 end if;
 if new.role='admin' and new.id<>v_head then
   raise exception 'Only the designated Head may have Admin role'
   using errcode='23514';
 end if;
 return new;
end;
$$;
revoke all on function upt_private.guard_single_head_profile() from public,anon,authenticated;
drop trigger if exists upt_single_head_profile_gate on public.profiles;
create trigger upt_single_head_profile_gate
 before insert or update of role,approved,account_blocked
 on public.profiles for each row execute function upt_private.guard_single_head_profile();

-- Explicit appointment interface: only an existing approved Admin can claim
-- the empty Head position for THEMSELVES. Afterwards only the current Head
-- (or the app's trusted Maker/Owner) may transfer or delegate.
-- Deputies get Administration portal access but NOT the permanent Admin role.
create or replace function public.upt_leadership_assign(p_slot text,p_user uuid)
returns jsonb language plpgsql security definer set search_path='pg_catalog' as $$
declare
 v_actor uuid:=auth.uid();
 v_head uuid;
 v_old_user uuid;
 v_old_grant boolean:=false;
 v_has_grant boolean:=false;
 v_new_managed boolean:=false;
begin
 if v_actor is null or p_slot not in ('head','left_hand','right_hand') then
  raise exception 'Invalid leadership request' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('uptilldawn-one-head-leadership'));
 select l.user_id into v_head from public.upt_organization_leadership l where l.slot='head' for update;
 if v_head is null then
   if p_slot<>'head' or p_user is distinct from v_actor or not public.upt_is_admin(v_actor)
   then raise exception 'The initial Head must claim their own existing Admin account' using errcode='42501'; end if;
 elsif v_actor<>v_head and not upt_private.is_app_owner(v_actor) then
   raise exception 'Only Head Admin may manage the leadership team' using errcode='42501';
 end if;
 if p_slot='head' and p_user is null then
   raise exception 'Transfer Head before removing it' using errcode='22023';
 end if;
 if p_user is not null and not exists (
   select 1 from public.profiles p where p.id=p_user and p.approved=true
   and not coalesce(p.account_blocked,false)
 ) then raise exception 'Select an approved, active account' using errcode='22023'; end if;
 if p_slot<>'head' and p_user=v_head then
   raise exception 'Head cannot also be a delegate' using errcode='22023'; end if;
 if p_slot='head' and exists (
  select 1 from public.upt_organization_leadership l where l.user_id=p_user and l.slot<>'head'
 ) then raise exception 'Reassign a deputy slot before Head transfer' using errcode='23505'; end if;

 select l.user_id,l.managed_portal_grant into v_old_user,v_old_grant
 from public.upt_organization_leadership l where l.slot=p_slot for update;

 if p_slot='head' then
   insert into public.upt_organization_leadership(slot,user_id,assigned_by)
    values('head',p_user,v_actor)
    on conflict(slot) do update set user_id=excluded.user_id,assigned_by=v_actor,assigned_at=now();
   -- SECURITY DEFINER runs with the same enforced profile audit triggers.
   -- Keep the acting Head an Admin until every other profile is updated.
   update public.profiles set role='admin' where id=p_user and role<>'admin';
   update public.profiles set role='staff'
    where role='admin' and id<>p_user and id<>v_actor;
   if v_actor<>p_user then
     update public.profiles set role='staff' where id=v_actor and role='admin';
   end if;
 else
   if p_user is not null and exists(
    select 1 from public.profiles where id=p_user and role='admin'
   ) then raise exception 'Deputies cannot retain full Admin role' using errcode='22023'; end if;
   if v_old_user is distinct from p_user and v_old_grant then
     update public.portal_role_assignments
     set approved=false,approved_by=null,approved_at=null,revoked_at=now()
     where user_id=v_old_user and portal='administration'
      and role='administrative_staff' and approved=true and revoked_at is null;
   end if;
   if p_user is null then
     delete from public.upt_organization_leadership where slot=p_slot;
   else
     select exists(select 1 from public.portal_role_assignments
       where user_id=p_user and portal='administration'
        and role='administrative_staff' and approved=true and revoked_at is null
     ) into v_has_grant;
     if not v_has_grant then
       perform public.upt_admin_set_portal_role(
         p_user,'administration','administrative_staff','assign_approved'
       );
       v_new_managed:=true;
     end if;
     insert into public.upt_organization_leadership
       (slot,user_id,assigned_by,managed_portal_grant)
     values(p_slot,p_user,v_actor,v_new_managed)
     on conflict(slot) do update
       set user_id=excluded.user_id,assigned_by=excluded.assigned_by,
           assigned_at=now(),
           managed_portal_grant=case
             when public.upt_organization_leadership.user_id=excluded.user_id
             then public.upt_organization_leadership.managed_portal_grant
             else excluded.managed_portal_grant end;
   end if;
 end if;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(v_actor,'ORGANIZATION_LEADERSHIP_CHANGED','leadership_slot',
   coalesce(p_user,v_old_user,v_actor),
   jsonb_build_object('slot',p_slot,'previous',v_old_user,'assigned',p_user));
 return jsonb_build_object('slot',p_slot,'userId',p_user,'headId',
   (select user_id from public.upt_organization_leadership where slot='head'));
end;
$$;
revoke all on function public.upt_leadership_assign(text,uuid) from public,anon,authenticated;
grant execute on function public.upt_leadership_assign(text,uuid) to authenticated;

-- The Head can review their OWN operational dossier; Administration cannot
-- give final approval. Existing status guards and rejection reasons remain.
create or replace function public.upt_guard_administration_obligation()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.id is distinct from old.id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at then
  raise exception 'Obligation identity and approval are immutable';
 end if;
 if (old.status not in ('open','rejected') or old.status<>new.status)
   and (new.title is distinct from old.title
    or new.kind is distinct from old.kind
    or new.event_id is distinct from old.event_id
    or new.details is distinct from old.details
    or new.due_at is distinct from old.due_at) then
  raise exception 'Submitted obligation content is immutable';
 end if;
 if new.status<>old.status then
  if not (
    (old.status in ('open','rejected') and new.status='submitted')
    or (old.status='submitted' and new.status in ('approved','rejected'))
    or (old.status='approved' and new.status='completed')
    or (old.status not in ('completed','cancelled') and new.status='cancelled')
  ) then
   raise exception 'Invalid obligation transition';
  end if;
  if new.status in ('approved','rejected','cancelled')
     and (auth.uid() is null or not public.upt_is_admin()) then
   raise exception 'Admin required' using errcode='42501';
  end if;
  if new.status='approved' then
   new.approved_by:=auth.uid();
   new.approved_at:=now();
  end if;
  if new.status='rejected' and length(btrim(new.review_note))<3 then
   raise exception 'Rejection reason required';
  end if;
 end if;
 if new.review_note is distinct from old.review_note
   and not (
    old.status='submitted' and new.status='rejected'
    and public.upt_is_admin()
   ) then
  raise exception 'Only Admin may record a rejection reason';
 end if;
 new.updated_at:=now();
 return new;
end;
$$;


-- With one Head, their own submitted dossier must also appear in the review notification queue.
create or replace function upt_administration_private.notify_obligation_review()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_route text;
begin
 if old.status is not distinct from new.status then return new; end if;
 -- The kind column is CHECK-constrained; route has no user-controlled path
 -- segments beyond this fixed set.
 if new.kind not in ('logistics','permits','tasks') then
  raise exception 'Unknown administration dossier kind';
 end if;
 v_route:='/portals/administration/modules/'||new.kind;
 if old.status in ('open','rejected') and new.status='submitted' then
  insert into public.crew_notifications(user_id,title,body,kind,link)
  select p.id,'Dossier wacht op goedkeuring',
         left('Controleer dossier: '||new.title,500),'info',v_route
  from public.profiles p
  where p.approved=true
    and coalesce(p.account_blocked,false)=false
    and (p.role='admin' or upt_private.is_app_owner(p.id));
 elsif old.status='submitted' and new.status in ('approved','rejected') then
  insert into public.crew_notifications(user_id,title,body,kind,link)
  values(new.created_by,
    case when new.status='approved' then 'Dossier goedgekeurd'
         else 'Dossier afgewezen' end,
    left(new.title,500),'info',v_route);
 elsif old.status='approved' and new.status='completed'
   and new.created_by is distinct from auth.uid() then
  insert into public.crew_notifications(user_id,title,body,kind,link)
  values(new.created_by,'Dossier afgehandeld',left(new.title,500),'info',v_route);
 end if;
 return new;
end;
$$;

