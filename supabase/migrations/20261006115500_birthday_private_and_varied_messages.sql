-- Deliver birthday greetings both privately from Up Till Dawn and in the organization chat.
-- A deterministic yearly rotation chooses one of 12 localized templates. The year is part
-- of the rotation, so a person receives a different template on consecutive birthdays.

alter table upt_private.birthday_greeting_deliveries
  add column if not exists private_message_id uuid null references public.messages(id) on delete set null;

create index if not exists birthday_greeting_deliveries_private_message_idx
  on upt_private.birthday_greeting_deliveries(private_message_id)
  where private_message_id is not null;

create or replace function public.upt_can_read_channel(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $$
  select public.upt_is_approved()
    and exists(
      select 1
      from public.chat_channels c
      where c.id=p_channel
        and (
          c.kind='organization'
          or (
            c.kind='private'
            and c.name='Up Till Dawn · persoonlijk'
            and exists(
              select 1 from public.chat_members cm
              where cm.channel_id=c.id
                and cm.user_id=(select auth.uid())
            )
            and 1=(select count(*) from public.chat_members cm2 where cm2.channel_id=c.id)
          )
          or (
            c.kind='event'
            and c.event_id is not null
            and exists(
              select 1 from public.events e
              where e.id=c.event_id
                and now()>=e.start_at
                and now()<=e.end_at+interval '3 days'
            )
            and (
              public.upt_is_admin()
              or exists(select 1 from public.event_members em where em.event_id=c.event_id and em.user_id=(select auth.uid()))
              or exists(select 1 from public.shifts s where s.event_id=c.event_id and s.user_id=(select auth.uid()) and s.status<>'cancelled' and coalesce(s.response_status,'')<>'declined')
              or exists(select 1 from public.responsible_assignments ra where ra.event_id=c.event_id and ra.user_id=(select auth.uid()))
            )
          )
          or (
            c.kind='workplace'
            and c.event_id is not null
            and c.workplace_id is not null
            and exists(
              select 1 from public.events e
              where e.id=c.event_id
                and now()>=e.start_at
                and now()<=e.end_at+interval '3 days'
            )
            and (
              public.upt_is_admin()
              or public.upt_is_responsible(c.event_id,c.workplace_id,(select auth.uid()))
              or exists(select 1 from public.shifts s where s.event_id=c.event_id and s.workplace_id=c.workplace_id and s.user_id=(select auth.uid()) and s.status<>'cancelled' and coalesce(s.response_status,'')<>'declined')
            )
          )
        )
    );
$$;

revoke all on function public.upt_can_read_channel(uuid) from public,anon;
grant execute on function public.upt_can_read_channel(uuid) to authenticated;

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
  v_private_channel uuid;
  v_notification uuid;
  v_message uuid;
  v_private_message uuid;
  v_processed integer := 0;
  v_variant integer;
  v_chat_body text;
  v_content text;
  v_variants constant text[] := array[
    '🥳 Vandaag vieren we {name}! Van harte gefeliciteerd met je verjaardag. Geniet van alle mooie momenten en maak er een topdag van! 🎉🎂',
    '🎉 Hiep hiep hoera voor {name}! Een hele fijne verjaardag gewenst vol plezier, goeie vibes en onvergetelijke momenten! 🥳🎁',
    '🎂 Vandaag staat {name} in de spotlight! Gefeliciteerd met je verjaardag en geniet volop van jouw speciale dag! ✨🥳',
    '🎈 Feestmodus aan voor {name}! Van harte gefeliciteerd en maak van vandaag een dag om niet te vergeten! 🥳🎉',
    '🥂 Een dikke verjaardagswens voor {name}! Geniet van je dag, lach veel en maak mooie herinneringen! 🎂🎊',
    '🌟 Vandaag draait alles om {name}! Gefeliciteerd met je verjaardag en maak er iets fantastisch van! 🥳🎁',
    '🎁 Happy birthday vibes voor {name}! We wensen je een dag vol geluk, plezier en alles waar je blij van wordt! 🎉🥳',
    '🎊 Tijd om {name} te vieren! Van harte gefeliciteerd en geniet van elke seconde van je verjaardag! 🎂✨',
    '🥳 Een extra feestelijke dag voor {name}! Gefeliciteerd en hopelijk wordt vandaag minstens zo geweldig als jij! 🎉🎈',
    '🎂 Kaarsjes, goeie vibes en feest voor {name}! Van harte gefeliciteerd en geniet maximaal van je verjaardag! 🥳🎁',
    '✨ Vandaag is van {name}! Gefeliciteerd met je verjaardag en maak er samen met iedereen een onvergetelijke dag van! 🎉🎂',
    '🎉 Groot feest voor {name}! We wensen je een fantastische verjaardag vol plezier, mooie verrassingen en goeie herinneringen! 🥳🎁'
  ];
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

    select d.notification_id,d.message_id,d.private_message_id
    into v_notification,v_message,v_private_message
    from upt_private.birthday_greeting_deliveries d
    where d.user_id=v_person.id and d.birthday_date=v_today
    for update;

    v_variant := 1 + mod(
      extract(year from v_today)::integer
      + get_byte(decode(md5(v_person.id::text),'hex'),0)
      + get_byte(decode(md5(v_person.id::text),'hex'),1),
      12
    );
    v_chat_body := replace(v_variants[v_variant],'{name}',v_person.full_name);
    v_content := 'upt-birthday:v2:'||v_variant::text||':'||v_person.full_name;

    if v_notification is null then
      insert into public.crew_notifications(user_id,title,body,kind,link)
      values(v_person.id,'Het is je verjaardag!🥳🎁',null,'birthday','/chat?private=1')
      returning id into v_notification;

      update upt_private.birthday_greeting_deliveries
      set notification_id=v_notification,updated_at=now()
      where user_id=v_person.id and birthday_date=v_today;
    end if;

    if v_message is null and v_channel is not null then
      insert into public.messages(user_id,sender_id,channel_id,body,content)
      values(v_person.id,null,v_channel,v_chat_body,v_content)
      returning id into v_message;

      update upt_private.birthday_greeting_deliveries
      set message_id=v_message,updated_at=now()
      where user_id=v_person.id and birthday_date=v_today;
    end if;

    if v_private_message is null then
      perform pg_advisory_xact_lock(hashtextextended('birthday-private:'||v_person.id::text,0));

      select c.id into v_private_channel
      from public.chat_channels c
      join public.chat_members mine
        on mine.channel_id=c.id
       and mine.user_id=v_person.id
      where c.kind='private'
        and c.name='Up Till Dawn · persoonlijk'
        and 1=(select count(*) from public.chat_members members where members.channel_id=c.id)
      order by c.created_at,c.id
      limit 1;

      if v_private_channel is null then
        insert into public.chat_channels(kind,name)
        values('private','Up Till Dawn · persoonlijk')
        returning id into v_private_channel;

        insert into public.chat_members(channel_id,user_id)
        values(v_private_channel,v_person.id);
      end if;

      insert into public.messages(user_id,sender_id,channel_id,body,content)
      values(v_person.id,null,v_private_channel,v_chat_body,v_content)
      returning id into v_private_message;

      update upt_private.birthday_greeting_deliveries
      set private_message_id=v_private_message,updated_at=now()
      where user_id=v_person.id and birthday_date=v_today;
    end if;

    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$$;

revoke all on function upt_private.run_birthday_greetings() from public,anon,authenticated;

notify pgrst,'reload schema';
