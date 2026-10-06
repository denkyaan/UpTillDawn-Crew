alter table upt_private.operational_alerts
  alter column shift_id drop not null,
  alter column user_id drop not null;

alter table upt_private.operational_alerts
  drop constraint if exists operational_alerts_kind_check;

alter table upt_private.operational_alerts
  add constraint operational_alerts_kind_check
  check (kind in ('late-check-in','no-show','understaffed'));

create unique index if not exists operational_alerts_open_understaffed_idx
on upt_private.operational_alerts(event_id,workplace_id,kind)
where resolved_at is null and kind='understaffed';

create or replace function upt_private.active_staff_count(
  p_event uuid,
  p_workplace uuid
)
returns integer
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  select count(distinct ws.user_id)::integer
  from public.work_sessions ws
  where ws.event_id=p_event
    and ws.ended_at is null
    and upt_private.current_session_workplace(ws.id)=p_workplace;
$$;

revoke all on function upt_private.active_staff_count(uuid,uuid)
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
  v_alert_id uuid;
  v_kind text;
  v_created integer:=0;
  v_has_responsible boolean;
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
  minimum_staff integer
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
    end as minimum_staff
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
      when 'no-show' then 0
      when 'understaffed' then 1
      else 2
    end,
    oa.detected_at asc;
$$;

revoke all on function public.upt_operational_alerts() from public,anon;
grant execute on function public.upt_operational_alerts() to authenticated;
