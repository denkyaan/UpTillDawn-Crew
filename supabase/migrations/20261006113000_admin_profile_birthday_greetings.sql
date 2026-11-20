-- Role-aware first profile completion and automatic birthday greetings.
-- Admin profile: first + last name, phone, date of birth and profile photo.
-- Other roles: all personnel profile fields + workplace preference + profile photo.

create or replace function public.upt_update_own_profile(
  p_full_name text,
  p_home_address text default null,
  p_phone_number text default null,
  p_date_of_birth date default null,
  p_national_register_number text default null,
  p_iban text default null,
  p_profile_photo_path text default null
)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_existing_photo text;
  v_iban text := nullif(upper(regexp_replace(coalesce(p_iban, ''), '\s+', '', 'g')), '');
  v_address text := nullif(trim(coalesce(p_home_address, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone_number, '')), '');
  v_nrn text := nullif(trim(coalesce(p_national_register_number, '')), '');
  v_photo text := nullif(trim(coalesce(p_profile_photo_path, '')), '');
  v_name text := nullif(trim(coalesce(p_full_name, '')), '');
begin
  if v_uid is null then
    raise exception 'Aanmelden vereist.';
  end if;

  select p.role,p.profile_photo_url
  into v_role,v_existing_photo
  from public.profiles p
  where p.id=v_uid
  for update;

  if not found then
    raise exception 'Profiel niet gevonden.';
  end if;

  if v_name is null or length(v_name) > 200
     or cardinality(regexp_split_to_array(v_name, '\s+')) < 2 then
    raise exception 'Vul je voor- en achternaam in.';
  end if;
  if v_phone is null or length(v_phone) > 40 then
    raise exception 'Vul een geldig telefoonnummer in.';
  end if;
  if p_date_of_birth is null
     or p_date_of_birth > current_date
     or p_date_of_birth < current_date - interval '120 years' then
    raise exception 'Vul een geldige geboortedatum in.';
  end if;
  if coalesce(v_photo,v_existing_photo) is null then
    raise exception 'Een profielfoto is verplicht.';
  end if;

  if v_photo is not null then
    if split_part(v_photo, '/', 1) <> v_uid::text then
      raise exception 'Ongeldig fotopad.';
    end if;
    if not exists (
      select 1
      from storage.objects o
      where o.bucket_id='profile-photos'
        and o.name=v_photo
    ) then
      raise exception 'Profielfoto bestaat niet.';
    end if;
  end if;

  if v_role='admin' then
    update public.profiles
    set full_name=v_name,
        phone_number=v_phone,
        date_of_birth=p_date_of_birth,
        profile_photo_url=coalesce(v_photo,profile_photo_url),
        updated_at=now()
    where id=v_uid;
  else
    if v_address is null or length(v_address) > 500 then
      raise exception 'Adres is verplicht.';
    end if;
    if v_nrn is null or length(v_nrn) > 32 then
      raise exception 'Rijksregisternummer is verplicht.';
    end if;
    if v_iban is null or length(v_iban) not between 15 and 34 then
      raise exception 'Vul een geldige IBAN in.';
    end if;

    update public.profiles
    set full_name=v_name,
        home_address=v_address,
        phone_number=v_phone,
        date_of_birth=p_date_of_birth,
        national_register_number=v_nrn,
        iban=v_iban,
        profile_photo_url=coalesce(v_photo,profile_photo_url),
        updated_at=now()
    where id=v_uid;
  end if;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'PROFILE_UPDATED','profile',v_uid,jsonb_build_object('self_service',true,'profile_role',v_role));
end;
$$;

revoke all on function public.upt_update_own_profile(text,text,text,date,text,text,text) from public,anon;
grant execute on function public.upt_update_own_profile(text,text,text,date,text,text,text) to authenticated;

create or replace function public.upt_set_own_workplace_preference(p_workplace uuid default null)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Aanmelden vereist.';
  end if;

  select role into v_role
  from public.profiles
  where id=auth.uid();

  if not found then
    raise exception 'Profiel niet gevonden.';
  end if;

  if v_role<>'admin' and p_workplace is null then
    raise exception 'Werkplekvoorkeur is verplicht.';
  end if;

  if p_workplace is not null and not exists(
    select 1
    from public.workplace_catalog wc
    where wc.id=p_workplace and wc.is_active=true
  ) then
    raise exception 'Werkplekvoorkeur is niet geldig.';
  end if;

  update public.profiles
  set preferred_workplace_id=p_workplace,
      updated_at=now()
  where id=auth.uid();
end;
$$;

revoke all on function public.upt_set_own_workplace_preference(uuid) from public,anon;
grant execute on function public.upt_set_own_workplace_preference(uuid) to authenticated;

create or replace function public.upt_mark_own_profile_complete()
returns boolean
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare
  p public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Aanmelden vereist.';
  end if;

  select * into p
  from public.profiles
  where id=auth.uid();

  if p.id is null then
    raise exception 'Profiel niet gevonden.';
  end if;

  if nullif(trim(p.full_name),'') is null
     or cardinality(regexp_split_to_array(trim(p.full_name), '\s+')) < 2
     or nullif(trim(p.phone_number),'') is null
     or p.date_of_birth is null
     or nullif(trim(p.profile_photo_url),'') is null then
    raise exception 'Vul eerst alle verplichte profielvelden en een profielfoto in.';
  end if;

  if p.role<>'admin' and (
       nullif(trim(p.home_address),'') is null
       or nullif(trim(p.national_register_number),'') is null
       or nullif(trim(p.iban),'') is null
       or p.preferred_workplace_id is null
     ) then
    raise exception 'Vul eerst alle verplichte profielvelden, je werkplekvoorkeur en een profielfoto in.';
  end if;

  update public.profiles
  set app_profile_completed_at=coalesce(app_profile_completed_at,now()),
      updated_at=now()
  where id=auth.uid();

  return true;
end;
$$;

revoke all on function public.upt_mark_own_profile_complete() from public,anon;
grant execute on function public.upt_mark_own_profile_complete() to authenticated;

create table if not exists upt_private.birthday_greeting_deliveries(
  user_id uuid not null references public.profiles(id) on delete cascade,
  birthday_date date not null,
  notification_id uuid null references public.crew_notifications(id) on delete set null,
  message_id uuid null references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id,birthday_date)
);

revoke all on table upt_private.birthday_greeting_deliveries from public,anon,authenticated;

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
  v_chat_body constant text := 'Van harte gefeliciteerd met je verjaardag!🥳 Laat het een fantastische dag zijn en maak er het beste van! 🎉🎉';
begin
  select c.id into v_channel
  from public.chat_channels c
  where c.kind='organization'
  order by c.created_at,c.id
  limit 1;

  for v_person in
    select p.id
    from public.profiles p
    where p.approved=true
      and coalesce(p.account_blocked,false)=false
      and p.date_of_birth is not null
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

do $$
begin
  if exists(select 1 from cron.job where jobname='uptilldawn-birthday-greetings') then
    perform cron.unschedule('uptilldawn-birthday-greetings');
  end if;

  perform cron.schedule(
    'uptilldawn-birthday-greetings',
    '5 * * * *',
    'select upt_private.run_birthday_greetings();'
  );
end;
$$;

notify pgrst,'reload schema';
