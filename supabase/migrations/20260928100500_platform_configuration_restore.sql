-- Restore a previously captured platform configuration snapshot.
create or replace function public.upt_restore_platform_configuration(p_version uuid)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_snapshot jsonb;
  v_row jsonb;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan configuratie herstellen.';
  end if;

  select snapshot into v_snapshot
  from public.configuration_versions
  where id=p_version
  for share;
  if v_snapshot is null then raise exception 'Configuratieversie niet gevonden.'; end if;

  for v_row in select * from jsonb_array_elements(coalesce(v_snapshot->'featureRollouts','[]'::jsonb))
  loop
    insert into public.feature_rollouts(feature_key,enabled,audience,rollout_percentage,notes,updated_by,updated_at)
    values(
      v_row->>'feature_key',
      coalesce((v_row->>'enabled')::boolean,false),
      coalesce(v_row->>'audience','all'),
      coalesce((v_row->>'rollout_percentage')::integer,100),
      nullif(v_row->>'notes',''),
      v_actor,
      now()
    )
    on conflict(feature_key) do update set
      enabled=excluded.enabled,
      audience=excluded.audience,
      rollout_percentage=excluded.rollout_percentage,
      notes=excluded.notes,
      updated_by=v_actor,
      updated_at=now();
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(v_snapshot->'roleUiRules','[]'::jsonb))
  loop
    insert into public.role_ui_rules(role,feature_key,label,group_key,visible,enabled,condition_key,sort_order,settings)
    values(
      v_row->>'role',
      v_row->>'feature_key',
      v_row->>'label',
      v_row->>'group_key',
      coalesce((v_row->>'visible')::boolean,true),
      coalesce((v_row->>'enabled')::boolean,true),
      v_row->>'condition_key',
      coalesce((v_row->>'sort_order')::integer,0),
      coalesce(v_row->'settings','{}'::jsonb)
    )
    on conflict(role,feature_key) do update set
      label=excluded.label,
      group_key=excluded.group_key,
      visible=excluded.visible,
      enabled=excluded.enabled,
      condition_key=excluded.condition_key,
      sort_order=excluded.sort_order,
      settings=excluded.settings;
  end loop;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'platform.configuration.restored','configuration_version',p_version,jsonb_build_object('restored_at',now()));
end;
$fn$;
revoke all on function public.upt_restore_platform_configuration(uuid) from public,anon;
grant execute on function public.upt_restore_platform_configuration(uuid) to authenticated;
notify pgrst,'reload schema';
