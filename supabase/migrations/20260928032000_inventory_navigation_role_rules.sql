-- Promote workplace inventory to a first-class navigation feature.
update public.role_ui_rules
set label='Inventaris',
    group_key='navigation',
    visible=true,
    enabled=true,
    condition_key=case
      when role='admin' then 'always'
      else 'assigned_workplace_role'
    end,
    sort_order=65,
    settings=coalesce(settings,'{}'::jsonb)
where feature_key='inventory'
  and role in ('admin','responsible_lead','staff');

insert into public.role_ui_rules(
  role,feature_key,label,group_key,visible,enabled,condition_key,sort_order,settings
)
values
  ('admin','inventory','Inventaris','navigation',true,true,'always',65,'{}'::jsonb),
  ('responsible_lead','inventory','Inventaris','navigation',true,true,'assigned_workplace_role',65,'{}'::jsonb),
  ('staff','inventory','Inventaris','navigation',true,true,'assigned_workplace_role',65,'{}'::jsonb)
on conflict (role,feature_key) do update
set label=excluded.label,
    group_key=excluded.group_key,
    visible=excluded.visible,
    enabled=excluded.enabled,
    condition_key=excluded.condition_key,
    sort_order=excluded.sort_order;
