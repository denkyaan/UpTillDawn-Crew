-- Native PostgreSQL regression assertions; no pgTAP extension dependency.
do $$
declare
  v_count integer;
begin
  if to_regclass('public.portal_role_assignments') is null then
    raise exception 'Portal grants table missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='portal_role_assignments' and column_name='revoked_at'
  ) then
    raise exception 'Revocation field missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='portal_role_assignments' and policyname='portal_role_admin_read' and cmd='SELECT') then
    raise exception 'Admin read policy missing';
  end if;
  if to_regprocedure('public.upt_admin_set_portal_role(uuid,text,text,text)') is null then
    raise exception 'Audited portal role mutation RPC missing';
  end if;
  if not (select prosecdef from pg_proc where oid='public.upt_admin_set_portal_role(uuid,text,text,text)'::regprocedure) then
    raise exception 'Privileged role mutation RPC must be SECURITY DEFINER';
  end if;
  if has_function_privilege('anon','public.upt_admin_set_portal_role(uuid,text,text,text)','EXECUTE') then
    raise exception 'Anonymous role can invoke privileged mutation';
  end if;
  if to_regprocedure('public.upt_my_portal_assignments()') is null then
    raise exception 'Entitlement RPC missing';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.portal_role_assignments'::regclass) then
    raise exception 'Portal grants RLS disabled';
  end if;
  select count(*) into v_count from pg_policies
  where schemaname='public' and tablename='portal_role_assignments'
    and cmd in ('INSERT','UPDATE','DELETE','ALL');
  if v_count <> 0 then
    raise exception 'Unexpected portal grant mutation policy: %', v_count;
  end if;
  if has_table_privilege('authenticated','public.portal_role_assignments','INSERT')
    or has_table_privilege('authenticated','public.portal_role_assignments','UPDATE')
    or has_table_privilege('authenticated','public.portal_role_assignments','DELETE') then
    raise exception 'Authenticated role has portal grant mutation privilege';
  end if;
  if not (select prosecdef from pg_proc where oid='public.upt_my_portal_assignments()'::regprocedure) then
    raise exception 'Entitlement RPC must safely read profile state under SECURITY DEFINER';
  end if;
end $$;
