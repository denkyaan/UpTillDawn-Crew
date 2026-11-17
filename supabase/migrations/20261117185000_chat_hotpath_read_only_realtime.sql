-- Main-only: eliminate per-poll mutation of chat and promotion read states.
-- Postgres role/channel checks, read receipts, pinned counts and mute remain.
-- No public Realtime topic grants; original Supabase RLS and fallback retained.

CREATE OR REPLACE FUNCTION public.upt_chat_typing_users(p_channel uuid)
 RETURNS TABLE(user_id uuid, full_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'upt_private'
AS $function$
begin
  if not public.upt_is_approved() or not public.upt_can_read_channel(p_channel) then
    raise exception 'Geen toegang tot chat.';
  end if;

  -- Read-only: expired states are excluded by expires_at>now() below.

  return query
  select state.user_id,p.full_name
  from upt_private.chat_typing_states state
  join public.profiles p on p.id=state.user_id
  where state.channel_id=p_channel
    and state.user_id<>auth.uid()
    and state.expires_at>now()
  order by p.full_name;
end;
$function$;

CREATE OR REPLACE FUNCTION public.upt_chat_channel_summaries()
 RETURNS TABLE(channel_id uuid, unread_count bigint, mention_count bigint, last_read_at timestamp with time zone, peer_last_read_at timestamp with time zone, mute_mode text, pinned_count bigint, can_pin boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'upt_private'
AS $function$
declare
  v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.upt_is_approved() then
    raise exception 'ACCOUNT NOT APPROVED';
  end if;

  -- Absent user states behave as newly read without INSERT-on-every-read.

  return query
  select
    c.id,
    (
      select count(*)
      from public.messages m
      where m.channel_id=c.id
        and m.sender_id is distinct from v_actor
        and m.moderated_at is null
        and m.created_at>coalesce(s.last_read_at,now())
    )::bigint as unread_count,
    (
      select count(*)
      from public.messages m
      where m.channel_id=c.id
        and m.sender_id is distinct from v_actor
        and m.moderated_at is null
        and v_actor=any(m.mentioned_user_ids)
        and m.created_at>coalesce(s.last_read_at,now())
    )::bigint as mention_count,
    coalesce(s.last_read_at,now()) as last_read_at,
    case when c.kind='private' and c.name is null then (
      select max(peer_state.last_read_at)
      from public.chat_members peer
      left join upt_private.chat_user_states peer_state
        on peer_state.channel_id=c.id and peer_state.user_id=peer.user_id
      where peer.channel_id=c.id and peer.user_id<>v_actor
    ) else null end,
    coalesce(s.mute_mode,upt_private.chat_default_mute_mode(c.id),'mentions') as mute_mode,
    (select count(*) from upt_private.chat_pins pin where pin.channel_id=c.id)::bigint,
    (
      (c.kind in ('event','workplace') and public.upt_is_admin())
      or (c.kind='workplace' and c.event_id is not null and c.workplace_id is not null
          and public.upt_is_responsible(c.event_id,c.workplace_id,v_actor))
      or (c.kind='event' and c.event_id is not null
          and exists(select 1 from public.responsible_assignments ra where ra.event_id=c.event_id and ra.user_id=v_actor))
    ) as can_pin
  from public.chat_channels c
  left join upt_private.chat_user_states s on s.channel_id=c.id and s.user_id=v_actor
  where public.upt_can_read_channel(c.id)
  order by c.created_at,c.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.upt_set_chat_typing(p_channel uuid, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'upt_private'
AS $function$
declare
  v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_can_read_channel(p_channel) then
    raise exception 'Geen toegang tot chat.';
  end if;

  delete from upt_private.chat_typing_states where channel_id=p_channel and expires_at<=now();

  if p_active then
    insert into upt_private.chat_typing_states(channel_id,user_id,expires_at)
    values(p_channel,v_actor,now()+interval '4 seconds')
    on conflict(channel_id,user_id) do update set expires_at=excluded.expires_at;
  else
    delete from upt_private.chat_typing_states where channel_id=p_channel and user_id=v_actor;
  end if;
  -- Fast typed/read feedback over a private, membership-authorized WebSocket.
  -- Fallback stored expiry remains authoritative if Realtime disconnects.
  begin
    perform realtime.send(jsonb_build_object('user_id',v_actor,'active',p_active),
      'typing','upt-chat-signal:'||p_channel::text,true);
  exception when others then null;
  end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.upt_mark_chat_read(p_channel uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'upt_private'
AS $function$
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
  begin
    perform realtime.send(jsonb_build_object('user_id',v_actor),
      'read','upt-chat-signal:'||p_channel::text,true);
  exception when others then null;
  end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.upt_promotion_chat_unread_counts()
 RETURNS TABLE(room text, unread_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'upt_private'
AS $function$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null or not public.upt_promotion_chat_allowed() then
  raise exception 'No access to Promotion unread count' using errcode='42501';
 end if;
 -- Read-only read counters. An absent state has zero unread items.
 return query
 select v.room,
    (select count(*) from public.promotion_chat_messages m
      where m.room=v.room and m.sender_id<>v_actor
        and m.created_at>coalesce(st.last_read_at,now()))::bigint
 from (values ('general'::text),('announcements'::text)) v(room)
 left join upt_private.promotion_chat_read_states st
    on st.user_id=v_actor and st.room=v.room
 order by v.room;
end;
$function$;

-- Private broadcast RLS is checked at channel subscription time.
-- Validate topic format BEFORE casting a UUID: no user-editable role claims.
create or replace function public.upt_chat_signal_authorized(p_topic text)
returns boolean
language plpgsql stable security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare v_channel uuid;
begin
  if auth.uid() is null or p_topic is null or
     p_topic !~ '^upt-chat-signal:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then return false; end if;
  v_channel:=substring(p_topic from 17)::uuid;
  return public.upt_is_approved() and public.upt_can_read_channel(v_channel);
end;
$function$;
revoke all on function public.upt_chat_signal_authorized(text) from public,anon;
grant execute on function public.upt_chat_signal_authorized(text) to authenticated;

drop policy if exists upt_chat_signal_select on realtime.messages;
create policy upt_chat_signal_select on realtime.messages for select to authenticated
using (extension='broadcast' and public.upt_chat_signal_authorized((select realtime.topic())));
drop policy if exists upt_chat_signal_insert on realtime.messages;
create policy upt_chat_signal_insert on realtime.messages for insert to authenticated
with check (extension='broadcast' and public.upt_chat_signal_authorized((select realtime.topic())));

revoke all on function public.upt_chat_typing_users(uuid) from public,anon;
revoke all on function public.upt_chat_channel_summaries() from public,anon;
revoke all on function public.upt_set_chat_typing(uuid,boolean) from public,anon;
revoke all on function public.upt_mark_chat_read(uuid) from public,anon;
revoke all on function public.upt_promotion_chat_unread_counts() from public,anon;
grant execute on function public.upt_chat_typing_users(uuid) to authenticated;
grant execute on function public.upt_chat_channel_summaries() to authenticated;
grant execute on function public.upt_set_chat_typing(uuid,boolean) to authenticated;
grant execute on function public.upt_mark_chat_read(uuid) to authenticated;
grant execute on function public.upt_promotion_chat_unread_counts() to authenticated;
