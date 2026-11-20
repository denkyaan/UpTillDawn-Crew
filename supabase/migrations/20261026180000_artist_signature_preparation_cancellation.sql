-- Cancellation is a controlled state transition, never a signature or delivery.
create or replace function public.upt_cancel_artist_signature_preparation(p_request_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
 v_changed integer;
begin
 if not public.upt_can_manage_administration() then
  raise exception 'Not authorized';
 end if;
 update public.admin_artist_agreement_signature_requests
 set status = 'cancelled', cancelled_at = now()
 where id = p_request_id and status = 'prepared';
 get diagnostics v_changed = row_count;
 return v_changed = 1;
end;
$$;
create policy artist_signature_requests_cancel on public.admin_artist_agreement_signature_requests
for update to authenticated
using (public.upt_can_manage_administration() and status = 'prepared')
with check (public.upt_can_manage_administration() and status = 'cancelled' and cancelled_at is not null);
grant update (status,cancelled_at) on public.admin_artist_agreement_signature_requests to authenticated;
grant execute on function public.upt_cancel_artist_signature_preparation(uuid) to authenticated;
create or replace function public.upt_guard_artist_signature_preparation_update()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.id is distinct from old.id or new.agreement_version_id is distinct from old.agreement_version_id
 or new.recipient_email is distinct from old.recipient_email or new.created_by is distinct from old.created_by
 or new.created_at is distinct from old.created_at or old.status <> 'prepared'
 or new.status <> 'cancelled' or new.cancelled_at is null then
  raise exception 'Signing preparation is immutable except cancellation';
 end if;
 return new;
end;
$$;
create trigger guard_artist_signature_preparation_update
before update on public.admin_artist_agreement_signature_requests
for each row execute function public.upt_guard_artist_signature_preparation_update();
