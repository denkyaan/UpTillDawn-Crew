create index if not exists birthday_greeting_deliveries_notification_idx
  on upt_private.birthday_greeting_deliveries(notification_id)
  where notification_id is not null;

create index if not exists birthday_greeting_deliveries_message_idx
  on upt_private.birthday_greeting_deliveries(message_id)
  where message_id is not null;
