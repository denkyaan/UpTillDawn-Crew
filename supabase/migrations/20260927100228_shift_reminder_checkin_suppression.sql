create or replace function upt_private.send_shift_reminders()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_shift record;
  v_kind text;
  v_receipt boolean;
  v_count integer:=0;
begin
  for v_shift in
    select
      s.id,
      s.user_id,
      s.scheduled_start,
      s.scheduled_end,
      s.confirmed_at,
      coalesce(s.confirmation_revision,s.created_at) as revision_at,
      e.name as event_name,
      w.name as workplace_name
    from public.shifts s
    join public.events e on e.id=s.event_id
    join public.workplaces w on w.id=s.workplace_id
    join public.profiles p on p.id=s.user_id
    where s.status<>'cancelled'
      and s.response_status='accepted'
      and s.confirmed_at is not null
      and s.confirmed_at>=coalesce(s.confirmation_revision,s.created_at)
      and p.approved=true
      and coalesce(e.status,'')<>'archived'
      and s.scheduled_start>now()
      and s.scheduled_start<=now()+interval '24 hours'
      and not exists(
        select 1
        from public.work_sessions ws
        where ws.shift_id=s.id
      )
      and not exists(
        select 1
        from public.check_ins ci
        where ci.shift_id=s.id
          and ci.status in ('pending','approved')
      )
    order by s.scheduled_start
  loop
    v_kind:=case
      when v_shift.scheduled_start<=now()+interval '15 minutes' then 'start-soon'
      when v_shift.scheduled_start<=now()+interval '2 hours' then 'hours-before'
      else 'day-before'
    end;

    v_receipt:=false;
    insert into upt_private.shift_reminder_receipts(
      shift_id,user_id,kind,revision_at
    )
    values(
      v_shift.id,
      v_shift.user_id,
      v_kind,
      v_shift.revision_at
    )
    on conflict do nothing
    returning true into v_receipt;

    if not coalesce(v_receipt,false) then
      continue;
    end if;

    insert into public.crew_notifications(user_id,title,body,kind,link)
    values(
      v_shift.user_id,
      case v_kind
        when 'day-before' then 'Shift binnen 24 uur'
        when 'hours-before' then 'Shift binnen 2 uur'
        else 'Shift start binnenkort'
      end,
      case v_kind
        when 'day-before' then
          v_shift.event_name||' · '||v_shift.workplace_name||' start binnen 24 uur.'
        when 'hours-before' then
          v_shift.event_name||' · '||v_shift.workplace_name||' start binnen 2 uur.'
        else
          v_shift.event_name||' · '||v_shift.workplace_name||' start binnen 15 minuten. Gebruik de QR-flow bij aankomst.'
      end,
      'shift_reminder',
      '/shifts'
    );

    v_count:=v_count+1;
  end loop;

  return v_count;
end;
$function$;

revoke all on function upt_private.send_shift_reminders()
from public,anon,authenticated;
