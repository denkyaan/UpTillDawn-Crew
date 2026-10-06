-- Full chat experience: reliable mentions, notifications, unread/read state, mute modes,
-- pins, search, read receipts and short-lived typing state.

alter table public.messages
  add column if not exists mentioned_user_ids uuid[] not null default '{}'::uuid[];

alter table public.messages
  drop constraint if exists messages_mentioned_user_ids_limit;

alter table public.messages
  add constraint messages_mentioned_user_ids_limit
  check(cardinality(mentioned_user_ids)<=25);

create index if not exists messages_channel_created_sender_idx
  on public.messages(channel_id,created_at,sender_id);

create index if not exists messages_mentions_gin_idx
  on public.messages using gin(mentioned_user_ids);

create table if not exists upt_private.chat_user_states(
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz null,
  mute_mode text not null default 'mentions'
    check(mute_mode in ('all','mentions','muted')),
  updated_at timestamptz not null default now(),
  primary key(channel_id,user_id)
);

create index if not exists chat_user_states_user_idx
  on upt_private.chat_user_states(user_id,updated_at desc);

alter table upt_private.chat_user_states enable row level security;
revoke all on upt_private.chat_user_states from public,anon,authenticated;

create table if not exists upt_private.chat_pins(
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  pinned_by uuid not null references public.profiles(id) on delete restrict,
  pinned_at timestamptz not null default now(),
  primary key(channel_id,message_id)
);

create index if not exists chat_pins_channel_idx
  on upt_private.chat_pins(channel_id,pinned_at desc);

alter table upt_private.chat_pins enable row level security;
revoke all on upt_private.chat_pins from public,anon,authenticated;

create table if not exists upt_private.chat_typing_states(
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  primary key(channel_id,user_id)
);

create index if not exists chat_typing_states_expiry_idx
  on upt_private.chat_typing_states(expires_at);

alter table upt_private.chat_typing_states enable row level security;
revoke all on upt_private.chat_typing_states from public,anon,authenticated;

create or replace function upt_private.chat_default_mute_mode(p_channel uuid)
returns text
language sql
stable
security definer
set search_path='pg_catalog','public'
as $$
  select case when c.kind='private' then 'all' else 'mentions' end
  from public.chat_channels c
  where c.id=p_channel;
$$;

create or replace function upt_private.chat_effective_mute_mode(p_channel uuid,p_user uuid)
returns text
language sql
stable
security definer
set search_path='pg_catalog','public','upt_private'
as $$
  select coalesce(
    (select s.mute_mode from upt_private.chat_user_states s where s.channel_id=p_channel and s.user_id=p_user),
    upt_private.chat_default_mute_mode(p_channel),
    'mentions'
  );
$$;

revoke all on function upt_private.chat_default_mute_mode(uuid) from public,anon,authenticated;
revoke all on function upt_private.chat_effective_mute_mode(uuid,uuid) from public,anon,authenticated;

create or replace function public.upt_mark_chat_read(p_channel uuid)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare
  v_actor uuid:=auth.uid();
  v_default text;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_can_read_channel(p_channel) then
    raise exception 'Geen toegang tot chat.';
  end if;

  v_default:=coalesce(upt_private.chat_default_mute_mode(p_channel),'mentions');

  insert into upt_private.chat_user_states(channel_id,user_id,last_read_at,mute_mode,updated_at)
  values(p_channel,v_actor,now(),v_default,now())
  on conflict(channel_id,user_id) do update
  set last_read_at=greatest(coalesce(upt_private.chat_user_states.last_read_at,'epoch'::timestamptz),excluded.last_read_at),
      updated_at=now();
end;
$$;

revoke all on function public.upt_mark_chat_read(uuid) from public,anon;
grant execute on function public.upt_mark_chat_read(uuid) to authenticated;

create or replace function public.upt_set_chat_mute(p_channel uuid,p_mode text)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare
  v_actor uuid:=auth.uid();
  v_name text;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_can_read_channel(p_channel) then
    raise exception 'Geen toegang tot chat.';
  end if;
  if p_mode not in ('all','mentions','muted') then raise exception 'Ongeldige meldingsinstelling.'; end if;

  select c.name into v_name from public.chat_channels c where c.id=p_channel;
  if v_name='Up Till Dawn · persoonlijk' and p_mode<>'all' then
    raise exception 'Up Till Dawn-systeemmeldingen kunnen niet worden gedempt.';
  end if;

  insert into upt_private.chat_user_states(channel_id,user_id,last_read_at,mute_mode,updated_at)
  values(p_channel,v_actor,null,p_mode,now())
  on conflict(channel_id,user_id) do update
  set mute_mode=excluded.mute_mode,updated_at=now();
end;
$$;

revoke all on function public.upt_set_chat_mute(uuid,text) from public,anon;
grant execute on function public.upt_set_chat_mute(uuid,text) to authenticated;

create or replace function public.upt_chat_channel_summaries()
returns table(
  channel_id uuid,
  unread_count bigint,
  mention_count bigint,
  last_read_at timestamptz,
  peer_last_read_at timestamptz,
  mute_mode text,
  pinned_count bigint,
  can_pin boolean
)
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare
  v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.upt_is_approved() then
    raise exception 'ACCOUNT NOT APPROVED';
  end if;

  insert into upt_private.chat_user_states(channel_id,user_id,last_read_at,mute_mode,updated_at)
  select c.id,v_actor,now(),coalesce(upt_private.chat_default_mute_mode(c.id),'mentions'),now()
  from public.chat_channels c
  where public.upt_can_read_channel(c.id)
  on conflict(channel_id,user_id) do nothing;

  return query
  select
    c.id,
    (
      select count(*)
      from public.messages m
      where m.channel_id=c.id
        and m.sender_id is distinct from v_actor
        and m.moderated_at is null
        and m.created_at>coalesce(s.last_read_at,c.created_at)
    )::bigint as unread_count,
    (
      select count(*)
      from public.messages m
      where m.channel_id=c.id
        and m.sender_id is distinct from v_actor
        and m.moderated_at is null
        and v_actor=any(m.mentioned_user_ids)
        and m.created_at>coalesce(s.last_read_at,c.created_at)
    )::bigint as mention_count,
    s.last_read_at,
    case when c.kind='private' and c.name is null then (
      select max(peer_state.last_read_at)
      from public.chat_members peer
      left join upt_private.chat_user_states peer_state
        on peer_state.channel_id=c.id and peer_state.user_id=peer.user_id
      where peer.channel_id=c.id and peer.user_id<>v_actor
    ) else null end,
    s.mute_mode,
    (select count(*) from upt_private.chat_pins pin where pin.channel_id=c.id)::bigint,
    (
      (c.kind in ('event','workplace') and public.upt_is_admin())
      or (c.kind='workplace' and c.event_id is not null and c.workplace_id is not null
          and public.upt_is_responsible(c.event_id,c.workplace_id,v_actor))
      or (c.kind='event' and c.event_id is not null
          and exists(select 1 from public.responsible_assignments ra where ra.event_id=c.event_id and ra.user_id=v_actor))
    ) as can_pin
  from public.chat_channels c
  join upt_private.chat_user_states s on s.channel_id=c.id and s.user_id=v_actor
  where public.upt_can_read_channel(c.id)
  order by c.created_at,c.id;
end;
$$;

revoke all on function public.upt_chat_channel_summaries() from public,anon;
grant execute on function public.upt_chat_channel_summaries() to authenticated;

create or replace function public.upt_chat_unread_total()
returns bigint
language sql
security definer
set search_path='pg_catalog','public'
as $$
  select coalesce(sum(x.unread_count),0)::bigint
  from public.upt_chat_channel_summaries() x;
$$;

revoke all on function public.upt_chat_unread_total() from public,anon;
grant execute on function public.upt_chat_unread_total() to authenticated;

create or replace function public.upt_set_chat_typing(p_channel uuid,p_active boolean)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare
  v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_can_read_channel(p_channel) then
    raise exception 'Geen toegang tot chat.';
  end if;

  delete from upt_private.chat_typing_states where expires_at<=now();

  if p_active then
    insert into upt_private.chat_typing_states(channel_id,user_id,expires_at)
    values(p_channel,v_actor,now()+interval '4 seconds')
    on conflict(channel_id,user_id) do update set expires_at=excluded.expires_at;
  else
    delete from upt_private.chat_typing_states where channel_id=p_channel and user_id=v_actor;
  end if;
end;
$$;

revoke all on function public.upt_set_chat_typing(uuid,boolean) from public,anon;
grant execute on function public.upt_set_chat_typing(uuid,boolean) to authenticated;

create or replace function public.upt_chat_typing_users(p_channel uuid)
returns table(user_id uuid,full_name text)
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
begin
  if not public.upt_is_approved() or not public.upt_can_read_channel(p_channel) then
    raise exception 'Geen toegang tot chat.';
  end if;

  delete from upt_private.chat_typing_states where expires_at<=now();

  return query
  select state.user_id,p.full_name
  from upt_private.chat_typing_states state
  join public.profiles p on p.id=state.user_id
  where state.channel_id=p_channel
    and state.user_id<>auth.uid()
    and state.expires_at>now()
  order by p.full_name;
end;
$$;

revoke all on function public.upt_chat_typing_users(uuid) from public,anon;
grant execute on function public.upt_chat_typing_users(uuid) to authenticated;

create or replace function public.upt_chat_pins(p_channel uuid)
returns table(
  message_id uuid,
  pinned_at timestamptz,
  pinned_by uuid,
  body text,
  sender_id uuid,
  message_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path='pg_catalog','public','upt_private'
as $$
begin
  if not public.upt_is_approved() or not public.upt_can_read_channel(p_channel) then
    raise exception 'Geen toegang tot chat.';
  end if;

  return query
  select pin.message_id,pin.pinned_at,pin.pinned_by,m.body,m.sender_id,m.created_at
  from upt_private.chat_pins pin
  join public.messages m on m.id=pin.message_id and m.channel_id=pin.channel_id
  where pin.channel_id=p_channel
  order by pin.pinned_at desc;
end;
$$;

revoke all on function public.upt_chat_pins(uuid) from public,anon;
grant execute on function public.upt_chat_pins(uuid) to authenticated;

create or replace function public.upt_toggle_chat_pin(p_message uuid,p_pinned boolean)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare
  v_actor uuid:=auth.uid();
  v_channel public.chat_channels%rowtype;
  v_message_channel uuid;
  v_allowed boolean:=false;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;

  select m.channel_id into v_message_channel
  from public.messages m
  where m.id=p_message and m.moderated_at is null;

  if v_message_channel is null or not public.upt_can_read_channel(v_message_channel) then
    raise exception 'Bericht niet beschikbaar.';
  end if;

  select * into v_channel from public.chat_channels where id=v_message_channel;

  v_allowed:=(v_channel.kind in ('event','workplace') and public.upt_is_admin())
    or (v_channel.kind='workplace' and v_channel.event_id is not null and v_channel.workplace_id is not null
        and public.upt_is_responsible(v_channel.event_id,v_channel.workplace_id,v_actor))
    or (v_channel.kind='event' and v_channel.event_id is not null
        and exists(select 1 from public.responsible_assignments ra where ra.event_id=v_channel.event_id and ra.user_id=v_actor));

  if not v_allowed then raise exception 'Geen rechten om berichten vast te pinnen.'; end if;

  if p_pinned then
    if not exists(select 1 from upt_private.chat_pins p where p.channel_id=v_message_channel and p.message_id=p_message)
       and (select count(*) from upt_private.chat_pins p where p.channel_id=v_message_channel)>=5 then
      raise exception 'Er kunnen maximaal 5 berichten worden vastgepind.';
    end if;

    insert into upt_private.chat_pins(channel_id,message_id,pinned_by,pinned_at)
    values(v_message_channel,p_message,v_actor,now())
    on conflict(channel_id,message_id) do nothing;
  else
    delete from upt_private.chat_pins where channel_id=v_message_channel and message_id=p_message;
  end if;
end;
$$;

revoke all on function public.upt_toggle_chat_pin(uuid,boolean) from public,anon;
grant execute on function public.upt_toggle_chat_pin(uuid,boolean) to authenticated;

create or replace function public.upt_search_chat_messages(
  p_channel uuid,
  p_query text default null,
  p_sender uuid default null,
  p_attachment_kind text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 50
)
returns table(
  id uuid,
  body text,
  sender_id uuid,
  created_at timestamptz,
  reply_to_message_id uuid,
  mentioned_user_ids uuid[],
  attachment_kind text
)
language plpgsql
stable
security definer
set search_path='pg_catalog','public'
as $$
begin
  if not public.upt_is_approved() or not public.upt_can_read_channel(p_channel) then
    raise exception 'Geen toegang tot chat.';
  end if;
  if p_attachment_kind is not null and p_attachment_kind not in ('any','media','file') then
    raise exception 'Ongeldig bestandsfilter.';
  end if;

  return query
  select
    m.id,m.body,m.sender_id,m.created_at,m.reply_to_message_id,m.mentioned_user_ids,
    case
      when exists(select 1 from public.message_attachments a where a.message_id=m.id and (a.mime_type like 'image/%' or a.mime_type like 'video/%')) then 'media'
      when exists(select 1 from public.message_attachments a where a.message_id=m.id) then 'file'
      else 'none'
    end
  from public.messages m
  where m.channel_id=p_channel
    and m.moderated_at is null
    and (nullif(trim(coalesce(p_query,'')),'') is null or coalesce(m.body,'') ilike '%'||trim(p_query)||'%')
    and (p_sender is null or m.sender_id=p_sender)
    and (p_from is null or m.created_at>=p_from)
    and (p_to is null or m.created_at<=p_to)
    and (
      p_attachment_kind is null
      or (p_attachment_kind='any' and exists(select 1 from public.message_attachments a where a.message_id=m.id))
      or (p_attachment_kind='media' and exists(select 1 from public.message_attachments a where a.message_id=m.id and (a.mime_type like 'image/%' or a.mime_type like 'video/%')))
      or (p_attachment_kind='file' and exists(select 1 from public.message_attachments a where a.message_id=m.id and not (a.mime_type like 'image/%' or a.mime_type like 'video/%')))
    )
  order by m.created_at desc
  limit greatest(1,least(coalesce(p_limit,50),100));
end;
$$;

revoke all on function public.upt_search_chat_messages(uuid,text,uuid,text,timestamptz,timestamptz,integer) from public,anon;
grant execute on function public.upt_search_chat_messages(uuid,text,uuid,text,timestamptz,timestamptz,integer) to authenticated;

create or replace function public.upt_send_chat_message_operation_v2(
  p_operation uuid,
  p_channel uuid,
  p_body text,
  p_reply_to uuid default null,
  p_mention_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare
  v_actor uuid:=auth.uid();
  v_old public.offline_operation_records%rowtype;
  v_body text:=nullif(trim(coalesce(p_body,'')),'');
  v_payload jsonb;
  v_message uuid;
  v_event uuid;
  v_mentions uuid[];
begin
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;
  if p_operation is null or p_channel is null or v_body is null or length(v_body)>4000 then raise exception 'Ongeldig bericht.'; end if;
  if cardinality(coalesce(p_mention_ids,'{}'::uuid[]))>25 then raise exception 'Te veel vermeldingen.'; end if;
  if not public.upt_can_read_channel(p_channel) then raise exception 'Geen toegang tot chat.'; end if;

  select event_id into v_event from public.chat_channels where id=p_channel;
  if not public.upt_feature_allowed('chat',v_event,null) then raise exception 'Chat is momenteel alleen-lezen.'; end if;

  if p_reply_to is not null and not exists(
    select 1 from public.messages m where m.id=p_reply_to and m.channel_id=p_channel and m.moderated_at is null
  ) then raise exception 'Het bericht waarop je antwoordt is niet beschikbaar.'; end if;

  if exists(
    select 1
    from unnest(coalesce(p_mention_ids,'{}'::uuid[])) requested(id)
    where not exists(select 1 from public.upt_chat_channel_people(p_channel) person where person.id=requested.id)
  ) then raise exception 'Ongeldige vermelding.'; end if;

  select coalesce(array_agg(distinct requested.id order by requested.id),'{}'::uuid[])
  into v_mentions
  from unnest(coalesce(p_mention_ids,'{}'::uuid[])) requested(id)
  where requested.id is not null and requested.id<>v_actor;

  v_payload:=jsonb_build_object(
    'channel_id',p_channel,
    'body',v_body,
    'reply_to_message_id',p_reply_to,
    'mention_ids',to_jsonb(v_mentions)
  );

  perform pg_advisory_xact_lock(hashtextextended(p_operation::text,0));
  select * into v_old from public.offline_operation_records where id=p_operation;
  if found then
    if v_old.user_id<>v_actor or v_old.operation_type<>'chat_message_v2' or v_old.payload<>v_payload then
      raise exception 'Operation ID conflict';
    end if;
    return (v_old.result->>'id')::uuid;
  end if;

  insert into public.messages(user_id,sender_id,channel_id,body,content,reply_to_message_id,mentioned_user_ids)
  values(v_actor,v_actor,p_channel,v_body,v_body,p_reply_to,v_mentions)
  returning id into v_message;

  insert into public.offline_operation_records(id,user_id,operation_type,payload,status,result,synced_at)
  values(p_operation,v_actor,'chat_message_v2',v_payload,'synced',jsonb_build_object('id',v_message,'server_timestamp',now()),now());

  return v_message;
end;
$$;

revoke all on function public.upt_send_chat_message_operation_v2(uuid,uuid,text,uuid,uuid[]) from public,anon;
grant execute on function public.upt_send_chat_message_operation_v2(uuid,uuid,text,uuid,uuid[]) to authenticated;

create or replace function public.upt_send_chat_photo_message_operation_v2(
  p_operation uuid,
  p_channel uuid,
  p_body text,
  p_attachment_path text,
  p_reply_to uuid default null,
  p_mention_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare
  v_actor uuid:=auth.uid();
  v_old public.offline_operation_records%rowtype;
  v_body text:=nullif(trim(coalesce(p_body,'')),'');
  v_path text:=trim(coalesce(p_attachment_path,''));
  v_payload jsonb;
  v_mime text;
  v_message uuid;
  v_event uuid;
  v_mentions uuid[];
begin
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;
  if p_operation is null or p_channel is null or v_path='' then raise exception 'Ongeldige uploadbewerking.'; end if;
  if v_body is not null and length(v_body)>4000 then raise exception 'Bericht is te lang.'; end if;
  if cardinality(coalesce(p_mention_ids,'{}'::uuid[]))>25 then raise exception 'Te veel vermeldingen.'; end if;
  if not public.upt_can_read_channel(p_channel) then raise exception 'Geen toegang tot chat.'; end if;

  select event_id into v_event from public.chat_channels where id=p_channel;
  if not public.upt_feature_allowed('chat',v_event,null) then raise exception 'Chat is momenteel alleen-lezen.'; end if;

  if p_reply_to is not null and not exists(
    select 1 from public.messages m where m.id=p_reply_to and m.channel_id=p_channel and m.moderated_at is null
  ) then raise exception 'Het bericht waarop je antwoordt is niet beschikbaar.'; end if;

  if exists(
    select 1
    from unnest(coalesce(p_mention_ids,'{}'::uuid[])) requested(id)
    where not exists(select 1 from public.upt_chat_channel_people(p_channel) person where person.id=requested.id)
  ) then raise exception 'Ongeldige vermelding.'; end if;

  select coalesce(array_agg(distinct requested.id order by requested.id),'{}'::uuid[])
  into v_mentions
  from unnest(coalesce(p_mention_ids,'{}'::uuid[])) requested(id)
  where requested.id is not null and requested.id<>v_actor;

  if split_part(v_path,'/',1)<>v_actor::text then raise exception 'Ongeldig bijlagepad.'; end if;

  select o.metadata->>'mimetype' into v_mime
  from storage.objects o
  where o.bucket_id='chat-attachments' and o.name=v_path;

  if v_mime is null or v_mime not in(
    'image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime',
    'application/pdf','text/plain','text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) then raise exception 'Ongeldige chatbijlage.'; end if;

  v_payload:=jsonb_build_object(
    'channel_id',p_channel,
    'body',coalesce(v_body,''),
    'attachment_path',v_path,
    'reply_to_message_id',p_reply_to,
    'mention_ids',to_jsonb(v_mentions)
  );

  perform pg_advisory_xact_lock(hashtextextended(p_operation::text,0));
  select * into v_old from public.offline_operation_records where id=p_operation;
  if found then
    if v_old.user_id<>v_actor or v_old.operation_type<>'chat_photo_message_v2' or v_old.payload<>v_payload then
      raise exception 'Operation ID conflict';
    end if;
    return (v_old.result->>'id')::uuid;
  end if;

  insert into public.messages(user_id,sender_id,channel_id,body,content,reply_to_message_id,mentioned_user_ids)
  values(v_actor,v_actor,p_channel,v_body,v_body,p_reply_to,v_mentions)
  returning id into v_message;

  insert into public.message_attachments(message_id,file_url,storage_path,mime_type)
  values(v_message,v_path,v_path,v_mime);

  insert into public.offline_operation_records(id,user_id,operation_type,payload,status,result,synced_at)
  values(p_operation,v_actor,'chat_photo_message_v2',v_payload,'synced',jsonb_build_object('id',v_message,'server_timestamp',now()),now());

  return v_message;
end;
$$;

revoke all on function public.upt_send_chat_photo_message_operation_v2(uuid,uuid,text,text,uuid,uuid[]) from public,anon;
grant execute on function public.upt_send_chat_photo_message_operation_v2(uuid,uuid,text,text,uuid,uuid[]) to authenticated;

create or replace function upt_private.notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare
  v_sender_name text;
  v_channel public.chat_channels%rowtype;
  v_channel_label text;
  v_reply_user uuid;
  v_recipient record;
  v_mode text;
  v_excerpt text;
  v_title text;
begin
  if new.sender_id is null then return new; end if;

  select coalesce(nullif(trim(p.full_name),''),'Personeelslid') into v_sender_name
  from public.profiles p where p.id=new.sender_id;

  select * into v_channel from public.chat_channels c where c.id=new.channel_id;
  if not found then return new; end if;

  v_channel_label:=case
    when v_channel.kind='organization' then 'Algemene chat'
    when v_channel.kind='workplace' then coalesce(nullif(v_channel.name,''),'Werkplekchat')
    when v_channel.kind='event' then coalesce(nullif(v_channel.name,''),'Eventchat')
    when v_channel.kind='private' then 'Privéchat'
    else 'Chat'
  end;
  v_excerpt:=left(coalesce(nullif(trim(new.body),''),'Bestand'),180);

  if new.reply_to_message_id is not null then
    select m.sender_id into v_reply_user
    from public.messages m
    where m.id=new.reply_to_message_id and m.channel_id=new.channel_id;
    if v_reply_user=new.sender_id then v_reply_user:=null; end if;
  end if;

  for v_recipient in
    select person.id
    from public.upt_chat_channel_people(new.channel_id) person
    where person.id<>new.sender_id
  loop
    v_mode:=upt_private.chat_effective_mute_mode(new.channel_id,v_recipient.id);
    if v_mode='muted' then continue; end if;

    if v_recipient.id=v_reply_user then
      v_title:=format('%s heeft op je bericht geantwoord',v_sender_name);
      insert into public.crew_notifications(user_id,title,body,kind,link)
      values(v_recipient.id,v_title,v_excerpt,'chat_reply',format('/chat?channel=%s&message=%s',new.channel_id,new.id));
    elsif v_recipient.id=any(new.mentioned_user_ids) then
      v_title:=format('%s heeft je vermeld in %s',v_sender_name,v_channel_label);
      insert into public.crew_notifications(user_id,title,body,kind,link)
      values(v_recipient.id,v_title,v_excerpt,'chat_mention',format('/chat?channel=%s&message=%s',new.channel_id,new.id));
    elsif v_mode='all' then
      if v_channel.kind='private' then
        v_title:=format('Nieuw privébericht van %s',v_sender_name);
      else
        v_title:=format('Nieuw bericht in %s',v_channel_label);
      end if;
      insert into public.crew_notifications(user_id,title,body,kind,link)
      values(v_recipient.id,v_title,v_excerpt,'chat_message',format('/chat?channel=%s&message=%s',new.channel_id,new.id));
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function upt_private.notify_chat_message() from public,anon,authenticated;

drop trigger if exists upt_chat_message_notifications on public.messages;
create trigger upt_chat_message_notifications
after insert on public.messages
for each row execute function upt_private.notify_chat_message();

notify pgrst,'reload schema';
