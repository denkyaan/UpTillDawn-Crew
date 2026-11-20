-- Security advisor cleanup: God Mode operations are server-side/authenticated after login.
-- Keep only the two intentionally pre-authentication entry points anonymous.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef and p.proname like 'upt_god_%'
      and p.proname <> 'upt_god_login'
  loop
    execute format('revoke execute on function %s from anon',r.sig);
  end loop;
end $$;

-- Admin login guard/failure are intentionally anonymous: they rate-limit and audit before auth.
-- God login is intentionally anonymous: it is the credential verification boundary.
