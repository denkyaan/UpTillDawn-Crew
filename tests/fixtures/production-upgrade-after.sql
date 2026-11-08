do $$begin
 if current_setting('upt.isolated_upgrade_fixture',true) is distinct from '1' then raise exception 'Isolated upgrade fixture opt-in required';end if;
end;$$;
do $$declare r record;total bigint;fingerprint text;begin
 for r in select * from upt_upgrade_fixture.snapshots order by table_name loop
  if to_regclass('public.'||r.table_name) is null then raise exception 'Legacy table removed: %',r.table_name;end if;
  execute format('select count(*),md5(coalesce(jsonb_agg(to_jsonb(rowdata) order by to_jsonb(rowdata)::text)::text,''[]'')) from (select %s from public.%I) rowdata',r.columns_sql,r.table_name) into total,fingerprint;
  if total<>r.row_count or fingerprint<>r.fingerprint then raise exception 'Legacy records changed during upgrade: %',r.table_name;end if;
 end loop;
 if not exists(select 1 from public.tasks where id=(select id from upt_upgrade_fixture.ids where name='task') and not promotion_only and event_id=(select id from upt_upgrade_fixture.ids where name='event')) then raise exception 'Legacy event task changed scope';end if;
 if not exists(select 1 from public.task_assignments where task_id=(select id from upt_upgrade_fixture.ids where name='task') and status='COMPLETED' and confirmed_at is not null) then raise exception 'Completed task history was lost';end if;
 if to_regclass('public.training_scenarios') is not null then raise exception 'Upgrade restored retired training';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and (c.relname like 'admin_%' or c.relname like 'promotion_%' or c.relname='portal_role_assignments') and c.relkind='r' and not c.relrowsecurity) then raise exception 'New platform table lacks RLS';end if;
 raise notice 'PASS: all % legacy tables preserve their records, completed task history and stock', (select count(*) from upt_upgrade_fixture.snapshots);
end;$$;
-- A legacy staff account keeps its role without acquiring extra portal rights.
select set_config('request.jwt.claim.sub',(select id::text from upt_upgrade_fixture.ids where name='staff'),false);
do $$begin
 if public.upt_current_effective_role() not in ('staff','employee') then raise exception 'Legacy staff role changed';end if;
 if public.upt_can_manage_administration() then raise exception 'Upgrade promoted ordinary staff to Administration';end if;
end;$$;
select set_config('request.jwt.claim.sub','',false);
-- Fixture cleanup is isolated to the exact generated identities above.
delete from public.events where id=(select id from upt_upgrade_fixture.ids where name='event');
delete from public.crew_notifications where user_id in(select id from upt_upgrade_fixture.ids where name in ('admin','staff'));
delete from auth.users where id in(select id from upt_upgrade_fixture.ids where name in ('admin','staff'));
update cron.job j set active=s.active from upt_upgrade_fixture.cron_state s where j.jobid=s.jobid;
drop schema upt_upgrade_fixture cascade;
select 'PASS: existing-data platform upgrade and legacy access preservation' as result;
