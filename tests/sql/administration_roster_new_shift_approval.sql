do $$
declare
 v_apply text;
 v_submit text;
 v_plan text;
begin
 if not exists(
  select 1 from information_schema.columns
  where table_schema='public' and table_name='admin_roster_proposals'
   and column_name='plan_kind'
 ) or not exists(
  select 1 from information_schema.columns
  where table_schema='public' and table_name='admin_roster_proposals'
   and column_name='created_shift_id'
 ) then raise exception 'New shift plan columns missing'; end if;
 for v_plan in select unnest(array[
  'public.upt_admin_roster_staff_options()',
  'public.upt_admin_roster_workplace_options()',
  'public.upt_admin_roster_plan_new(uuid,uuid,uuid,text,text,boolean)'
 ]) loop
  if has_function_privilege('anon',v_plan,'EXECUTE') or
     not has_function_privilege('authenticated',v_plan,'EXECUTE') then
   raise exception 'Incorrect roster function privileges: %',v_plan;
  end if;
 end loop;
 select pg_get_functiondef('public.upt_admin_roster_apply(uuid)'::regprocedure)
 into v_apply;
 select pg_get_functiondef('public.upt_admin_roster_submit(uuid)'::regprocedure)
 into v_submit;
 if position('upt_create_shift' in v_apply)=0
    or position('upt_update_shift' in v_apply)=0
    or position('created_shift_id=v_new_shift' in v_apply)=0 then
  raise exception 'Admin apply does not safely handle both existing and new shifts';
 end if;
 if position('plan_kind' in v_submit)=0
    or position('shift_capacity_would_exceed' in v_submit)=0
    or position('target_shift_id is null' in v_submit)=0 then
  raise exception 'Roster submit is not guarded for both shift kinds';
 end if;
 if not exists(
  select 1 from pg_indexes where schemaname='public'
   and tablename='admin_roster_proposals'
   and indexname='admin_roster_created_shift_unique'
 ) then raise exception 'Missing created-shift anti-duplicate index'; end if;
 raise notice 'PASS: new shift plans, canonical Admin create/update, privilege boundary';
end $$;