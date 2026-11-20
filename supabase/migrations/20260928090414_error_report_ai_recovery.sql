create table if not exists public.user_error_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  route text not null,
  error_name text,
  error_message text not null,
  stack_trace text,
  source text not null default 'manual',
  client_context jsonb not null default '{}'::jsonb,
  fingerprint text not null,
  status text not null default 'reported',
  ai_category text,
  ai_severity text,
  ai_summary text,
  ai_user_message text,
  auto_action text not null default 'none',
  maker_action_required boolean not null default false,
  maker_action text,
  god_prompt text,
  reported_count integer not null default 1,
  processing_attempts integer not null default 0,
  last_reported_at timestamptz not null default now(),
  maker_notified_at timestamptz,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(length(route) between 1 and 500),
  check(error_name is null or length(error_name)<=200),
  check(length(error_message) between 1 and 4000),
  check(stack_trace is null or length(stack_trace)<=12000),
  check(source in('boundary','runtime','promise','manual','api')),
  check(status in('reported','processing','auto_resolved','needs_maker','maker_working','resolved','failed','dismissed')),
  check(ai_category is null or ai_category in('transient','client_state','permission','data','code','database','configuration','network','unknown')),
  check(ai_severity is null or ai_severity in('low','medium','high','critical')),
  check(auto_action in('none','retry','reload')),
  check(ai_summary is null or length(ai_summary)<=3000),
  check(ai_user_message is null or length(ai_user_message)<=2000),
  check(maker_action is null or length(maker_action)<=4000),
  check(god_prompt is null or length(god_prompt)<=8000),
  check(resolution_note is null or length(resolution_note)<=4000),
  check(reported_count between 1 and 1000000),
  check(processing_attempts between 0 and 1000)
);

create index if not exists user_error_reports_user_created_idx
on public.user_error_reports(user_id,created_at desc);

create index if not exists user_error_reports_status_created_idx
on public.user_error_reports(status,created_at desc);

create index if not exists user_error_reports_fingerprint_idx
on public.user_error_reports(user_id,fingerprint,last_reported_at desc);

alter table public.user_error_reports enable row level security;
revoke all on public.user_error_reports from anon;
revoke insert,update,delete on public.user_error_reports from authenticated;
grant select on public.user_error_reports to authenticated;

drop policy if exists user_error_reports_self_admin_read on public.user_error_reports;
create policy user_error_reports_self_admin_read
on public.user_error_reports
for select to authenticated
using (
  user_id=(select auth.uid())
  or public.upt_is_admin((select auth.uid()))
);

do $do$
begin
  if not exists(
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='user_error_reports'
  ) then
    alter publication supabase_realtime add table public.user_error_reports;
  end if;
end
$do$;

create or replace function public.upt_report_client_error(
  p_route text,
  p_error_name text,
  p_error_message text,
  p_stack_trace text default null,
  p_source text default 'manual',
  p_client_context jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare
  v_user uuid:=auth.uid();
  v_route text:=left(trim(coalesce(p_route,'')),500);
  v_message text:=left(trim(coalesce(p_error_message,'')),4000);
  v_fingerprint text;
  v_existing uuid;
  v_id uuid;
  v_recent integer;
begin
  if v_user is null or not public.upt_is_approved() then
    raise exception 'Aanmelden vereist.';
  end if;
  if v_route='' or v_message='' then
    raise exception 'Foutmelding en pagina zijn verplicht.';
  end if;
  if p_source not in('boundary','runtime','promise','manual','api') then
    raise exception 'Ongeldige foutbron.';
  end if;
  if length(coalesce(p_stack_trace,''))>12000 then
    raise exception 'Foutdetails zijn te groot.';
  end if;
  if length(coalesce(p_client_context::text,''))>12000 then
    raise exception 'Foutcontext is te groot.';
  end if;

  select count(*) into v_recent
  from public.user_error_reports
  where user_id=v_user and created_at>now()-interval '10 minutes';

  if v_recent>=12 then
    raise exception 'Te veel foutrapporten in korte tijd. Probeer over enkele minuten opnieuw.';
  end if;

  v_fingerprint:=md5(lower(v_route)||'|'||lower(v_message)||'|'||lower(coalesce(p_error_name,'')));

  select id into v_existing
  from public.user_error_reports
  where user_id=v_user
    and fingerprint=v_fingerprint
    and last_reported_at>now()-interval '10 minutes'
    and status not in('resolved','dismissed')
  order by last_reported_at desc
  limit 1
  for update;

  if v_existing is not null then
    update public.user_error_reports
    set reported_count=reported_count+1,
        last_reported_at=now(),
        client_context=coalesce(p_client_context,'{}'::jsonb),
        updated_at=now()
    where id=v_existing;
    return jsonb_build_object('id',v_existing,'deduplicated',true);
  end if;

  insert into public.user_error_reports(
    user_id,route,error_name,error_message,stack_trace,source,client_context,fingerprint
  ) values(
    v_user,v_route,nullif(left(trim(coalesce(p_error_name,'')),200),''),
    v_message,nullif(left(coalesce(p_stack_trace,''),12000),''),
    p_source,coalesce(p_client_context,'{}'::jsonb),v_fingerprint
  )
  returning id into v_id;

  return jsonb_build_object('id',v_id,'deduplicated',false);
end
$fn$;

create or replace function public.upt_start_error_report_ai(p_report uuid)
returns boolean
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Aanmelden vereist.'; end if;
  update public.user_error_reports
  set status='processing',
      processing_attempts=processing_attempts+1,
      updated_at=now()
  where id=p_report
    and user_id=v_user
    and status in('reported','failed');
  return found;
end
$fn$;

create or replace function public.upt_finalize_error_report_ai(
  p_report uuid,
  p_status text,
  p_category text,
  p_severity text,
  p_summary text,
  p_user_message text,
  p_auto_action text default 'none',
  p_maker_action_required boolean default false,
  p_maker_action text default null,
  p_god_prompt text default null
) returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_user uuid:=auth.uid();
  v_route text;
  v_notify_maker boolean:=false;
begin
  if v_user is null then raise exception 'Aanmelden vereist.'; end if;
  if p_status not in('auto_resolved','needs_maker','resolved','failed') then raise exception 'Ongeldige foutstatus.'; end if;
  if p_category not in('transient','client_state','permission','data','code','database','configuration','network','unknown') then raise exception 'Ongeldige foutcategorie.'; end if;
  if p_severity not in('low','medium','high','critical') then raise exception 'Ongeldige ernst.'; end if;
  if p_auto_action not in('none','retry','reload') then raise exception 'Ongeldige herstelactie.'; end if;
  if length(coalesce(p_summary,'')) not between 1 and 3000 then raise exception 'Ongeldige AI-samenvatting.'; end if;
  if length(coalesce(p_user_message,'')) not between 1 and 2000 then raise exception 'Ongeldige gebruikersmelding.'; end if;
  if length(coalesce(p_maker_action,''))>4000 or length(coalesce(p_god_prompt,''))>8000 then raise exception 'Makeractie is te groot.'; end if;

  select route,(p_maker_action_required and maker_notified_at is null)
  into v_route,v_notify_maker
  from public.user_error_reports
  where id=p_report and user_id=v_user and status='processing'
  for update;

  if not found then raise exception 'Foutrapport niet beschikbaar voor verwerking.'; end if;

  update public.user_error_reports
  set status=case when p_maker_action_required then 'needs_maker' else p_status end,
      ai_category=p_category,
      ai_severity=p_severity,
      ai_summary=left(p_summary,3000),
      ai_user_message=left(p_user_message,2000),
      auto_action=case when p_maker_action_required then 'none' else p_auto_action end,
      maker_action_required=p_maker_action_required,
      maker_action=nullif(left(coalesce(p_maker_action,''),4000),''),
      god_prompt=nullif(left(coalesce(p_god_prompt,''),8000),''),
      resolved_at=case when p_maker_action_required then null when p_status in('auto_resolved','resolved') then now() else null end,
      maker_notified_at=case when v_notify_maker then now() else maker_notified_at end,
      updated_at=now()
  where id=p_report;

  insert into public.crew_notifications(user_id,title,body,link,kind)
  values(
    v_user,
    case when p_maker_action_required then 'Fout doorgestuurd naar maker' else 'AI-foutanalyse klaar' end,
    left(p_user_message,1000),
    case when v_route like '/%' and v_route not like '//%' then split_part(v_route,'?',1) else '/' end,
    'error_report'
  );

  if v_notify_maker then
    insert into public.crew_notifications(user_id,title,body,link,kind)
    select
      o.user_id,
      'AI foutdiagnose vereist makeractie',
      left(coalesce(nullif(p_maker_action,''),p_summary),1000),
      '/god-mode?error-report='||p_report::text,
      'error_report_maker'
    from upt_private.app_owners o;
  end if;
end
$fn$;

create or replace function public.upt_god_error_reports(p_token text,p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare v_result jsonb;
begin
  if not upt_private.god_session_valid(p_token) then raise exception 'Invalid God Mode session'; end if;
  if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Invalid limit'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  into v_result
  from(
    select id,user_id,route,error_name,error_message,stack_trace,source,client_context,
           status,ai_category,ai_severity,ai_summary,ai_user_message,auto_action,
           maker_action_required,maker_action,god_prompt,reported_count,processing_attempts,
           last_reported_at,created_at,updated_at,resolved_at
    from public.user_error_reports
    where status in('needs_maker','maker_working','failed','reported','processing')
       or created_at>now()-interval '24 hours'
    order by case status when 'needs_maker' then 0 when 'failed' then 1 when 'reported' then 2 when 'processing' then 3 else 4 end,
             created_at desc
    limit p_limit
  )x;

  return v_result;
end
$fn$;

create or replace function public.upt_god_error_report_mark_working(p_token text,p_report uuid)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
begin
  if not upt_private.god_session_valid(p_token) then raise exception 'Invalid God Mode session'; end if;
  update public.user_error_reports
  set status='maker_working',updated_at=now()
  where id=p_report and status='needs_maker';
end
$fn$;

create or replace function public.upt_god_error_report_resolve(p_token text,p_report uuid,p_note text default null)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare v_user uuid;
begin
  if not upt_private.god_session_valid(p_token) then raise exception 'Invalid God Mode session'; end if;

  update public.user_error_reports
  set status='resolved',
      resolved_at=now(),
      resolution_note=nullif(left(trim(coalesce(p_note,'')),4000),''),
      updated_at=now()
  where id=p_report
  returning user_id into v_user;

  if v_user is null then raise exception 'Foutrapport niet gevonden.'; end if;

  insert into public.crew_notifications(user_id,title,body,link,kind)
  values(v_user,'Gemelde fout opgelost',coalesce(nullif(left(trim(coalesce(p_note,'')),1000),''),'De maker heeft de fout als opgelost gemarkeerd.'),'/', 'error_report_resolved');
end
$fn$;

create or replace function upt_private.escalate_stuck_error_reports()
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare v_row record; v_count integer:=0;
begin
  for v_row in
    select id,user_id,error_message
    from public.user_error_reports
    where (
      status='reported' and created_at<now()-interval '5 minutes'
    ) or (
      status='processing' and updated_at<now()-interval '10 minutes'
    )
    for update skip locked
  loop
    update public.user_error_reports
    set status='needs_maker',
        maker_action_required=true,
        maker_action=coalesce(maker_action,'Achtergrond-AI heeft het rapport niet tijdig verwerkt. Open het rapport in God Mode en voer de diagnose handmatig uit.'),
        god_prompt=coalesce(god_prompt,'Onderzoek en herstel deze gemelde productiefout: '||left(v_row.error_message,3000)),
        maker_notified_at=coalesce(maker_notified_at,now()),
        updated_at=now()
    where id=v_row.id;

    insert into public.crew_notifications(user_id,title,body,link,kind)
    select o.user_id,'Foutrapport vereist makeractie','Achtergrondanalyse is niet tijdig afgerond. Open het rapport in God Mode.','/god-mode?error-report='||v_row.id::text,'error_report_maker'
    from upt_private.app_owners o
    where not exists(
      select 1 from public.crew_notifications n
      where n.user_id=o.user_id and n.kind='error_report_maker' and n.link='/god-mode?error-report='||v_row.id::text
    );

    v_count:=v_count+1;
  end loop;

  return v_count;
end
$fn$;

revoke all on function public.upt_report_client_error(text,text,text,text,text,jsonb),
                       public.upt_start_error_report_ai(uuid),
                       public.upt_finalize_error_report_ai(uuid,text,text,text,text,text,text,boolean,text,text),
                       public.upt_god_error_reports(text,integer),
                       public.upt_god_error_report_mark_working(text,uuid),
                       public.upt_god_error_report_resolve(text,uuid,text)
from public,anon;
grant execute on function public.upt_report_client_error(text,text,text,text,text,jsonb),
                          public.upt_start_error_report_ai(uuid),
                          public.upt_finalize_error_report_ai(uuid,text,text,text,text,text,text,boolean,text,text)
to authenticated;
grant execute on function public.upt_god_error_reports(text,integer),
                          public.upt_god_error_report_mark_working(text,uuid),
                          public.upt_god_error_report_resolve(text,uuid,text)
to anon,authenticated;

revoke all on function upt_private.escalate_stuck_error_reports() from public,anon,authenticated;

do $do$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname='uptilldawn-error-report-escalation' limit 1;
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule(
    'uptilldawn-error-report-escalation',
    '*/5 * * * *',
    $cron$select upt_private.escalate_stuck_error_reports()$cron$
  );
end
$do$;

notify pgrst,'reload schema';