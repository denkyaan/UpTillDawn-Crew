create index if not exists operational_alerts_event_idx
on upt_private.operational_alerts(event_id);

create index if not exists operational_alerts_user_idx
on upt_private.operational_alerts(user_id);
