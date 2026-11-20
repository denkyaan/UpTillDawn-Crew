update public.role_ui_rules
set visible=true,
    enabled=true,
    condition_key=case
      when role='admin' then 'always'
      else 'assigned_event'
    end,
    updated_at=now()
where feature_key='shifts';

notify pgrst,'reload schema';
