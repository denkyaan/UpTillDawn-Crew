update public.role_ui_rules
set label='Werkplaatsen & shifts',
    visible=true,
    enabled=true,
    sort_order=40,
    condition_key=case
      when role='admin' then 'always'
      when role='responsible_lead' then 'assigned_workplace_role'
      else 'assigned_event'
    end,
    updated_at=now()
where feature_key='workplaces';

update public.role_ui_rules
set visible=false,
    enabled=false,
    condition_key='never',
    updated_at=now()
where feature_key='shifts';

update public.crew_notifications
set link='/workplaces'
where link='/shifts' or link like '/shifts?%';

notify pgrst,'reload schema';
