-- Verify the delegated authorization cannot be used without an authenticated
-- principal, and the privileged read endpoint is not exposed to anon/PUBLIC.
begin;
do $$
declare
  v_rpc regprocedure := to_regprocedure('public.upt_administration_timesheet_labels(uuid[])');
  v_source text;
begin
  if v_rpc is null then raise exception 'FAIL: administration timesheet labels RPC missing'; end if;
  select pg_get_functiondef(v_rpc) into v_source;
  if position('auth.uid() is null' in v_source) = 0
     or position('upt_can_manage_administration' in v_source) = 0 then
    raise exception 'FAIL: timesheet labels RPC has no explicit caller and admin authorization';
  end if;
  if has_function_privilege('anon',v_rpc,'EXECUTE')
     or has_function_privilege('public',v_rpc,'EXECUTE') then
    raise exception 'FAIL: timesheet labels RPC exposed to public or anon';
  end if;
  if not has_function_privilege('authenticated',v_rpc,'EXECUTE') then
    raise exception 'FAIL: approved admin and Administration cannot call the scoped label RPC';
  end if;
  if position('public.profiles p' in v_source) = 0
     or position('public.timesheets t' in v_source) = 0 then
    raise exception 'FAIL: authorized label source contract is incomplete';
  end if;
end;
$$;
select 'PASS: explicit authenticated Administration-only timesheet label RPC' as result;
rollback;
