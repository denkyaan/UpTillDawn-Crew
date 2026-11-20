-- Add message replies and chat-scoped participant discovery for @mentions.

alter table public.messages
  add column if not exists reply_to_message_id uuid null references public.messages(id) on delete set null;

create index if not exists messages_reply_to_message_id_idx
  on public.messages(reply_to_message_id)
  where reply_to_message_id is not null;

create or replace function public.upt_chat_channel_people(p_channel uuid)
returns table(id uuid,full_name text,profile_photo_url text)
language plpgsql
stable
security definer
set search_path='public','pg_temp'
as $$
declare
  v_channel public.chat_channels%rowtype;
begin
  if auth.uid() is null or not public.upt_is_approved() then
    raise exception 'ACCOUNT NOT APPROVED';
  end if;

  if not public.upt_can_read_channel(p_channel) then
    raise exception 'Geen toegang tot chat.';
  end if;

  select * into v_channel from public.chat_channels where id=p_channel;
  if not found then raise exception 'Chat niet gevonden.'; end if;

  return query
  select distinct p.id,p.full_name,p.profile_photo_url
  from public.profiles p
  where p.approved=true
    and coalesce(p.account_blocked,false)=false
    and nullif(trim(p.full_name),'') is not null
    and (
      v_channel.kind='organization'
      or (
        v_channel.kind='private'
        and exists(
          select 1 from public.chat_members cm
          where cm.channel_id=v_channel.id and cm.user_id=p.id
        )
      )
      or (
        v_channel.kind='event'
        and (
          p.role='admin'
          or exists(select 1 from public.event_members em where em.event_id=v_channel.event_id and em.user_id=p.id)
          or exists(select 1 from public.shifts s where s.event_id=v_channel.event_id and s.user_id=p.id and s.status<>'cancelled' and coalesce(s.response_status,'')<>'declined')
          or exists(select 1 from public.responsible_assignments ra where ra.event_id=v_channel.event_id and ra.user_id=p.id)
        )
      )
      or (
        v_channel.kind='workplace'
        and (
          p.role='admin'
          or exists(select 1 from public.responsible_assignments ra where ra.event_id=v_channel.event_id and ra.workplace_id=v_channel.workplace_id and ra.user_id=p.id)
          or exists(select 1 from public.shifts s where s.event_id=v_channel.event_id and s.workplace_id=v_channel.workplace_id and s.user_id=p.id and s.status<>'cancelled' and coalesce(s.response_status,'')<>'declined')
        )
      )
    )
  order by p.full_name,p.id;
end;
$$;

revoke all on function public.upt_chat_channel_people(uuid) from public,anon;
grant execute on function public.upt_chat_channel_people(uuid) to authenticated;

create or replace function public.upt_send_chat_message_operation(
  p_operation uuid,
  p_channel uuid,
  p_body text,
  p_reply_to uuid default null
)
returns uuid
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_actor uuid:=auth.uid();
  v_old public.offline_operation_records%rowtype;
  v_body text:=nullif(trim(coalesce(p_body,'')),'');
  v_payload jsonb;
  v_message uuid;
  v_event uuid;
begin
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;
  if p_operation is null or p_channel is null or v_body is null or length(v_body)>4000 then raise exception 'Ongeldig bericht.'; end if;
  if not public.upt_can_read_channel(p_channel) then raise exception 'Geen toegang tot chat.'; end if;

  select event_id into v_event from public.chat_channels where id=p_channel;
  if not public.upt_feature_allowed('chat',v_event,null) then raise exception 'Chat is momenteel alleen-lezen.'; end if;

  if p_reply_to is not null and not exists(
    select 1 from public.messages m
    where m.id=p_reply_to and m.channel_id=p_channel and m.moderated_at is null
  ) then raise exception 'Het bericht waarop je antwoordt is niet beschikbaar.'; end if;

  v_payload:=case when p_reply_to is null
    then jsonb_build_object('channel_id',p_channel,'body',v_body)
    else jsonb_build_object('channel_id',p_channel,'body',v_body,'reply_to_message_id',p_reply_to)
  end;

  perform pg_advisory_xact_lock(hashtextextended(p_operation::text,0));
  select * into v_old from public.offline_operation_records where id=p_operation;
  if found then
    if v_old.user_id<>v_actor or v_old.operation_type<>'message' or v_old.payload<>v_payload then raise exception 'Operation ID conflict'; end if;
    return (v_old.result->>'id')::uuid;
  end if;

  insert into public.messages(user_id,sender_id,channel_id,body,content,reply_to_message_id)
  values(v_actor,v_actor,p_channel,v_body,v_body,p_reply_to)
  returning id into v_message;

  insert into public.offline_operation_records(id,user_id,operation_type,payload,status,result,synced_at)
  values(p_operation,v_actor,'message',v_payload,'synced',jsonb_build_object('id',v_message,'server_timestamp',now()),now());

  return v_message;
end;
$$;

revoke all on function public.upt_send_chat_message_operation(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.upt_send_chat_message_operation(uuid,uuid,text,uuid) to authenticated;

create or replace function public.upt_send_chat_photo_message_operation(
  p_operation uuid,
  p_channel uuid,
  p_body text,
  p_attachment_path text,
  p_reply_to uuid default null
)
returns uuid
language plpgsql
security definer
set search_path='public','pg_temp'
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
begin
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;
  if p_operation is null or p_channel is null or v_path='' then raise exception 'Ongeldige uploadbewerking.'; end if;
  if v_body is not null and length(v_body)>4000 then raise exception 'Bericht is te lang.'; end if;
  if not public.upt_can_read_channel(p_channel) then raise exception 'Geen toegang tot chat.'; end if;

  select event_id into v_event from public.chat_channels where id=p_channel;
  if not public.upt_feature_allowed('chat',v_event,null) then raise exception 'Chat is momenteel alleen-lezen.'; end if;

  if p_reply_to is not null and not exists(
    select 1 from public.messages m
    where m.id=p_reply_to and m.channel_id=p_channel and m.moderated_at is null
  ) then raise exception 'Het bericht waarop je antwoordt is niet beschikbaar.'; end if;

  if split_part(v_path,'/',1)<>v_actor::text then raise exception 'Ongeldig bijlagepad.'; end if;

  v_payload:=case when p_reply_to is null
    then jsonb_build_object('channel_id',p_channel,'body',coalesce(v_body,''),'attachment_path',v_path)
    else jsonb_build_object('channel_id',p_channel,'body',coalesce(v_body,''),'attachment_path',v_path,'reply_to_message_id',p_reply_to)
  end;

  perform pg_advisory_xact_lock(hashtextextended(p_operation::text,0));
  select * into v_old from public.offline_operation_records where id=p_operation;
  if found then
    if v_old.user_id<>v_actor or v_old.operation_type<>'chat_photo_message' or v_old.payload<>v_payload then raise exception 'Operation ID conflict'; end if;
    return (v_old.result->>'id')::uuid;
  end if;

  select o.metadata->>'mimetype' into v_mime
  from storage.objects o
  where o.bucket_id='chat-attachments' and o.name=v_path;

  if v_mime is null or v_mime not in ('image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime') then
    raise exception 'Ongeldige chatbijlage.';
  end if;

  insert into public.messages(user_id,sender_id,channel_id,body,content,reply_to_message_id)
  values(v_actor,v_actor,p_channel,v_body,v_body,p_reply_to)
  returning id into v_message;

  insert into public.message_attachments(message_id,file_url,storage_path,mime_type)
  values(v_message,v_path,v_path,v_mime);

  insert into public.offline_operation_records(id,user_id,operation_type,payload,status,result,synced_at)
  values(p_operation,v_actor,'chat_photo_message',v_payload,'synced',jsonb_build_object('id',v_message,'server_timestamp',now()),now());

  return v_message;
end;
$$;

revoke all on function public.upt_send_chat_photo_message_operation(uuid,uuid,text,text,uuid) from public,anon;
grant execute on function public.upt_send_chat_photo_message_operation(uuid,uuid,text,text,uuid) to authenticated;

notify pgrst,'reload schema';
