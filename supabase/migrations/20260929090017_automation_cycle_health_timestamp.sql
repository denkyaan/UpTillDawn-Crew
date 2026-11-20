create or replace function upt_private.run_automation_cycle()
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare
  v_shift integer:=0;
  v_break boolean:=false;
  v_ops integer:=0;
  v_incidents integer:=0;
  v_platform integer:=0;
  v_anomalies integer:=0;
  v_workflows integer:=0;
begin
  if upt_private.automation_enabled('shift_reminders',true) then v_shift:=upt_private.send_shift_reminders(); end if;
  if upt_private.automation_enabled('break_reminders',true) then perform upt_private.notify_break_allowance(); v_break:=true; end if;
  if upt_private.automation_enabled('operational_alerts',true) then v_ops:=upt_private.refresh_operational_alerts(); end if;
  if upt_private.automation_enabled('incident_escalation',true) then v_incidents:=upt_private.refresh_incident_escalations(); end if;
  if upt_private.automation_enabled('platform_intelligence',true) then v_platform:=upt_private.refresh_platform_intelligence(); end if;
  if upt_private.automation_enabled('data_anomalies',true) then v_anomalies:=upt_private.refresh_data_anomalies(); end if;
  v_workflows:=upt_private.refresh_admin_workflow_automations();

  update public.automation_rules
  set last_run_at=now()
  where enabled=true;

  return jsonb_build_object(
    'shiftReminders',v_shift,'breakRemindersExecuted',v_break,'operationalAlerts',v_ops,
    'incidentEscalations',v_incidents,'platformIntelligence',v_platform,
    'dataAnomalies',v_anomalies,'workflowNotifications',v_workflows
  );
end;
$$;

revoke all on function upt_private.run_automation_cycle() from public,anon,authenticated;
notify pgrst,'reload schema';
