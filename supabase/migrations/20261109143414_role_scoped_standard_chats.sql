-- Consolidated role-scoped defaults, with historical Promotion messages retained.

-- Preserve the existing general-channel ID and its complete message history.
update public.chat_channels set name='Algemene chat evenementen'
 where kind='organization' and name in ('Algemene chat','General chat');
insert into public.chat_channels(kind,name)
select 'organization','Algemene chat evenementen'
where not exists(select 1 from public.chat_channels where kind='organization' and name='Algemene chat evenementen');
insert into public.chat_channels(kind,name)
select 'organization','Algemene chat promotie'
where not exists(select 1 from public.chat_channels where kind='organization' and name='Algemene chat promotie');
insert into public.chat_channels(kind,name)
select 'organization','Admin · Administratie'
where not exists(select 1 from public.chat_channels where kind='organization' and name='Admin · Administratie');
create unique index if not exists upt_chat_unique_standard_organization
 on public.chat_channels(name) where kind='organization'
 and name in ('Algemene chat evenementen','Algemene chat promotie','Admin · Administratie');

-- Import the former Promotion groups, without removing or rewriting the archive.
-- Historical announcement messages become prefixed messages in the single Promotion room.
-- Preserve UUIDs and timestamps, and link historical replies in a second pass.
alter table public.messages disable trigger upt_chat_message_notifications;
insert into public.messages(id,channel_id,sender_id,user_id,body,content,created_at)
select old.id,c.id,old.sender_id,old.sender_id,
 case when old.room='announcements' then '📣 '||old.body else old.body end,
 case when old.room='announcements' then '📣 '||old.body else old.body end,
 old.created_at
from public.promotion_chat_messages old
cross join public.chat_channels c
where c.kind='organization' and c.name='Algemene chat promotie'
on conflict (id) do nothing;
update public.messages m set reply_to_message_id=old.reply_to_message_id
from public.promotion_chat_messages old join public.chat_channels c
 on c.kind='organization' and c.name='Algemene chat promotie'
where m.id=old.id and m.channel_id=c.id
 and old.reply_to_message_id is not null
 and exists(select 1 from public.messages parent where parent.id=old.reply_to_message_id and parent.channel_id=c.id);
alter table public.messages enable trigger upt_chat_message_notifications;
-- The former Promotion tables remain readable as an archive; new writes use messages.
revoke insert on public.promotion_chat_messages from authenticated;
drop policy if exists promotion_chat_send on public.promotion_chat_messages;


-- One canonical membership gate for fixed organization conversations, reused
-- by RLS, channel membership listings, reader receipts and notifications.
create or replace function upt_private.chat_standard_allowed(p_channel uuid,p_user uuid)
returns boolean language plpgsql stable security definer
set search_path='pg_catalog','public','upt_private' as $chat_role$
declare
 v_name text;
 v_admin boolean:=false;
 v_administration boolean:=false;
 v_events boolean:=false;
 v_promotion boolean:=false;
begin
 if p_user is null then return false; end if;
 select c.name into v_name from public.chat_channels c
 where c.id=p_channel and c.kind='organization';
 if v_name is null then return false; end if;
 if not exists(select 1 from public.profiles p
  where p.id=p_user and p.approved and not coalesce(p.account_blocked,false)) then return false; end if;

 v_admin:=public.upt_is_admin(p_user) or exists(
  select 1 from public.upt_personnel_role_slots rs where rs.user_id=p_user
   and (rs.role_one in ('head','left_hand','right_hand') or rs.role_two in ('head','left_hand','right_hand')));
 v_administration:=exists(
  select 1 from public.upt_personnel_role_slots rs where rs.user_id=p_user and
  (rs.role_one='administration' or rs.role_two='administration'))
  or exists(select 1 from public.portal_role_assignments a where a.user_id=p_user
   and a.portal='administration' and a.approved and a.revoked_at is null);
 if v_admin or v_administration then return v_name in
  ('Algemene chat evenementen','Algemene chat promotie','Admin · Administratie'); end if;
 v_events:=exists(select 1 from public.upt_personnel_role_slots rs where rs.user_id=p_user and
  (rs.role_one in ('staff','responsible_lead') or rs.role_two in ('staff','responsible_lead')))
  or exists(select 1 from public.portal_role_assignments a where a.user_id=p_user
   and a.portal='events' and a.approved and a.revoked_at is null)
  or exists(select 1 from public.profiles p where p.id=p_user
   and p.role in ('staff','responsible_lead')
   and not exists(select 1 from public.upt_personnel_role_slots rs where rs.user_id=p_user)
   and not exists(select 1 from public.portal_role_assignments a where a.user_id=p_user and a.approved and a.revoked_at is null));
 v_promotion:=not exists(select 1 from public.promotion_discipline d where d.user_id=p_user
    and (d.permanently_blocked or d.blocked_until>now()))
  and (exists(select 1 from public.upt_personnel_role_slots rs where rs.user_id=p_user
    and (rs.role_one='promotion' or rs.role_two='promotion'))
   or exists(select 1 from public.portal_role_assignments a where a.user_id=p_user
    and a.portal='promotion' and a.approved and a.revoked_at is null));
 return (v_name='Algemene chat evenementen' and v_events)
     or (v_name='Algemene chat promotie' and v_promotion);
end;
$chat_role$;
revoke all on function upt_private.chat_standard_allowed(uuid,uuid) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.upt_can_read_channel(p_channel uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.upt_is_approved()
    and exists(
      select 1
      from public.chat_channels c
      where c.id=p_channel
        and (
          (c.kind='organization' and upt_private.chat_standard_allowed(c.id,(select auth.uid())))
          or (
            c.kind='private'
            and exists(
              select 1 from public.chat_members cm
              where cm.channel_id=c.id
                and cm.user_id=(select auth.uid())
            )
            and (
              (
                c.name='Up Till Dawn · persoonlijk'
                and 1=(select count(*) from public.chat_members cm2 where cm2.channel_id=c.id)
              )
              or (
                c.name is null
                and 2=(select count(*) from public.chat_members cm3 where cm3.channel_id=c.id)
              )
            )
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
$function$;

CREATE OR REPLACE FUNCTION public.upt_chat_channel_people(p_channel uuid)
 RETURNS TABLE(id uuid, full_name text, profile_photo_url text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_channel public.chat_channels%rowtype;
begin
  if auth.uid() is null or not public.upt_is_approved() then
    raise exception 'ACCOUNT NOT APPROVED';
  end if;

  if not public.upt_can_read_channel(p_channel) then
    raise exception 'Geen toegang tot chat.';
  end if;

  select c.* into v_channel
  from public.chat_channels c
  where c.id=p_channel;

  if not found then raise exception 'Chat niet gevonden.'; end if;

  return query
  select distinct p.id,p.full_name,p.profile_photo_url
  from public.profiles p
  where p.approved=true
    and coalesce(p.account_blocked,false)=false
    and nullif(trim(p.full_name),'') is not null
    and (
      (v_channel.kind='organization' and upt_private.chat_standard_allowed(v_channel.id,p.id))
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
$function$;

CREATE OR REPLACE FUNCTION public.upt_chat_message_readers(p_message uuid)
 RETURNS TABLE(user_id uuid, full_name text, profile_photo_url text, read_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'upt_private'
AS $function$
declare v_channel uuid; v_created timestamptz;
begin
 select m.channel_id,m.created_at into v_channel,v_created
 from public.messages m where m.id=p_message and m.moderated_at is null;
 if v_channel is null or not public.upt_is_approved() or not public.upt_can_read_channel(v_channel) then
   raise exception 'Geen toegang tot leesbevestigingen.';
 end if;
 return query
 select p.id,p.full_name,p.profile_photo_url,s.last_read_at
 from upt_private.chat_user_states s
 left join public.chat_members cm on cm.channel_id=s.channel_id and cm.user_id=s.user_id
 join public.profiles p on p.id=s.user_id and p.approved=true
 where s.channel_id=v_channel and s.user_id<>auth.uid() and (
  cm.user_id is not null or exists(select 1 from public.chat_channels c where c.id=v_channel and c.kind='organization' and upt_private.chat_standard_allowed(c.id,s.user_id))
 )
   and s.last_read_at>=v_created
 order by s.last_read_at desc,p.full_name
 limit 200;
end;
$function$;

CREATE OR REPLACE FUNCTION upt_private.notify_chat_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'upt_private'
AS $function$
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
  -- System messages (including birthday cron messages) run without an authenticated
  -- user context and already have their own notification workflow.
  if new.sender_id is null then return new; end if;

  -- Initialize unread tracking immediately on the first new human message a participant can see.
  -- This avoids marking historical backlog unread while still counting the first post-upgrade message.
  for v_recipient in
    select p.id
    from public.profiles p
    where p.approved is true
      and coalesce(p.account_blocked,false)=false
      and (
        exists(select 1 from public.chat_channels c where c.id=new.channel_id and c.kind='organization' and upt_private.chat_standard_allowed(c.id,p.id))
        or exists(
          select 1 from public.chat_channels c
          join public.events e on e.id=c.event_id
          where c.id=new.channel_id
            and c.kind='event'
            and e.status<>'archived'
            and (
              exists(select 1 from public.event_members em where em.event_id=c.event_id and em.user_id=p.id)
              or exists(select 1 from public.shifts s where s.event_id=c.event_id and s.user_id=p.id and s.status<>'cancelled')
              or exists(select 1 from public.responsible_assignments ra where ra.event_id=c.event_id and ra.user_id=p.id)
            )
        )
        or exists(
          select 1 from public.chat_channels c
          where c.id=new.channel_id
            and c.kind='workplace'
            and (
              exists(select 1 from public.shifts s where s.event_id=c.event_id and s.workplace_id=c.workplace_id and s.user_id=p.id and s.status<>'cancelled')
              or exists(select 1 from public.responsible_assignments ra where ra.event_id=c.event_id and ra.workplace_id=c.workplace_id and ra.user_id=p.id)
            )
        )
        or exists(
          select 1 from public.chat_channels c
          join public.chat_members cm on cm.channel_id=c.id and cm.user_id=p.id
          where c.id=new.channel_id and c.kind='private'
        )
      )
  loop
    insert into upt_private.chat_user_states(channel_id,user_id,last_read_at,mute_mode,updated_at)
    values(
      new.channel_id,
      v_recipient.id,
      new.created_at-interval '1 microsecond',
      coalesce(upt_private.chat_default_mute_mode(new.channel_id),'mentions'),
      now()
    )
    on conflict(channel_id,user_id) do nothing;
  end loop;

  select coalesce(nullif(trim(p.full_name),''),'Personeelslid') into v_sender_name
  from public.profiles p where p.id=new.sender_id;

  select * into v_channel from public.chat_channels c where c.id=new.channel_id;
  if not found then return new; end if;

  v_channel_label:=case
    when v_channel.kind='organization' then coalesce(v_channel.name,'Algemene chat')
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
    select p.id
    from public.profiles p
    where p.approved is true
      and coalesce(p.account_blocked,false)=false
      and p.id<>new.sender_id
      and (
        exists(select 1 from public.chat_channels c where c.id=new.channel_id and c.kind='organization' and upt_private.chat_standard_allowed(c.id,p.id))
        or exists(
          select 1 from public.chat_channels c
          join public.events e on e.id=c.event_id
          where c.id=new.channel_id
            and c.kind='event'
            and e.status<>'archived'
            and (
              exists(select 1 from public.event_members em where em.event_id=c.event_id and em.user_id=p.id)
              or exists(select 1 from public.shifts s where s.event_id=c.event_id and s.user_id=p.id and s.status<>'cancelled')
              or exists(select 1 from public.responsible_assignments ra where ra.event_id=c.event_id and ra.user_id=p.id)
            )
        )
        or exists(
          select 1 from public.chat_channels c
          where c.id=new.channel_id
            and c.kind='workplace'
            and (
              exists(select 1 from public.shifts s where s.event_id=c.event_id and s.workplace_id=c.workplace_id and s.user_id=p.id and s.status<>'cancelled')
              or exists(select 1 from public.responsible_assignments ra where ra.event_id=c.event_id and ra.workplace_id=c.workplace_id and ra.user_id=p.id)
            )
        )
        or exists(
          select 1 from public.chat_channels c
          join public.chat_members cm on cm.channel_id=c.id and cm.user_id=p.id
          where c.id=new.channel_id and c.kind='private'
        )
      )
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
$function$;

notify pgrst,'reload schema';
