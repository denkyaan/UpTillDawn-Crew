-- Personalize the automatic organization-chat birthday greeting with the birthday person's profile name.
-- The stored canonical message remains Dutch; chat runtime localization translates the sentence
-- to NL/FR/EN/DE while preserving the person's name exactly.

create or replace function upt_private.run_birthday_greetings()
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare
  v_today date := (now() at time zone 'Europe/Brussels')::date;
  v_person record;
  v_channel uuid;
  v_notification uuid;
  v_message uuid;
  v_processed integer := 0;
  v_chat_body text;
begin
  select c.id into v_channel
  from public.chat_channels c
  where c.kind='organization'
  order by c.created_at,c.id
  limit 1;

  for v_person in
    select p.id,trim(p.full_name) as full_name
    from public.profiles p
    where p.approved=true
      and coalesce(p.account_blocked,false)=false
      and p.date_of_birth is not null
      and nullif(trim(p.full_name),'') is not null
      and extract(month from p.date_of_birth)=extract(month from v_today)
      and extract(day from p.date_of_birth)=extract(day from v_today)
  loop
    insert into upt_private.birthday_greeting_deliveries(user_id,birthday_date)
    values(v_person.id,v_today)
    on conflict(user_id,birthday_date) do nothing;

    select d.notification_id,d.message_id
    into v_notification,v_message
    from upt_private.birthday_greeting_deliveries d
    where d.user_id=v_person.id and d.birthday_date=v_today
    for update;

    if v_notification is null then
      insert into public.crew_notifications(user_id,title,body,kind,link)
      values(v_person.id,'Het is je verjaardag!🥳🎁',null,'birthday','/chat')
      returning id into v_notification;

      update upt_private.birthday_greeting_deliveries
      set notification_id=v_notification,updated_at=now()
      where user_id=v_person.id and birthday_date=v_today;
    end if;

    if v_message is null and v_channel is not null then
      v_chat_body := format(
        'Van harte gefeliciteerd met je verjaardag, %s!🥳 Laat het een fantastische dag zijn en maak er het beste van! 🎉🎉',
        v_person.full_name
      );

      insert into public.messages(user_id,sender_id,channel_id,body,content)
      values(v_person.id,null,v_channel,v_chat_body,v_chat_body)
      returning id into v_message;

      update upt_private.birthday_greeting_deliveries
      set message_id=v_message,updated_at=now()
      where user_id=v_person.id and birthday_date=v_today;
    end if;

    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$$;

revoke all on function upt_private.run_birthday_greetings() from public,anon,authenticated;

notify pgrst,'reload schema';
