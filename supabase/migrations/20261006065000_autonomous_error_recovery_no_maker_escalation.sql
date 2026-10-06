-- Error reports are operational telemetry, not maker tasks.
-- Route every stuck/previous maker escalation back into autonomous technical recovery.

create or replace function upt_private.escalate_stuck_error_reports()
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare v_row record; v_count integer:=0;
begin
  for v_row in
    select id
    from public.user_error_reports
    where (status='reported' and created_at<now()-interval '5 minutes')
       or (status='processing' and updated_at<now()-interval '10 minutes')
       or status in ('needs_maker','maker_working')
    for update skip locked
  loop
    update public.user_error_reports
    set status='failed',
        maker_action_required=false,
        maker_action=null,
        maker_notified_at=null,
        god_prompt=coalesce(god_prompt,'Autonoom technisch herstel vereist; valideer oorzaak, tests, CI en deploy zonder makerinterventie.'),
        ai_user_message=coalesce(ai_user_message,'De fout blijft geregistreerd voor automatische technische opvolging.'),
        updated_at=now()
    where id=v_row.id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end
$fn$;

revoke all on function upt_private.escalate_stuck_error_reports() from public,anon,authenticated;

-- Remove obsolete maker-action notifications. They no longer represent a valid workflow.
delete from public.crew_notifications where kind='error_report_maker';

update public.user_error_reports
set maker_action_required=false,
    maker_action=null,
    maker_notified_at=null,
    status=case when status in ('needs_maker','maker_working') then 'failed' else status end,
    updated_at=now()
where maker_action_required=true or status in ('needs_maker','maker_working');

notify pgrst,'reload schema';
