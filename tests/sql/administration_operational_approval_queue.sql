-- Read-only installed database assertions after migration/replay.
do $$
declare guard text;
declare notifier text;
declare trig text;
begin
 select pg_get_functiondef('public.upt_guard_administration_obligation()'::regprocedure)
 into guard;
 if position('created_by=auth.uid()' in guard)>0
    or position('The submitter cannot review their own dossier' in guard)>0
    or position('approved_by:=auth.uid()' in guard)=0
    or position('public.upt_is_admin()' in guard)=0 then
  raise exception 'Head must be able to approve own submitted case; non-Admin still denied';
 end if;
 select pg_get_functiondef('upt_administration_private.notify_obligation_review()'::regprocedure)
 into notifier;
 if position('old.status is not distinct from new.status' in notifier)=0
    or position('crew_notifications' in notifier)=0 then
  raise exception 'Review notification function absent or not transition-gated';
 end if;
 select pg_get_triggerdef(t.oid) into trig
 from pg_trigger t
 where t.tgrelid='public.admin_operational_obligations'::regclass
   and t.tgname='upt_admin_obligation_review_notify'
   and not t.tgisinternal;
 if position('AFTER UPDATE' in coalesce(trig,''))=0 then
  raise exception 'Transactional review notification trigger is not installed';
 end if;
 if not exists(
  select 1 from pg_indexes where schemaname='public'
   and tablename='admin_operational_obligations'
   and indexname='admin_operational_obligations_kind_status_due_idx'
 ) then
  raise exception 'Review queue pagination index is missing';
 end if;
 if has_function_privilege('anon','upt_administration_private.notify_obligation_review()','EXECUTE') then
  raise exception 'Review notification trigger function is callable anonymously';
 end if;
 raise notice 'PASS: Head final approval (including own cases), notifications and pagination';
end $$;
