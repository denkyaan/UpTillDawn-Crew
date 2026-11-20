-- Explicit, atomic preparation of an approved artist agreement for signing.
-- SECURITY INVOKER is intentional: RLS is checked for the source version.
-- The ledger has no general INSERT privilege; only this validated RPC can insert.
create or replace function public.upt_prepare_artist_contract_signing(
 p_version_id uuid,
 p_version integer,
 p_source_sha256 text,
 p_recipient_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_id uuid;
begin
 if (select auth.uid()) is null or not public.upt_can_manage_administration() then
  raise exception 'Administration authorization required';
 end if;
 if p_version_id is null or p_version < 1
 or p_source_sha256 !~ '^[a-f0-9]{64}$'
 or length(trim(p_recipient_email)) not between 5 and 320
 or p_recipient_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
  raise exception 'Invalid signing request';
 end if;
 if not exists (
  select 1 from public.admin_artist_agreement_versions v
  where v.id=p_version_id and v.version_number=p_version
    and v.approved_at is not null
 ) then
  raise exception 'Approved agreement version required';
 end if;
 insert into public.administration_contract_signing_requests(
  document_type,document_id,document_version,document_sha256,recipient_email
 ) values (
  'artist',p_version_id,p_version,p_source_sha256,lower(trim(p_recipient_email))
 )
 on conflict (document_type,document_id,document_version) do nothing
 returning id into v_id;
 if v_id is null then
  select id into v_id from public.administration_contract_signing_requests
  where document_type='artist' and document_id=p_version_id
    and document_version=p_version and document_sha256=p_source_sha256
    and recipient_email=lower(trim(p_recipient_email));
 end if;
 if v_id is null then
  raise exception 'Signing preparation conflicts with existing version';
 end if;
 return v_id;
end;
$$;
revoke all on function public.upt_prepare_artist_contract_signing(uuid,integer,text,text) from public,anon;
grant execute on function public.upt_prepare_artist_contract_signing(uuid,integer,text,text) to authenticated;
comment on function public.upt_prepare_artist_contract_signing(uuid,integer,text,text) is
 'Create or retrieve one signing ledger record for a previously approved immutable artist agreement version.';
