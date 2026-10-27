-- Server-only compare-and-swap for remote-verified signing state.
-- The caller must verify Documenso evidence independently before invoking.
-- No browser role may execute this function or update the ledger directly.
create or replace function public.upt_server_transition_contract_signing(
 p_envelope_id text,
 p_expected_status text,
 p_next_status text
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare v_changed integer;
begin
 if current_user <> 'service_role' then
  raise exception 'Server role required' using errcode = '42501';
 end if;
 if p_envelope_id is null or p_envelope_id !~ '^[A-Za-z0-9_-]{1,128}$' then
  raise exception 'Invalid signing envelope';
 end if;
 if not (
  (p_expected_status = 'draft' and p_next_status in ('sent','completed','rejected','cancelled'))
  or (p_expected_status = 'sent' and p_next_status in ('completed','rejected','cancelled'))
 ) then
  raise exception 'Invalid signing state transition';
 end if;
 update public.administration_contract_signing_requests
 set status = p_next_status,
     updated_at = now(),
     dispatched_at = case when p_next_status = 'sent' then now() else dispatched_at end,
     completed_at = case when p_next_status = 'completed' then now() else completed_at end
 where envelope_id = p_envelope_id
   and status = p_expected_status
   and signed_pdf_path is null;
 get diagnostics v_changed = row_count;
 return v_changed = 1;
end;
$$;

revoke all on function public.upt_server_transition_contract_signing(text,text,text)
 from public, anon, authenticated;
grant execute on function public.upt_server_transition_contract_signing(text,text,text)
 to service_role;
comment on function public.upt_server_transition_contract_signing(text,text,text)
 is 'Server-role-only CAS. Caller must independently verify remote signature evidence.';
