alter table upt_private.operational_alerts
  drop constraint if exists operational_alerts_kind_check;

alter table upt_private.operational_alerts
  add constraint operational_alerts_kind_check
  check (kind in (
    'late-check-in',
    'no-show',
    'understaffed',
    'shift-overrun',
    'missing-checkout',
    'long-break'
  ));

create or replace function upt_private.notify_break_allowance()
returns void
language plpgsql
set search_path to 'public','upt_private'
as $function$
declare
  active record;
  seconds numeric;
  inserted boolean;
begin
  for active in
    select
      ws.user_id,
      ws.event_id
    from public.work_sessions ws
    join public.break_sessions b
      on b.work_session_id=ws.id
     and b.ended_at is null
    join public.profiles p
      on p.id=ws.user_id
     and p.approved
    where ws.ended_at is null
  loop
    select coalesce(sum(greatest(
      0,
      extract(epoch from (
        least(coalesce(b.ended_at,now()),coalesce(ws.ended_at,now()))
        - greatest(b.started_at,ws.started_at)
      ))
    )),0)
    into seconds
    from public.work_sessions ws
    join public.break_sessions b on b.work_session_id=ws.id
    where ws.user_id=active.user_id
      and ws.event_id=active.event_id;

    if seconds>=3300 then
      inserted:=false;
      insert into upt_private.break_warning_receipts(user_id,event_id,kind)
      values(active.user_id,active.event_id,'staff_55')
      on conflict do nothing
      returning true into inserted;

      if inserted then
        insert into public.crew_notifications(user_id,title,body,kind,link)
        values(
          active.user_id,
          'Pauzetegoed bijna op',
          'Je hebt minstens 55 minuten pauze gebruikt. Alleen pauze boven 60 minuten wordt afgetrokken.',
          'break_warning',
          '/operations'
        );
      end if;
    end if;
  end loop;
end;
$function$;

revoke all on function upt_private.notify_break_allowance()
from public,anon,authenticated;

create or replace function upt_private.refresh_operational_alerts()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_shift record;
  v_workplace record;
  v_runtime record;
  v_alert_id uuid;
  v_kind text;
  v_created integer:=0;
  v_has_responsible boolean;
  v_existing_resolved timestamptz;
  v_threshold integer;
  v_observed integer;
begin
  update upt_private.operational_alerts oa
  set resolved_at=coalesce(oa.resolved_at,now())
  from public.shifts s
  where oa.shift_id=s.id
    and oa.kind in ('late-check-in','no-show')
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

  update upt_private.operational_alerts oa
  set resolved_at=coalesce(oa.resolved_at,now())
  where oa.kind='understaffed'
    and oa.resolved_at is null
    and not exists(
      select 1
      from public.workplaces w
      join public.events e on e.id=w.event_id
      where w.id=oa.workplace_id
        and w.event_id=oa.event_id
        and w.is_active=true
        and w.minimum_staff>0
        and coalesce(e.status,'')<>'archived'
        and now() between e.start_at and e.end_at
        and upt_private.active_staff_count(w.event_id,w.id)<w.minimum_staff
    );

  update upt_private.operational_alerts oa
  set resolved_at=coalesce(oa.resolved_at,now())
  where oa.kind in ('shift-overrun','missing-checkout','long-break')
    and oa.resolved_at is null
    and not exists(
      select 1
      from public.work_sessions ws
      join public.shifts s on s.id=ws.shift_id
      where s.id=oa.shift_id
        and ws.user_id=oa.user_id
        and ws.ended_at is null
        and (
          (
            oa.kind='shift-overrun'
            and now()>=s.scheduled_end+interval '10 minutes'
            and now()<s.scheduled_end+interval '20 minutes'
            and not exists(
              select 1
              from public.check_outs co
              where co.user_id=ws.user_id
                and co.status='pending'
                and (
                  co.work_session_id=ws.id
                  or (co.work_session_id is null and co.event_id=ws.event_id)
                )
            )
          )
          or (
            oa.kind='missing-checkout'
            and now()>=s.scheduled_end+interval '20 minutes'
            and not exists(
              select 1
              from public.check_outs co
              where co.user_id=ws.user_id
                and co.status='pending'
                and (
                  co.work_session_id=ws.id
                  or (co.work_session_id is null and co.event_id=ws.event_id)
                )
            )
          )
          or (
            oa.kind='long-break'
            and exists(
              select 1
              from public.break_sessions active_break
              where active_break.work_session_id=ws.id
                and active_break.ended_at is null
            )
            and (
              select coalesce(sum(greatest(
                0,
                extract(epoch from (
                  least(coalesce(b.ended_at,now()),coalesce(event_ws.ended_at,now()))
                  - greatest(b.started_at,event_ws.started_at)
                ))
              )),0)
              from public.work_sessions event_ws
              join public.break_sessions b on b.work_session_id=event_ws.id
              where event_ws.user_id=ws.user_id
                and event_ws.event_id=ws.event_id
            )>=4200
          )
        )
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

  for v_runtime in
    select
      ws.id as session_id,
      ws.user_id,
      ws.event_id,
      ws.shift_id,
      s.scheduled_end,
      upt_private.current_session_workplace(ws.id) as workplace_id,
      exists(
        select 1
        from public.check_outs co
        where co.user_id=ws.user_id
          and co.status='pending'
          and (
            co.work_session_id=ws.id
            or (co.work_session_id is null and co.event_id=ws.event_id)
          )
      ) as pending_checkout,
      (
        select max(b.started_at)
        from public.break_sessions b
        where b.work_session_id=ws.id
          and b.ended_at is null
      ) as active_break_started_at,
      floor((
        select coalesce(sum(greatest(
          0,
          extract(epoch from (
            least(coalesce(b.ended_at,now()),coalesce(event_ws.ended_at,now()))
            - greatest(b.started_at,event_ws.started_at)
          ))
        )),0)
        from public.work_sessions event_ws
        join public.break_sessions b on b.work_session_id=event_ws.id
        where event_ws.user_id=ws.user_id
          and event_ws.event_id=ws.event_id
      )/60)::integer as break_minutes
    from public.work_sessions ws
    join public.shifts s on s.id=ws.shift_id
    join public.events e on e.id=ws.event_id
    where ws.ended_at is null
      and s.status<>'cancelled'
      and s.response_status<>'declined'
      and coalesce(e.status,'')<>'archived'
  loop
    if not v_runtime.pending_checkout and now()>=v_runtime.scheduled_end+interval '10 minutes' then
      if now()>=v_runtime.scheduled_end+interval '20 minutes' then
        v_kind:='missing-checkout';
        v_threshold:=20;
      else
        v_kind:='shift-overrun';
        v_threshold:=10;
      end if;

      v_observed:=greatest(0,floor(extract(epoch from(now()-v_runtime.scheduled_end))/60)::integer);

      if v_kind='missing-checkout' then
        update upt_private.operational_alerts
        set resolved_at=coalesce(resolved_at,now())
        where shift_id=v_runtime.shift_id
          and kind='shift-overrun'
          and resolved_at is null;
      end if;

      select oa.id,oa.resolved_at
      into v_alert_id,v_existing_resolved
      from upt_private.operational_alerts oa
      where oa.shift_id=v_runtime.shift_id
        and oa.kind=v_kind
      limit 1;

      if v_alert_id is null then
        insert into upt_private.operational_alerts(
          shift_id,event_id,workplace_id,user_id,kind,metadata
        )
        values(
          v_runtime.shift_id,
          v_runtime.event_id,
          v_runtime.workplace_id,
          v_runtime.user_id,
          v_kind,
          jsonb_build_object(
            'observed_minutes',v_observed,
            'threshold_minutes',v_threshold
          )
        )
        returning id into v_alert_id;
      elsif v_existing_resolved is not null then
        update upt_private.operational_alerts
        set workplace_id=v_runtime.workplace_id,
            user_id=v_runtime.user_id,
            detected_at=now(),
            resolved_at=null,
            metadata=jsonb_build_object(
              'observed_minutes',v_observed,
              'threshold_minutes',v_threshold
            )
        where id=v_alert_id;
      else
        update upt_private.operational_alerts
        set workplace_id=v_runtime.workplace_id,
            metadata=jsonb_build_object(
              'observed_minutes',v_observed,
              'threshold_minutes',v_threshold
            )
        where id=v_alert_id;
        v_alert_id:=null;
      end if;

      if v_alert_id is not null then
        v_created:=v_created+1;

        if v_kind='shift-overrun' then
          insert into public.crew_notifications(user_id,title,body,link,kind)
          values(
            v_runtime.user_id,
            'Shift voorbij',
            'Je geplande eindtijd is voorbij. Vraag je stopuren aan via de QR-flow.',
            '/qr',
            'shift_overrun'
          );

          select exists(
            select 1
            from public.responsible_assignments ra
            where ra.event_id=v_runtime.event_id
              and ra.workplace_id=v_runtime.workplace_id
              and ra.user_id<>v_runtime.user_id
          ) into v_has_responsible;

          if v_has_responsible then
            insert into public.crew_notifications(user_id,title,body,link,kind)
            select distinct
              ra.user_id,
              'Shift loopt door',
              'Een medewerker werkt meer dan 10 minuten na de geplande eindtijd zonder stopaanvraag.',
              '/operations',
              'shift_overrun'
            from public.responsible_assignments ra
            where ra.event_id=v_runtime.event_id
              and ra.workplace_id=v_runtime.workplace_id
              and ra.user_id<>v_runtime.user_id;
          else
            insert into public.crew_notifications(user_id,title,body,link,kind)
            select
              p.id,
              'Shift loopt door',
              'Een medewerker werkt meer dan 10 minuten na de geplande eindtijd zonder stopaanvraag.',
              '/operations',
              'shift_overrun'
            from public.profiles p
            where p.approved=true
              and p.role='admin'
              and p.id<>v_runtime.user_id;
          end if;
        else
          insert into public.crew_notifications(user_id,title,body,link,kind)
          values(
            v_runtime.user_id,
            'Stopuren ontbreken',
            'Je shift is meer dan 20 minuten voorbij en er is nog geen stopaanvraag geregistreerd.',
            '/qr',
            'missing_checkout'
          );

          insert into public.crew_notifications(user_id,title,body,link,kind)
          select distinct
            target.user_id,
            'Stopuren ontbreken',
            'Een medewerker werkt meer dan 20 minuten na de geplande eindtijd zonder stopaanvraag.',
            '/operations',
            'missing_checkout'
          from (
            select ra.user_id
            from public.responsible_assignments ra
            where ra.event_id=v_runtime.event_id
              and ra.workplace_id=v_runtime.workplace_id
              and ra.user_id<>v_runtime.user_id
            union
            select p.id
            from public.profiles p
            where p.approved=true
              and p.role='admin'
              and p.id<>v_runtime.user_id
          ) target;
        end if;
      end if;
    end if;

    if v_runtime.active_break_started_at is not null and v_runtime.break_minutes>=70 then
      v_kind:='long-break';
      v_threshold:=70;
      v_observed:=v_runtime.break_minutes;

      select oa.id,oa.resolved_at
      into v_alert_id,v_existing_resolved
      from upt_private.operational_alerts oa
      where oa.shift_id=v_runtime.shift_id
        and oa.kind=v_kind
      limit 1;

      if v_alert_id is null then
        insert into upt_private.operational_alerts(
          shift_id,event_id,workplace_id,user_id,kind,metadata
        )
        values(
          v_runtime.shift_id,
          v_runtime.event_id,
          v_runtime.workplace_id,
          v_runtime.user_id,
          v_kind,
          jsonb_build_object(
            'observed_minutes',v_observed,
            'threshold_minutes',v_threshold,
            'active_break_started_at',v_runtime.active_break_started_at
          )
        )
        returning id into v_alert_id;
      elsif v_existing_resolved is not null then
        update upt_private.operational_alerts
        set workplace_id=v_runtime.workplace_id,
            user_id=v_runtime.user_id,
            detected_at=now(),
            resolved_at=null,
            metadata=jsonb_build_object(
              'observed_minutes',v_observed,
              'threshold_minutes',v_threshold,
              'active_break_started_at',v_runtime.active_break_started_at
            )
        where id=v_alert_id;
      else
        update upt_private.operational_alerts
        set workplace_id=v_runtime.workplace_id,
            metadata=jsonb_build_object(
              'observed_minutes',v_observed,
              'threshold_minutes',v_threshold,
              'active_break_started_at',v_runtime.active_break_started_at
            )
        where id=v_alert_id;
        v_alert_id:=null;
      end if;

      if v_alert_id is not null then
        v_created:=v_created+1;

        insert into public.crew_notifications(user_id,title,body,link,kind)
        select distinct
          target.user_id,
          'Pauze langer dan 70 minuten',
          'Een medewerker heeft tijdens dit evenement minstens 70 minuten pauze gebruikt en staat nog op pauze.',
          '/operations',
          'long_break'
        from (
          select ra.user_id
          from public.responsible_assignments ra
          where ra.event_id=v_runtime.event_id
            and ra.workplace_id=v_runtime.workplace_id
            and ra.user_id<>v_runtime.user_id
          union
          select p.id
          from public.profiles p
          where p.approved=true
            and p.role='admin'
            and p.id<>v_runtime.user_id
        ) target;
      end if;
    end if;
  end loop;

  for v_workplace in
    select
      w.id as workplace_id,
      w.event_id,
      w.name as workplace_name,
      w.minimum_staff,
      upt_private.active_staff_count(w.event_id,w.id) as active_staff
    from public.workplaces w
    join public.events e on e.id=w.event_id
    where w.is_active=true
      and w.minimum_staff>0
      and coalesce(e.status,'')<>'archived'
      and now() between e.start_at and e.end_at
  loop
    if v_workplace.active_staff>=v_workplace.minimum_staff then
      continue;
    end if;

    select oa.id into v_alert_id
    from upt_private.operational_alerts oa
    where oa.event_id=v_workplace.event_id
      and oa.workplace_id=v_workplace.workplace_id
      and oa.kind='understaffed'
      and oa.resolved_at is null
    limit 1;

    if v_alert_id is not null then
      update upt_private.operational_alerts
      set metadata=jsonb_build_object(
        'active_staff',v_workplace.active_staff,
        'minimum_staff',v_workplace.minimum_staff
      )
      where id=v_alert_id;
      continue;
    end if;

    insert into upt_private.operational_alerts(
      shift_id,event_id,workplace_id,user_id,kind,metadata
    )
    values(
      null,
      v_workplace.event_id,
      v_workplace.workplace_id,
      null,
      'understaffed',
      jsonb_build_object(
        'active_staff',v_workplace.active_staff,
        'minimum_staff',v_workplace.minimum_staff
      )
    )
    returning id into v_alert_id;

    v_created:=v_created+1;

    insert into public.crew_notifications(user_id,title,body,link,kind)
    select distinct
      target.user_id,
      'Werkplek onderbezet',
      'Actieve bezetting op '||v_workplace.workplace_name||': '
        ||v_workplace.active_staff||'/'||v_workplace.minimum_staff||'.',
      '/operations',
      'understaffed'
    from (
      select ra.user_id
      from public.responsible_assignments ra
      where ra.event_id=v_workplace.event_id
        and ra.workplace_id=v_workplace.workplace_id
      union
      select p.id
      from public.profiles p
      where p.approved=true
        and p.role='admin'
    ) target;
  end loop;

  return v_created;
end;
$function$;

revoke all on function upt_private.refresh_operational_alerts()
from public,anon,authenticated;

drop function if exists public.upt_operational_alerts();

create function public.upt_operational_alerts()
returns table(
  id uuid,
  shift_id uuid,
  event_id uuid,
  workplace_id uuid,
  user_id uuid,
  kind text,
  detected_at timestamptz,
  planned_start timestamptz,
  planned_end timestamptz,
  active_staff integer,
  minimum_staff integer,
  observed_minutes integer,
  threshold_minutes integer
)
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  select
    oa.id,
    oa.shift_id,
    oa.event_id,
    oa.workplace_id,
    oa.user_id,
    oa.kind,
    oa.detected_at,
    coalesce(s.scheduled_start,e.start_at) as planned_start,
    coalesce(s.scheduled_end,e.end_at) as planned_end,
    case
      when oa.kind='understaffed'
        then nullif(oa.metadata->>'active_staff','')::integer
      else null
    end as active_staff,
    case
      when oa.kind='understaffed'
        then nullif(oa.metadata->>'minimum_staff','')::integer
      else null
    end as minimum_staff,
    case
      when oa.kind in ('shift-overrun','missing-checkout','long-break')
        then nullif(oa.metadata->>'observed_minutes','')::integer
      else null
    end as observed_minutes,
    case
      when oa.kind in ('shift-overrun','missing-checkout','long-break')
        then nullif(oa.metadata->>'threshold_minutes','')::integer
      else null
    end as threshold_minutes
  from upt_private.operational_alerts oa
  join public.events e on e.id=oa.event_id
  left join public.shifts s on s.id=oa.shift_id
  where oa.resolved_at is null
    and public.upt_is_approved()
    and (
      public.upt_is_admin(auth.uid())
      or public.upt_is_responsible(oa.event_id,oa.workplace_id,auth.uid())
    )
  order by
    case oa.kind
      when 'missing-checkout' then 0
      when 'no-show' then 1
      when 'long-break' then 2
      when 'understaffed' then 3
      when 'shift-overrun' then 4
      else 5
    end,
    oa.detected_at asc;
$$;

revoke all on function public.upt_operational_alerts() from public,anon;
grant execute on function public.upt_operational_alerts() to authenticated;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname='uptilldawn-break-allowance'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

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
    'select upt_private.notify_break_allowance(), upt_private.refresh_operational_alerts(), upt_private.refresh_incident_escalations()'
  );
end
$$;
