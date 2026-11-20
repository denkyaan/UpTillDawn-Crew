-- God Mode security hardening.
-- Bind token sessions to the authenticated permanent app owner and retire the
-- anonymous password RPC path without changing the Maker Mode UX.

create or replace function upt_private.god_session_valid(p_token text)
returns boolean
language sql
security definer
set search_path='pg_catalog','public','upt_private','extensions'
as $$
  select auth.uid() is not null
    and upt_private.is_app_owner(auth.uid())
    and p_token is not null
    and length(p_token) between 32 and 256
    and exists(
      select 1
      from upt_private.god_mode_sessions s
      where s.token_hash=extensions.digest(p_token,'sha256')
        and s.expires_at>now()
    );
$$;

revoke all on function upt_private.god_session_valid(text) from public,anon,authenticated;

create or replace function public.upt_god_login(p_login text,p_password text)
returns text
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private','extensions'
as $$
declare
  v_login text;
  v_hash text;
  v_failed integer:=0;
  v_window timestamptz;
  v_locked timestamptz;
  v_token text;
begin
  if auth.uid() is null or not upt_private.is_app_owner(auth.uid()) then
    return null;
  end if;

  if p_login is null or p_password is null or length(p_login)>200 or length(p_password)>200 then
    return null;
  end if;

  select a.failed_attempts,a.window_started_at,a.locked_until
    into v_failed,v_window,v_locked
  from upt_private.god_mode_attempts a
  where singleton=true
  for update;

  if v_locked is not null and v_locked>now() then return null; end if;

  select lower(trim(c.login_name)),c.password_hash into v_login,v_hash
  from upt_private.god_mode_config c where singleton=true;

  if v_hash is not null
     and lower(trim(p_login))=v_login
     and extensions.crypt(p_password,v_hash)=v_hash then
    delete from upt_private.god_mode_sessions where expires_at<=now();
    v_token:=encode(extensions.gen_random_bytes(32),'hex');
    insert into upt_private.god_mode_sessions(token_hash,expires_at)
    values(extensions.digest(v_token,'sha256'),now()+interval '2 hours');
    delete from upt_private.god_mode_attempts where singleton=true;
    return v_token;
  end if;

  if v_window is null or v_window<now()-interval '15 minutes' then
    v_failed:=1;
    v_window:=now();
  else
    v_failed:=coalesce(v_failed,0)+1;
  end if;

  insert into upt_private.god_mode_attempts(singleton,failed_attempts,window_started_at,locked_until)
  values(true,v_failed,v_window,case when v_failed>=5 then now()+interval '15 minutes' else null end)
  on conflict(singleton) do update
  set failed_attempts=excluded.failed_attempts,
      window_started_at=excluded.window_started_at,
      locked_until=excluded.locked_until;
  return null;
end;
$$;

revoke all on function public.upt_god_login(text,text) from public,anon;
grant execute on function public.upt_god_login(text,text) to authenticated,service_role;

create or replace function public.upt_god_logout(p_token text)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private','extensions'
as $$
begin
  if not upt_private.god_session_valid(p_token) then return; end if;
  delete from upt_private.god_mode_sessions
  where token_hash=extensions.digest(p_token,'sha256');
end;
$$;

revoke all on function public.upt_god_logout(text) from public,anon;
grant execute on function public.upt_god_logout(text) to authenticated,service_role;

notify pgrst,'reload schema';
