insert into public.role_ui_rules(role,feature_key,label,group_key,visible,enabled,condition_key,sort_order,settings)
values('admin','platform','Platform Center','navigation',true,true,'always',125,'{}'::jsonb)
on conflict(role,feature_key) do update set
label=excluded.label,group_key=excluded.group_key,visible=true,enabled=true,condition_key='always',sort_order=excluded.sort_order,settings=excluded.settings;
notify pgrst,'reload schema';
