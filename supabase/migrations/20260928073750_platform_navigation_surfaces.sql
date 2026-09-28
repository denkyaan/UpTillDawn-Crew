
insert into public.role_ui_rules(
  role,feature_key,label,group_key,visible,enabled,condition_key,sort_order,settings
)
values
  ('admin','control-center','Command Center','navigation',true,true,'always',25,'{}'::jsonb),
  ('admin','knowledge','Kennisbank','navigation',true,true,'always',72,'{}'::jsonb),
  ('responsible_lead','control-center','Command Center','navigation',true,true,'assigned_workplace_role',25,'{}'::jsonb),
  ('responsible_lead','onboarding','Onboarding','navigation',true,true,'assigned_event',45,'{}'::jsonb),
  ('responsible_lead','knowledge','Kennisbank','navigation',true,true,'assigned_event',65,'{}'::jsonb),
  ('staff','onboarding','Onboarding','navigation',true,true,'assigned_event',45,'{}'::jsonb),
  ('staff','knowledge','Kennisbank','navigation',true,true,'assigned_event',65,'{}'::jsonb)
on conflict(role,feature_key) do update set
  label=excluded.label,
  group_key=excluded.group_key,
  visible=excluded.visible,
  enabled=excluded.enabled,
  condition_key=excluded.condition_key,
  sort_order=excluded.sort_order,
  settings=excluded.settings;

notify pgrst,'reload schema';
