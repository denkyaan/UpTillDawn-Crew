-- Main-test or local full migration replay verification. No fixtures created.
do $$
declare v_def text;
declare v_options text;
declare v_trigger text;
begin
 if not has_function_privilege('authenticated','public.upt_admin_roster_shift_options()','EXECUTE')
    or has_function_privilege('anon','public.upt_admin_roster_shift_options()','EXECUTE') then
  raise exception 'Shift options execution permissions are unsafe';
 end if;
 select pg_get_functiondef('public.upt_admin_roster_apply(uuid)'::regprocedure)
 into v_def;
 if position('upt_update_shift' in v_def)=0
   or position('v_shift.start_time is not null' in v_def)>0
   or position('work_sessions' in v_def)=0
   or position('applied_at=now()' in v_def)=0 then
  raise exception 'Roster application must use canonical shift mutation and work-state guards';
 end if;
 select pg_get_functiondef('public.upt_admin_roster_submit(uuid)'::regprocedure)
 into v_def;
 if position('target_shift_id is null' in v_def)=0
   or position('status=''submitted''' in v_def)=0 then
  raise exception 'Roster cannot submit before a target shift exists';
 end if;
 select pg_get_functiondef('public.upt_admin_roster_shift_options()'::regprocedure)
 into v_options;
 if position('upt_can_manage_administration' in v_options)=0 or
    position('work_sessions' in v_options)=0 then
  raise exception 'Roster options do not enforce allowed Administration role and future work state';
 end if;
 select pg_get_triggerdef(oid) into v_trigger
 from pg_trigger
 where tgrelid='public.admin_roster_proposals'::regclass
 and tgname='upt_admin_roster_lifecycle_notify';
 if position('AFTER UPDATE' in coalesce(v_trigger,''))=0 or
    position('notify_roster_lifecycle' in coalesce(v_trigger,''))=0 then
  raise exception 'Transaction-atomic roster notifications missing';
 end if;
 if has_function_privilege('anon','upt_administration_private.notify_roster_lifecycle()','EXECUTE') then
  raise exception 'Lifecycle notification trigger should not be callable anonymously';
 end if;
 raise notice 'PASS: future-work, Admin-approval, application and roster notification guards';
end $$;
