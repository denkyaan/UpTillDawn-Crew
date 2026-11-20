-- Prevent direct updates that change contract identity, envelope ownership,
-- or illegally advance terminal signing states. This guard runs even when
-- a future policy grants additional UPDATE permissions.
create or replace function public.upt_guard_contract_signing_update()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.id is distinct from old.id
 or new.document_type is distinct from old.document_type
 or new.document_id is distinct from old.document_id
 or new.document_version is distinct from old.document_version
 or new.document_sha256 is distinct from old.document_sha256
 or new.recipient_email is distinct from old.recipient_email
 or new.created_at is distinct from old.created_at then
  raise exception 'Signing contract identity is immutable';
 end if;
 if old.envelope_id is not null and new.envelope_id is distinct from old.envelope_id then
  raise exception 'Signing envelope identity is immutable';
 end if;
 if old.envelope_id is null and new.envelope_id is not null and old.status <> 'draft' then
  raise exception 'Envelope attachment requires draft state';
 end if;
 if new.status is distinct from old.status and not (
  (old.status='draft' and new.status in ('sent','completed','rejected','cancelled'))
  or (old.status='sent' and new.status in ('completed','rejected','cancelled'))
 ) then
  raise exception 'Invalid signing state transition';
 end if;
 if new.status <> 'draft' and new.envelope_id is null then
  raise exception 'Signing envelope required';
 end if;
 if old.completed_at is not null and new.completed_at is distinct from old.completed_at then
  raise exception 'Completion timestamp is immutable';
 end if;
 if new.status='completed' and new.completed_at is null then
  raise exception 'Completed signing requires timestamp';
 end if;
 if new.signed_pdf_path is distinct from old.signed_pdf_path and (
  old.signed_pdf_path is not null or new.status <> 'completed'
  or new.signed_pdf_path !~ ('^' || new.document_type || '/' ||
   new.document_id::text || '/v' || new.document_version::text ||
   '/signed-[a-f0-9]{64}\\.pdf$')
 ) then
  raise exception 'Invalid signed archive path';
 end if;
 new.updated_at=now();
 return new;
end;
$$;
revoke all on function public.upt_guard_contract_signing_update() from public;
drop trigger if exists guard_contract_signing_update on public.administration_contract_signing_requests;
create trigger guard_contract_signing_update
before update on public.administration_contract_signing_requests
for each row execute function public.upt_guard_contract_signing_update();
