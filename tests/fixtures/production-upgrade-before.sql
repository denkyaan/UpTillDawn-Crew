-- Only the isolated CI harness may seed these preservation fixtures.
do $$begin
 if current_setting('upt.isolated_upgrade_fixture',true) is distinct from '1' then raise exception 'Isolated upgrade fixture opt-in required';end if;
 if to_regclass('public.portal_role_assignments') is not null then raise exception 'Expected pre-platform baseline';end if;
end;$$;
create schema upt_upgrade_fixture;
revoke all on schema upt_upgrade_fixture from public,anon,authenticated;
create table upt_upgrade_fixture.ids(name text primary key,id uuid not null default gen_random_uuid());
insert into upt_upgrade_fixture.ids(name) values('admin'),('staff'),('event'),('workplace'),('task'),('item');
create table upt_upgrade_fixture.cron_state as select jobid,active from cron.job;
do $$declare job record;begin
 for job in select * from upt_upgrade_fixture.cron_state loop
  perform cron.alter_job(job.jobid,active:=false);
 end loop;
end;$$;
insert into auth.users(id,email) select id,id::text||'@upgrade-preservation.test' from upt_upgrade_fixture.ids where name in ('admin','staff');
update public.profiles p set approved=true,account_blocked=false,role=case when i.name='admin' then 'admin' else 'staff' end,
 full_name='Upgrade preservation '||i.name from upt_upgrade_fixture.ids i where p.id=i.id;
insert into public.events(id,name,start_at,end_at,start_date,end_date,status,created_by)
values((select id from upt_upgrade_fixture.ids where name='event'),'Upgrade preservation event',now()+interval '1 day',now()+interval '2 days',now()+interval '1 day',now()+interval '2 days','scheduled',(select id from upt_upgrade_fixture.ids where name='admin'));
insert into public.workplaces(id,event_id,name) values((select id from upt_upgrade_fixture.ids where name='workplace'),(select id from upt_upgrade_fixture.ids where name='event'),'Upgrade preservation workplace');
insert into public.event_members(event_id,user_id,event_role) values((select id from upt_upgrade_fixture.ids where name='event'),(select id from upt_upgrade_fixture.ids where name='staff'),'employee');
insert into public.tasks(id,event_id,title,description,created_by)
values((select id from upt_upgrade_fixture.ids where name='task'),(select id from upt_upgrade_fixture.ids where name='event'),'Historical completed task','Preserve these original instructions',(select id from upt_upgrade_fixture.ids where name='admin'));
insert into public.task_assignments(task_id,user_id,assigned_by,status,confirmed_at)
values((select id from upt_upgrade_fixture.ids where name='task'),(select id from upt_upgrade_fixture.ids where name='staff'),(select id from upt_upgrade_fixture.ids where name='admin'),'COMPLETED',now());
insert into public.inventory_items(id,event_id,workplace_id,name,total_quantity,available_quantity,created_by)
values((select id from upt_upgrade_fixture.ids where name='item'),(select id from upt_upgrade_fixture.ids where name='event'),(select id from upt_upgrade_fixture.ids where name='workplace'),'Historical stock',12,12,(select id from upt_upgrade_fixture.ids where name='admin'));
create table upt_upgrade_fixture.snapshots(table_name text primary key,columns_sql text not null,row_count bigint not null,fingerprint text not null);
do $$declare r record;cols text;total bigint;fingerprint text;begin
 for r in select c.oid,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') order by c.relname loop
  select string_agg(quote_ident(attname),',' order by attname) into cols from pg_attribute where attrelid=r.oid and attnum>0 and not attisdropped;
  execute format('select count(*),md5(coalesce(jsonb_agg(to_jsonb(rowdata) order by to_jsonb(rowdata)::text)::text,''[]'')) from (select %s from public.%I) rowdata',cols,r.relname) into total,fingerprint;
  insert into upt_upgrade_fixture.snapshots values(r.relname,cols,total,fingerprint);
 end loop;
end;$$;
