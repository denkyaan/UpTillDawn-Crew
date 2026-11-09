-- Refresh-token rotation is restricted to the active entrance workplace.
-- No browser or scan operator can read the master key or plaintext.
create table if not exists upt_private.weeztix_refresh_leases (
 slot smallint primary key default 1 check(slot=1),
 claim_id uuid not null,
 claimed_by uuid not null references public.profiles(id) on delete cascade,
 lease_expires_at timestamptz not null
);
alter table upt_private.weeztix_refresh_leases enable row level security;
revoke all on upt_private.weeztix_refresh_leases from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.upt_weeztix_claim_refresh(p_event_id uuid, p_workplace_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_permission jsonb;
 v_claim_id uuid := gen_random_uuid();
 v_acquired uuid;
begin
 v_permission:=public.upt_weeztix_scan_secrets(p_event_id,p_workplace_id);
 if v_permission->>'configured' <> 'true' then return null; end if;
 insert into upt_private.weeztix_refresh_leases (slot,claim_id,claimed_by,lease_expires_at)
 values(1,v_claim_id,auth.uid(),now()+interval '22 seconds')
 on conflict(slot) do update
  set claim_id=excluded.claim_id,claimed_by=excluded.claimed_by,
      lease_expires_at=excluded.lease_expires_at
  where upt_private.weeztix_refresh_leases.lease_expires_at <= now()
 returning claim_id into v_acquired;
 return v_acquired;
end
$function$
;
revoke all on function public.upt_weeztix_claim_refresh(uuid,uuid) from public,anon,authenticated;
grant execute on function public.upt_weeztix_claim_refresh(uuid,uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.upt_weeztix_commit_refresh(p_event_id uuid, p_workplace_id uuid, p_claim_id uuid, p_previous_ciphertext text, p_new_ciphertext text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_permission jsonb;
 v_rows integer;
begin
 v_permission:=public.upt_weeztix_scan_secrets(p_event_id,p_workplace_id);
 if v_permission->>'configured' <> 'true' then return false; end if;
 if p_previous_ciphertext is null or length(p_previous_ciphertext)<32
   or p_new_ciphertext is null or length(p_new_ciphertext) not between 32 and 16000
   or p_new_ciphertext !~ '^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$'
 then return false; end if;

 -- Lock the lease row before touching credentials: only the claimant may
 -- rotate, never after expiry, and never if Admin updated the connection.
 perform 1 from upt_private.weeztix_refresh_leases l
 where l.slot=1 and l.claim_id=p_claim_id and l.claimed_by=auth.uid()
   and l.lease_expires_at>now() for update;
 if not found then return false; end if;

 update upt_private.integration_connections c
 set encrypted_credentials=p_new_ciphertext,updated_at=now(),updated_by=auth.uid()
 where c.provider='weeztix' and c.encrypted_credentials=p_previous_ciphertext;
 get diagnostics v_rows=row_count;
 if v_rows<>1 then return false; end if;

 insert into upt_private.integration_connection_audit(provider,action,actor_id)
 values('weeztix','updated',auth.uid());
 delete from upt_private.weeztix_refresh_leases l
 where l.slot=1 and l.claim_id=p_claim_id;
 return true;
end
$function$
;
revoke all on function public.upt_weeztix_commit_refresh(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.upt_weeztix_commit_refresh(uuid,uuid,uuid,text,text) to authenticated;

CREATE OR REPLACE FUNCTION public.upt_weeztix_release_refresh(p_event_id uuid, p_workplace_id uuid, p_claim_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_permission jsonb;
 v_rows integer;
begin
 v_permission:=public.upt_weeztix_scan_secrets(p_event_id,p_workplace_id);
 if v_permission->>'configured' <> 'true' then return false; end if;
 delete from upt_private.weeztix_refresh_leases l
 where l.slot=1 and l.claim_id=p_claim_id and l.claimed_by=auth.uid();
 get diagnostics v_rows=row_count;
 return v_rows=1;
end
$function$
;
revoke all on function public.upt_weeztix_release_refresh(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.upt_weeztix_release_refresh(uuid,uuid,uuid) to authenticated;
