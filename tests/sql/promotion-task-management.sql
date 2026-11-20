-- Isolated fixtures and every permission change are rolled back.
begin;
create temp table ptm_ids(name text primary key,id uuid default gen_random_uuid(),seen_at timestamptz);
insert into ptm_ids(name) values ('admin'),('promo'),('second'),('staff'),('task'),('bad-task'),('old-proof'),('new-proof');
grant select,update on ptm_ids to authenticated;
insert into auth.users(id,email) select id,id::text||'@promotion-task-rollback.test'
 from ptm_ids where name in ('admin','promo','second','staff');
update public.profiles p set approved=true,account_blocked=false,
 role=case i.name when 'admin' then 'admin' else 'staff' end,full_name='Promotion test '||i.name
 from ptm_ids i where p.id=i.id;
insert into public.portal_role_assignments(user_id,portal,role,approved,approved_by,approved_at)
 select id,'promotion','promoter',true,(select id from ptm_ids where name='admin'),now() from ptm_ids where name in ('promo','second');
-- Make the ordinary event feature gate permissive so revocation must still deny
-- general promotion records independently of any event feature configuration.
update public.role_ui_rules set visible=true,enabled=true,condition_key='always'
 where role='staff' and feature_key='tasks';

select set_config('request.jwt.claim.sub',(select id::text from ptm_ids where name='admin'),true);
set local role authenticated;
do $$
declare v_id uuid;
begin
 v_id:=public.upt_admin_create_promotion_task((select id from ptm_ids where name='task'),'General campaign','Publish official media',
  array[(select id from ptm_ids where name='promo'),(select id from ptm_ids where name='second')]);
 if not exists(select 1 from public.tasks where id=v_id and event_id is null and promotion_only) then raise exception 'General task not saved';end if;
 if (select count(*) from public.task_assignments where task_id=v_id)<>2 then raise exception 'Assignments not atomic';end if;
 perform public.upt_admin_create_promotion_task(v_id,'General campaign','Publish official media',
  array[(select id from ptm_ids where name='second'),(select id from ptm_ids where name='promo'),(select id from ptm_ids where name='promo')]);
 perform public.upt_admin_assign_promotion_task(v_id,(select id from ptm_ids where name='promo'));
 if (select count(*) from public.task_assignments where task_id=v_id)<>2 then raise exception 'Replay duplicated assignments';end if;
 if (select count(*) from public.crew_notifications where body='General campaign' and link='/portals/promotion/tasks')<>2 then raise exception 'Wrong or duplicated promotion notification';end if;
 begin
  perform public.upt_admin_create_promotion_task(v_id,'Conflicting replay','Publish official media',array[(select id from ptm_ids where name='promo')]);
  raise exception 'Conflicting replay accepted';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.upt_admin_create_promotion_task((select id from ptm_ids where name='bad-task'),'Invalid target','',
   array[(select id from ptm_ids where name='promo'),(select id from ptm_ids where name='staff')]);
  raise exception 'Non-promotion target accepted';
 exception when insufficient_privilege then null;end;
 if exists(select 1 from public.tasks where id=(select id from ptm_ids where name='bad-task')) then raise exception 'Failed bulk assignment left partial task';end if;
 if (select count(*) from public.upt_admin_promotion_task_members() where user_id in (select id from ptm_ids where name in ('promo','second')))<>2 then raise exception 'Active promotion directory missing members';end if;
 if exists(select 1 from public.upt_admin_promotion_task_members() where user_id=(select id from ptm_ids where name='staff')) then raise exception 'Staff leaked into promotion directory';end if;
end;$$;
update ptm_ids set seen_at=(select updated_at from public.tasks where id=ptm_ids.id) where name='task';

select set_config('request.jwt.claim.sub',(select id::text from ptm_ids where name='promo'),true);
do $$
declare v_assignment uuid;
begin
 select id into strict v_assignment from public.task_assignments where task_id=(select id from ptm_ids where name='task');
 if (select count(*) from public.tasks where id=(select id from ptm_ids where name='task'))<>1 then raise exception 'Own general task hidden by event RLS';end if;
 perform public.upt_start_promotion_task(v_assignment);
 perform public.upt_start_promotion_task(v_assignment);
 if not exists(select 1 from public.task_assignments where id=v_assignment and status='IN PROGRESS' and confirmed_at is not null) then raise exception 'Start did not atomically confirm task';end if;
 begin
  perform public.upt_admin_create_promotion_task(gen_random_uuid(),'Forged task','',array[auth.uid()]);
  raise exception 'Promoter created administrative task';
 exception when insufficient_privilege then null;end;
 begin
  perform * from public.upt_admin_promotion_task_members();
  raise exception 'Promoter read administrative directory';
 exception when insufficient_privilege then null;end;
end;$$;

reset role;
insert into public.promotion_evidence(id,assignment_id,submitted_by,storage_path,evidence_sha256,submitted_at)
select (select id from ptm_ids where name='old-proof'),a.id,a.user_id,a.user_id::text||'/promotion/old.png',repeat('b',64),clock_timestamp()
from public.task_assignments a where a.task_id=(select id from ptm_ids where name='task') and a.user_id=(select id from ptm_ids where name='promo');
select set_config('request.jwt.claim.sub',(select id::text from ptm_ids where name='admin'),true);
set local role authenticated;
do $$begin
 perform public.upt_admin_update_promotion_task((select id from ptm_ids where name='task'),'General campaign','Publish official media',
  (select seen_at from ptm_ids where name='task'));
 if (select updated_at from public.tasks where id=(select id from ptm_ids where name='task')) is distinct from (select seen_at from ptm_ids where name='task') then
  raise exception 'Unchanged save invalidated existing evidence';end if;
 if not exists(select 1 from public.task_assignments where task_id=(select id from ptm_ids where name='task') and user_id=(select id from ptm_ids where name='promo') and confirmed_at is not null) then
  raise exception 'Unchanged save cleared task confirmation';end if;
 perform public.upt_admin_update_promotion_task((select id from ptm_ids where name='task'),'Updated campaign','New instructions',
  (select seen_at from ptm_ids where name='task'));
 begin
  perform public.upt_admin_update_promotion_task((select id from ptm_ids where name='task'),'Stale overwrite','',
   (select seen_at from ptm_ids where name='task'));
  raise exception 'Stale task edit accepted';
 exception when serialization_failure then null;end;
 if exists(select 1 from public.task_assignments where task_id=(select id from ptm_ids where name='task') and confirmed_at is not null) then raise exception 'Edited task did not require reconfirmation';end if;
 if not exists(select 1 from public.crew_notifications where body='Updated campaign' and link='/portals/promotion/tasks') then raise exception 'Edit notification leaves Promotion portal';end if;
end;$$;

-- Direct evidence writes cannot bypass reconfirmation, even through a privileged
-- internal caller. The normal RPC also checks ownership, status and stored image.
reset role;
do $$begin
 begin
  insert into public.promotion_evidence(assignment_id,submitted_by,storage_path,evidence_sha256)
  select a.id,a.user_id,a.user_id::text||'/promotion/test.png',repeat('a',64)
  from public.task_assignments a where a.task_id=(select id from ptm_ids where name='task') and a.user_id=(select id from ptm_ids where name='promo');
  raise exception 'Unconfirmed task accepted evidence';
 exception when insufficient_privilege then null;end;
end;$$;

select set_config('request.jwt.claim.sub',(select id::text from ptm_ids where name='second'),true);
set local role authenticated;
do $$begin
 begin
  perform public.upt_start_promotion_task((select a.id from public.task_assignments a where a.task_id=(select id from ptm_ids where name='task') and a.user_id=(select id from ptm_ids where name='promo')));
  raise exception 'Promoter started another user task';
 exception when insufficient_privilege then null;end;
end;$$;

select set_config('request.jwt.claim.sub',(select id::text from ptm_ids where name='promo'),true);
select public.upt_start_promotion_task((select id from public.task_assignments where task_id=(select id from ptm_ids where name='task')));
reset role;
update public.portal_role_assignments set revoked_at=now() where user_id=(select id from ptm_ids where name='promo') and portal='promotion';
set local role authenticated;
do $$begin
 if exists(select 1 from public.tasks where id=(select id from ptm_ids where name='task')) then raise exception 'Revoked promotion task still readable';end if;
 if exists(select 1 from public.task_assignments where task_id=(select id from ptm_ids where name='task')) then raise exception 'Revoked promotion assignment still readable';end if;
 begin
  perform public.upt_start_promotion_task(gen_random_uuid());
  raise exception 'Revoked promoter could call start';
 exception when insufficient_privilege then null;end;
end;$$;

reset role;
update public.portal_role_assignments set revoked_at=null where user_id=(select id from ptm_ids where name='promo') and portal='promotion';
insert into public.promotion_discipline(user_id,permanently_blocked) values((select id from ptm_ids where name='promo'),true);
set local role authenticated;
do $$begin
 if not exists(select 1 from public.tasks where id=(select id from ptm_ids where name='task')) then raise exception 'Restricted promoter lost read-only history';end if;
 begin
  perform public.upt_start_promotion_task(gen_random_uuid());
  raise exception 'Blocked promoter could start work';
 exception when insufficient_privilege then null;end;
end;$$;
reset role;
do $$begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
  and p.proname in ('upt_admin_create_promotion_task','upt_admin_assign_promotion_task','upt_admin_update_promotion_task','upt_start_promotion_task','upt_admin_promotion_task_members')
  and (p.prosecdef or has_function_privilege('anon',p.oid,'execute'))) then raise exception 'New RPC exposes privileged or anonymous execution';end if;
end;$$;
insert into public.promotion_evidence(id,assignment_id,submitted_by,storage_path,evidence_sha256,submitted_at)
select (select id from ptm_ids where name='new-proof'),a.id,a.user_id,a.user_id::text||'/promotion/new.png',repeat('c',64),clock_timestamp()
from public.task_assignments a where a.task_id=(select id from ptm_ids where name='task') and a.user_id=(select id from ptm_ids where name='promo');
select set_config('request.jwt.claim.sub',(select id::text from ptm_ids where name='admin'),true);
set local role authenticated;
do $$begin
 begin
  perform public.upt_admin_review_promotion_evidence((select id from ptm_ids where name='old-proof'),'verified','Reviewed obsolete instructions');
  raise exception 'Outdated evidence completed edited task';
 exception when invalid_parameter_value then null;end;
 perform public.upt_admin_review_promotion_evidence((select id from ptm_ids where name='new-proof'),'verified','Reviewed current instructions');
 if not exists(select 1 from public.task_assignments where task_id=(select id from ptm_ids where name='task')
  and user_id=(select id from ptm_ids where name='promo') and status='COMPLETED') then raise exception 'Verified evidence did not complete task';end if;
 if not exists(select 1 from public.promotion_evidence where id=(select id from ptm_ids where name='new-proof') and verification_status='verified') then raise exception 'Evidence review not saved';end if;
 perform public.upt_remove_task_assignment((select id from public.task_assignments where task_id=(select id from ptm_ids where name='task') and user_id=(select id from ptm_ids where name='second')));
 if exists(select 1 from public.task_assignments where task_id=(select id from ptm_ids where name='task') and user_id=(select id from ptm_ids where name='second')) then raise exception 'General assignment removal failed';end if;
end;$$;
rollback;
select 'PASS: promotion creation, atomic assignment, replay, start, edit conflict, evidence confirmation, access revocation and verified completion' as result;
