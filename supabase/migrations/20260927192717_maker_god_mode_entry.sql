create or replace function public.upt_god_login_owner()
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, upt_private, extensions
as $$
declare
  v_token text;
begin
  if auth.uid() is null or not upt_private.is_app_owner(auth.uid()) then
    raise exception 'Alleen de maker kan God Mode openen.';
  end if;

  delete from upt_private.god_mode_sessions where expires_at <= now();
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into upt_private.god_mode_sessions(token_hash, expires_at)
  values (extensions.digest(v_token, 'sha256'), now() + interval '2 hours');

  return v_token;
end;
$$;

revoke all on function public.upt_god_login_owner() from public, anon;
grant execute on function public.upt_god_login_owner() to authenticated;

notify pgrst, 'reload schema';
