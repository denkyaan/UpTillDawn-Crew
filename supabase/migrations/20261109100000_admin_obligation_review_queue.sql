-- Administration operational dossiers: a distinct Admin reviews submissions,
-- and each review transition notifies the correct actors atomically.
-- A draft's creator can be an Admin, but cannot approve/reject their own case.
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
  if old.status='submitted' and new.status in ('approved','rejected')
    and old.created_by=auth.uid() then
   raise exception 'The submitter cannot review their own dossier'
    using errcode='42501';
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
    and public.upt_is_admin() and old.created_by is distinct from auth.uid()
   ) then
  raise exception 'Only independent Admin may record a rejection reason';
 end if;
 new.updated_at:=now();
 return new;
end;
$$;

-- Notification insertions run with trusted trigger ownership and commit only
-- if the originating status transition commits. No external email is claimed.
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
  where p.id<>new.created_by and p.approved=true
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
revoke all on function upt_administration_private.notify_obligation_review()
 from public,anon,authenticated;
drop trigger if exists upt_admin_obligation_review_notify
 on public.admin_operational_obligations;
create trigger upt_admin_obligation_review_notify
after update of status on public.admin_operational_obligations
for each row execute function upt_administration_private.notify_obligation_review();

-- Index for the case-status review queue and stable due date pagination.
create index if not exists admin_operational_obligations_kind_status_due_idx
 on public.admin_operational_obligations(kind,status,due_at,id);
