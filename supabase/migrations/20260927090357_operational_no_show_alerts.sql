create table if not exists upt_private.operational_alerts (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('late-check-in','no-show')),
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (shift_id,kind)
);

alter table upt_private.operational_alerts enable row level security;
revoke all on table upt_private.operational_alerts from public, anon, authenticated;

create index if not exists operational_alerts_open_idx
on upt_private.operational_alerts(workplace_id,detected_at)
where resolved_at is null;

create or replace function upt_private.refresh_operational_alerts()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_shift record;
  v_alert_id uuid;
  v_kind text;
  v_created integer:=0;
  v_has_responsible boolean;
begin
  update upt_private.operational_alerts oa
  set resolved_at=coalesce(oa.resolved_at,now())
  from public.shifts s
  where oa.shift_id=s.id
    and oa.resolved_at is null
    and (
      s.status='cancelled'
      or s.response_status='declined'
      or now()>=s.scheduled_end
      or exists(
        select 1
        from public.work_sessions ws
        where ws.shift_id=s.id
      )
      or (oa.kind='late-check-in' and now()>=s.scheduled_start+interval '15 minutes')
    );

  for v_shift in
    select
      s.id,
      s.event_id,
      s.workplace_id,
      s.user_id,
      s.scheduled_start,
      s.scheduled_end
    from public.shifts s
    join public.events e on e.id=s.event_id
    where s.status<>'cancelled'
      and s.response_status<>'declined'
      and coalesce(e.status,'')<>'archived'
      and now()>=s.scheduled_start+interval '10 minutes'
      and now()<s.scheduled_end
      and not exists(
        select 1
        from public.work_sessions ws
        where ws.shift_id=s.id
      )
  loop
    v_kind:=case
      when now()>=v_shift.scheduled_start+interval '15 minutes' then 'no-show'
      else 'late-check-in'
    end;

    v_alert_id:=null;
    insert into upt_private.operational_alerts(
      shift_id,event_id,workplace_id,user_id,kind,metadata
    )
    values(
      v_shift.id,
      v_shift.event_id,
      v_shift.workplace_id,
      v_shift.user_id,
      v_kind,
      jsonb_build_object(
        'scheduled_start',v_shift.scheduled_start,
        'scheduled_end',v_shift.scheduled_end
      )
    )
    on conflict (shift_id,kind) do nothing
    returning id into v_alert_id;

    if v_alert_id is null then
      continue;
    end if;

    v_created:=v_created+1;

    if v_kind='late-check-in' then
      insert into public.crew_notifications(user_id,title,body,link,kind)
      values(
        v_shift.user_id,
        'Dienst gestart',
        'Je dienst is gestart en er is nog geen goedgekeurde start geregistreerd.',
        '/qr',
        'late_check_in'
      );

      select exists(
        select 1
        from public.responsible_assignments ra
        where ra.event_id=v_shift.event_id
          and ra.workplace_id=v_shift.workplace_id
          and ra.user_id<>v_shift.user_id
      ) into v_has_responsible;

      if v_has_responsible then
        insert into public.crew_notifications(user_id,title,body,link,kind)
        select distinct
          ra.user_id,
          'Personeelslid nog niet gestart',
          'Een geplande medewerker heeft 10 minuten na de starttijd nog geen goedgekeurde start.',
          '/operations',
          'late_check_in'
        from public.responsible_assignments ra
        where ra.event_id=v_shift.event_id
          and ra.workplace_id=v_shift.workplace_id
          and ra.user_id<>v_shift.user_id;
      else
        insert into public.crew_notifications(user_id,title,body,link,kind)
        select
          p.id,
          'Personeelslid nog niet gestart',
          'Een geplande medewerker heeft 10 minuten na de starttijd nog geen goedgekeurde start.',
          '/operations',
          'late_check_in'
        from public.profiles p
        where p.approved=true
          and p.role='admin'
          and p.id<>v_shift.user_id;
      end if;
    else
      insert into public.crew_notifications(user_id,title,body,link,kind)
      select distinct
        target.user_id,
        'No-show gedetecteerd',
        'Een geplande medewerker heeft 15 minuten na de starttijd nog geen goedgekeurde start.',
        '/operations',
        'no_show'
      from (
        select ra.user_id
        from public.responsible_assignments ra
        where ra.event_id=v_shift.event_id
          and ra.workplace_id=v_shift.workplace_id
          and ra.user_id<>v_shift.user_id
        union
        select p.id
        from public.profiles p
        where p.approved=true
          and p.role='admin'
          and p.id<>v_shift.user_id
      ) target;
    end if;
  end loop;

  return v_created;
end;
$function$;

revoke all on function upt_private.refresh_operational_alerts() from public, anon, authenticated;

create or replace function public.upt_operational_alerts()
returns table(
  id uuid,
  shift_id uuid,
  event_id uuid,
  workplace_id uuid,
  user_id uuid,
  kind text,
  detected_at timestamptz,
  planned_start timestamptz,
  planned_end timestamptz
)
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
  select
    oa.id,
    oa.shift_id,
    oa.event_id,
    oa.workplace_id,
    oa.user_id,
    oa.kind,
    oa.detected_at,
    s.scheduled_start as planned_start,
    s.scheduled_end as planned_end
  from upt_private.operational_alerts oa
  join public.shifts s on s.id=oa.shift_id
  where oa.resolved_at is null
    and public.upt_is_approved()
    and (
      public.upt_is_admin(auth.uid())
      or public.upt_is_responsible(oa.event_id,oa.workplace_id,auth.uid())
    )
  order by
    case oa.kind when 'no-show' then 0 else 1 end,
    oa.detected_at asc;
$function$;

revoke all on function public.upt_operational_alerts() from public, anon;
grant execute on function public.upt_operational_alerts() to authenticated;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname='uptilldawn-operational-alerts'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'uptilldawn-operational-alerts',
    '* * * * *',
    'select upt_private.refresh_operational_alerts()'
  );
end
$$;
