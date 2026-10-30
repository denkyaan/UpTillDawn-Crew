-- Final case review belongs to Admin, including an Admin-created case.
-- Existing contract and roster separation rules are unchanged.
alter table public.admin_operational_obligations drop constraint admin_operational_obligations_check1;

create or replace function public.upt_guard_administration_obligation()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.id is distinct from old.id or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at
 or new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at then raise exception 'Obligation identity and approval are immutable'; end if;
 if (old.status not in ('open','rejected') or old.status<>new.status) and (new.title is distinct from old.title or new.kind is distinct from old.kind or new.event_id is distinct from old.event_id or new.details is distinct from old.details or new.due_at is distinct from old.due_at) then raise exception 'Submitted obligation content is immutable'; end if;
 if new.status<>old.status then
  if not ((old.status in ('open','rejected') and new.status='submitted') or(old.status='submitted' and new.status in ('approved','rejected')) or(old.status='approved' and new.status='completed') or(old.status not in ('completed','cancelled') and new.status='cancelled')) then raise exception 'Invalid obligation transition'; end if;
  if new.status in ('approved','rejected','cancelled') and not public.upt_is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if new.status='approved' then
   new.approved_by:=auth.uid();new.approved_at:=now();
  end if;
  if new.status='rejected' and length(btrim(new.review_note))<3 then raise exception 'Rejection reason required'; end if;
 end if;
 if new.review_note is distinct from old.review_note and not(old.status='submitted' and new.status='rejected' and public.upt_is_admin()) then raise exception 'Only Admin may record a rejection reason'; end if;
 new.updated_at:=now();return new;
end $$;
revoke all on function public.upt_guard_administration_obligation() from public,anon,authenticated;
