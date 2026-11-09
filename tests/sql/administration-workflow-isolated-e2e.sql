-- Main-test isolated Administration acceptance. One Head Admin, Left hand, Right hand, Staff; all data rolled back.
-- No real credentials, permanent accounts, or external sends are used.
begin;
create temp table qa_accept_users(name text primary key,id uuid not null default gen_random_uuid());
insert into qa_accept_users(name) values('admin'),('office'),('right'),('staff');
grant select on qa_accept_users to authenticated;
insert into auth.users(id,email) select id,'qa-accept-'||name||'-'||id::text||'@example.invalid' from qa_accept_users;
update public.profiles p set approved=true,account_blocked=false,
 role=case when q.name='admin' then 'admin' else 'staff' end
 from qa_accept_users q where p.id=q.id;
select set_config('request.jwt.claim.sub',(select id::text from qa_accept_users where name='admin'),true);
set local role authenticated;
select public.upt_leadership_assign('head',(select id from qa_accept_users where name='admin'));
select public.upt_leadership_assign('left_hand',(select id from qa_accept_users where name='office'));
select public.upt_leadership_assign('right_hand',(select id from qa_accept_users where name='right'));
reset role;
select set_config('upt.test.right',(select id::text from qa_accept_users where name='right'),true);

select set_config('request.jwt.claim.sub', (select id::text from qa_accept_users where name='admin'), true);
select set_config('upt.test.admin', (select id::text from qa_accept_users where name='admin'), true);
select set_config('upt.test.office', (select id::text from qa_accept_users where name='office'), true);
select set_config('upt.test.staff', (select id::text from qa_accept_users where name='staff'), true);
do $qa$
declare v_admin uuid:=current_setting('upt.test.admin')::uuid;v_right uuid:=current_setting('upt.test.right')::uuid;v_right_denied boolean:=false;v_delegation_denied boolean:=false;v_office uuid:=current_setting('upt.test.office')::uuid;v_staff uuid:=current_setting('upt.test.staff')::uuid;v_event uuid:=gen_random_uuid();v_session uuid:=gen_random_uuid();v_case uuid:=gen_random_uuid();v_payroll jsonb;v_first integer;v_count integer;v_repeat integer;v_denied boolean:=false;v_own_case uuid:=gen_random_uuid();v_office_denied boolean:=false;
begin
 insert into public.events(id,name,start_at,end_at,start_date,end_date,status,created_by,onboarding_required)
 values(v_event,'QA rollback payroll',now()-interval '1 day',now()+interval '1 day',now()-interval '1 day',now()+interval '1 day','scheduled',v_admin,false);
 insert into public.work_sessions(id,event_id,user_id,started_at,start_time,ended_at,end_time,status)
 values(v_session,v_event,v_staff,now()-interval '3 hours',now()-interval '3 hours',now()-interval '1 hour',now()-interval '1 hour','completed');
 insert into public.break_sessions(work_session_id,user_id,started_at,start_time,ended_at,end_time)
 values(v_session,v_staff,now()-interval '2 hours',now()-interval '2 hours',now()-interval '90 minutes',now()-interval '90 minutes');
 insert into public.timesheets(event_id,user_id,status,submitted_at,reviewed_by,reviewed_at)
 values(v_event,v_staff,'approved',now(),v_admin,now());
 perform set_config('request.jwt.claim.sub',v_office::text,true);
 v_payroll:=public.upt_administration_payroll_rows(v_event);
 if jsonb_array_length(v_payroll)<>1 or (v_payroll->0->>'net_seconds')::numeric<>5400 then raise exception 'Payroll snapshot incorrect: %',v_payroll;end if;
 perform set_config('request.jwt.claim.sub',v_staff::text,true);
 begin perform public.upt_administration_payroll_rows(v_event);exception when insufficient_privilege then v_denied:=true;end;
 if not v_denied then raise exception 'Staff payroll access was accepted';end if;
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 insert into public.admin_operational_obligations(id,kind,title,due_at,created_by) values(v_own_case,'tasks','QA Head Admin own case',now()+interval '1 day',v_admin);
 update public.admin_operational_obligations set status='submitted' where id=v_own_case;
 perform set_config('request.jwt.claim.sub',v_office::text,true);
 begin update public.admin_operational_obligations set status='approved' where id=v_own_case;exception when insufficient_privilege then v_office_denied:=true;end;
 if not v_office_denied then raise exception 'Office approved a case';end if;
 perform set_config('request.jwt.claim.sub',v_right::text,true);
 begin update public.admin_operational_obligations set status='approved' where id=v_own_case;
 exception when insufficient_privilege then v_right_denied:=true;end;
 if not v_right_denied then raise exception 'Right hand approved a case';end if;
 begin perform public.upt_leadership_assign('left_hand',v_staff);
 exception when insufficient_privilege then v_delegation_denied:=true;end;
 if not v_delegation_denied then raise exception 'Deputy changed organization leadership';end if;
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 update public.admin_operational_obligations set status='approved' where id=v_own_case;
 update public.admin_operational_obligations set status='completed' where id=v_own_case;
 if not exists(select 1 from public.admin_operational_obligations where id=v_own_case
  and status='completed' and approved_by=v_admin) then raise exception 'Head self-approval did not complete';end if;
 if (select count(*) from public.upt_organization_leadership)<>3 then
  raise exception 'Expected one Head and two deputies';end if;
 if (select count(*) from public.profiles where role='admin' and approved and not account_blocked)<>1
 then raise exception 'Exactly one approved Admin is required after designation';end if;
 perform set_config('request.jwt.claim.sub',v_office::text,true);
 insert into public.admin_operational_obligations(id,kind,title,due_at,created_by) values(v_case,'tasks','QA rolled-back deadline',now()-interval '1 hour',v_office);
 v_first:=upt_administration_private.run_deadline_notifications();
 select count(*) into v_count from public.admin_obligation_notifications where obligation_id=v_case;
 if v_first<0 or v_count<2 then raise exception 'Deadline notifications failed';end if;
 v_repeat:=upt_administration_private.run_deadline_notifications();
 if (select count(*) from public.admin_obligation_notifications where obligation_id=v_case)<>v_count then raise exception 'Deadline notifications duplicated';end if;
 perform set_config('upt.qa_proof',jsonb_build_object('payroll_net_seconds',v_payroll->0->>'net_seconds','staff_denied',v_denied,'office_case_approval_denied',v_office_denied,'head_self_approval','completed','right_hand_approval_denied',v_right_denied,'delegation_change_denied',v_delegation_denied,'deadline_recipients',v_count,'repeat_run_deliveries',v_repeat)::text,true);
end $qa$;
select current_setting('upt.qa_proof')::jsonb proof;
rollback;
