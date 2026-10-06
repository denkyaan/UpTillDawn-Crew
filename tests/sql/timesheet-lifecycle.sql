begin;
create temp table ts_ids(name text primary key,id uuid default gen_random_uuid());
insert into ts_ids(name) values('staff'),('lead'),('admin'),('event'),('wp');
grant select on ts_ids to authenticated;
insert into auth.users(id,email) select id,name||'@timesheet.test' from ts_ids where name in('staff','lead','admin');
update public.profiles p set approved=true,role=case when i.name='admin' then 'admin' when i.name='lead' then 'responsible_lead' else 'staff' end,full_name='TS '||i.name from ts_ids i where p.id=i.id and i.name in('staff','lead','admin');
insert into public.events(id,name,start_date,end_date,start_at,end_at,status,created_by) values((select id from ts_ids where name='event'),'Timesheet lifecycle',now()-interval '8 hours',now(),now()-interval '8 hours',now(),'active',(select id from ts_ids where name='admin'));
insert into public.workplaces(id,event_id,name,sort_order) values((select id from ts_ids where name='wp'),(select id from ts_ids where name='event'),'TS workplace',1);
insert into public.event_members(event_id,user_id,event_role) values((select id from ts_ids where name='event'),(select id from ts_ids where name='staff'),'employee');
insert into public.responsible_assignments(event_id,workplace_id,user_id) values((select id from ts_ids where name='event'),(select id from ts_ids where name='wp'),(select id from ts_ids where name='lead'));
insert into public.shifts(event_id,workplace_id,user_id,start_time,end_time,scheduled_start,scheduled_end,role,status,response_status)
values((select id from ts_ids where name='event'),(select id from ts_ids where name='wp'),(select id from ts_ids where name='staff'),now()-interval '8 hours',now(),now()-interval '8 hours',now(),'staff','scheduled','accepted');

select set_config('request.jwt.claim.sub',(select id::text from ts_ids where name='staff'),true); set local role authenticated;
select public.upt_submit_timesheet((select id from ts_ids where name='event'));
reset role;
do $$ begin if not exists(select 1 from public.timesheets where event_id=(select id from ts_ids where name='event') and user_id=(select id from ts_ids where name='staff') and status='submitted') then raise exception 'FAIL submit'; end if; end $$;

select set_config('request.jwt.claim.sub',(select id::text from ts_ids where name='lead'),true); set local role authenticated;
select public.upt_review_timesheet((select id from public.timesheets where event_id=(select id from ts_ids where name='event')),false,'uren controleren');
reset role;
do $$ begin if not exists(select 1 from public.timesheets where event_id=(select id from ts_ids where name='event') and status='rejected' and rejection_reason='uren controleren') then raise exception 'FAIL reject'; end if; end $$;

select set_config('request.jwt.claim.sub',(select id::text from ts_ids where name='staff'),true); set local role authenticated;
select public.upt_submit_timesheet((select id from ts_ids where name='event'));
reset role;
select set_config('request.jwt.claim.sub',(select id::text from ts_ids where name='lead'),true); set local role authenticated;
select public.upt_review_timesheet((select id from public.timesheets where event_id=(select id from ts_ids where name='event')),true,null);
reset role;
select set_config('request.jwt.claim.sub',(select id::text from ts_ids where name='admin'),true); set local role authenticated;
select public.upt_lock_timesheet((select id from public.timesheets where event_id=(select id from ts_ids where name='event')));
reset role;
do $$ begin
 if not exists(select 1 from public.timesheets where event_id=(select id from ts_ids where name='event') and status='locked' and locked_at is not null) then raise exception 'FAIL lock'; end if;
 if (select count(*) from public.upt_audit_logs where entity_type='timesheet' and action in('TIMESHEET_SUBMITTED','TIMESHEET_REJECTED','TIMESHEET_APPROVED','TIMESHEET_LOCKED'))<5 then raise exception 'FAIL audit'; end if;
end $$;
rollback;
select 'PASS timesheet lifecycle submit -> reject -> resubmit -> approve -> lock';
