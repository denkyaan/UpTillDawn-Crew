create or replace function public.upt_save_automation_rule(
  p_key text,
  p_enabled boolean,
  p_delay_minutes integer,
  p_reminder_minutes integer,
  p_escalation_minutes integer,
  p_cooldown_minutes integer,
  p_max_retries integer,
  p_channels text[]
)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare
  v_actor uuid:=auth.uid();
  v_before jsonb;
  v_channels text[];
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan automatiseringen wijzigen.';
  end if;

  if p_key is null or p_key!~'^[a-z0-9_-]{1,120}$' then raise exception 'Ongeldige automatiseringssleutel.'; end if;
  if p_delay_minutes is null or p_delay_minutes<0 or p_delay_minutes>43200 then raise exception 'Ongeldige vertraging.'; end if;
  if p_reminder_minutes is not null and (p_reminder_minutes<1 or p_reminder_minutes>43200) then raise exception 'Ongeldige remindertijd.'; end if;
  if p_escalation_minutes is not null and (p_escalation_minutes<1 or p_escalation_minutes>43200) then raise exception 'Ongeldige escalatietijd.'; end if;
  if p_cooldown_minutes is null or p_cooldown_minutes<0 or p_cooldown_minutes>43200 then raise exception 'Ongeldige cooldown.'; end if;
  if p_max_retries is null or p_max_retries<0 or p_max_retries>20 then raise exception 'Ongeldig aantal retries.'; end if;

  select array_agg(distinct channel order by channel)
  into v_channels
  from unnest(coalesce(p_channels,array[]::text[])) channel
  where channel in('in_app','push','email');

  if coalesce(cardinality(v_channels),0)=0 then v_channels:=array['in_app']::text[]; end if;

  select to_jsonb(r) into v_before
  from public.automation_rules r
  where r.automation_key=p_key
  for update;

  if v_before is null then raise exception 'Automatisering niet gevonden.'; end if;

  update public.automation_rules
  set enabled=p_enabled,
      delay_minutes=p_delay_minutes,
      reminder_minutes=p_reminder_minutes,
      escalation_minutes=p_escalation_minutes,
      cooldown_minutes=p_cooldown_minutes,
      max_retries=p_max_retries,
      channels=v_channels,
      updated_at=now(),
      updated_by=v_actor
  where automation_key=p_key;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(
    v_actor,
    'automation.rule.updated',
    'automation_rule',
    null,
    jsonb_build_object(
      'automationKey',p_key,
      'before',v_before - 'description' - 'label',
      'after',jsonb_build_object(
        'enabled',p_enabled,
        'delayMinutes',p_delay_minutes,
        'reminderMinutes',p_reminder_minutes,
        'escalationMinutes',p_escalation_minutes,
        'cooldownMinutes',p_cooldown_minutes,
        'maxRetries',p_max_retries,
        'channels',v_channels
      )
    )
  );
end;
$$;

revoke all on function public.upt_save_automation_rule(text,boolean,integer,integer,integer,integer,integer,text[]) from public,anon;
grant execute on function public.upt_save_automation_rule(text,boolean,integer,integer,integer,integer,integer,text[]) to authenticated;

notify pgrst,'reload schema';
