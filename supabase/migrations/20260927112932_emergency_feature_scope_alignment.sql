update public.role_ui_rules
set condition_key='always',updated_at=now()
where feature_key='emergency'
  and role in ('staff','responsible_lead')
  and condition_key='assigned_event';
