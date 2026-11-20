-- Main-test integration credentials: encrypted with a Worker-held AES-256-GCM key.
-- The encryption key is never stored in Postgres and is never available to browsers.
-- A single organization's admin and administrative staff share these connections.
create table if not exists upt_private.integration_connections (
 provider text primary key check (provider in ('sumup','documenso','banking','weeztix','peppol')),
 encrypted_credentials text not null check (char_length(encrypted_credentials) between 32 and 16000 and encrypted_credentials like 'v1:%'),
 updated_at timestamptz not null default now(),
 updated_by uuid references public.profiles(id) on delete set null
);
alter table upt_private.integration_connections enable row level security;
revoke all on upt_private.integration_connections from public, anon, authenticated;

create table if not exists upt_private.integration_connection_audit (
 id bigint generated always as identity primary key,
 provider text not null check (provider in ('sumup','documenso','banking','weeztix','peppol')),
 action text not null check (action in ('connected','updated','disconnected')),
 actor_id uuid references public.profiles(id) on delete set null,
 occurred_at timestamptz not null default now()
);
alter table upt_private.integration_connection_audit enable row level security;
revoke all on upt_private.integration_connection_audit from public, anon, authenticated;
create index if not exists integration_connection_audit_recent_idx on upt_private.integration_connection_audit (occurred_at desc);

-- Executable by authenticated clients only, with a second independent
-- database-side account/role/revocation check on every operation.
-- Plaintext secrets are never returned or persisted in Postgres.
create or replace function public.upt_integration_credentials(
 p_action text, p_provider text default null, p_ciphertext text default null
) returns jsonb language plpgsql security definer
set search_path = ''
as $$
declare
 v_actor uuid := auth.uid();
 v_old text;
 v_result jsonb;
begin
 if v_actor is null
    or not exists (
      select 1 from public.profiles p
      where p.id=v_actor and p.approved=true and coalesce(p.account_blocked,false)=false
    )
    or not public.upt_can_manage_administration()
 then
   raise exception 'integration_permission_denied' using errcode='42501';
 end if;

 if p_action = 'list' then
   select coalesce(jsonb_agg(jsonb_build_object(
     'provider', c.provider,
     'updated_at', c.updated_at,
     'updated_by', c.updated_by
   ) order by c.provider),'[]'::jsonb)
   into v_result
   from upt_private.integration_connections c;
   return v_result;
 end if;

 if p_provider is null or p_provider not in ('sumup','documenso','banking','weeztix','peppol') then
   raise exception 'integration_invalid_provider' using errcode='22023';
 end if;

 if p_action='read' then
   select c.encrypted_credentials into v_old
   from upt_private.integration_connections c where c.provider=p_provider;
   if v_old is null then return jsonb_build_object('configured',false); end if;
   return jsonb_build_object('configured',true,'ciphertext',v_old);
 end if;

 if p_action='save' then
   if p_ciphertext is null or char_length(p_ciphertext) not between 32 and 16000
      or p_ciphertext !~ '^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$'
   then
     raise exception 'integration_invalid_ciphertext' using errcode='22023';
   end if;
   select c.encrypted_credentials into v_old
   from upt_private.integration_connections c where c.provider=p_provider;
   insert into upt_private.integration_connections(provider,encrypted_credentials,updated_at,updated_by)
   values(p_provider,p_ciphertext,now(),v_actor)
   on conflict(provider) do update
    set encrypted_credentials=excluded.encrypted_credentials,updated_at=now(),updated_by=v_actor;
   insert into upt_private.integration_connection_audit(provider,action,actor_id)
   values(p_provider,case when v_old is null then 'connected' else 'updated' end,v_actor);
   return jsonb_build_object('configured',true);
 end if;

 if p_action='disconnect' then
   delete from upt_private.integration_connections c
   where c.provider=p_provider returning c.encrypted_credentials into v_old;
   if v_old is not null then
     insert into upt_private.integration_connection_audit(provider,action,actor_id)
     values(p_provider,'disconnected',v_actor);
   end if;
   return jsonb_build_object('configured',false);
 end if;
 raise exception 'integration_invalid_action' using errcode='22023';
end
$$;
revoke all on function public.upt_integration_credentials(text,text,text) from public,anon,authenticated;
grant execute on function public.upt_integration_credentials(text,text,text) to authenticated;
