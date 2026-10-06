-- Restore safe 1:1 private chats while keeping the Up Till Dawn system chat protected.

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
$$;

revoke all on function public.upt_can_read_channel(uuid) from public,anon;
grant execute on function public.upt_can_read_channel(uuid) to authenticated;

create or replace function public.upt_create_private_chat(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_actor uuid:=auth.uid();
  v_channel uuid;
  v_pair text;
begin
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;
  if p_user is null or p_user=v_actor then raise exception 'Ongeldige gesprekspartner.'; end if;

  if not exists(
    select 1 from public.profiles p
    where p.id=p_user
      and p.approved=true
      and coalesce(p.account_blocked,false)=false
  ) then
    raise exception 'Crewlid niet beschikbaar.';
  end if;

  v_pair:=least(v_actor::text,p_user::text)||':'||greatest(v_actor::text,p_user::text);
  perform pg_advisory_xact_lock(hashtextextended(v_pair,0));

  select c.id into v_channel
  from public.chat_channels c
  where c.kind='private'
    and c.name is null
    and exists(select 1 from public.chat_members mine where mine.channel_id=c.id and mine.user_id=v_actor)
    and exists(select 1 from public.chat_members peer where peer.channel_id=c.id and peer.user_id=p_user)
    and 2=(select count(*) from public.chat_members members where members.channel_id=c.id)
  order by c.created_at
  limit 1;

  if v_channel is null then
    insert into public.chat_channels(kind,name)
    values('private',null)
    returning id into v_channel;

    insert into public.chat_members(channel_id,user_id)
    values(v_channel,v_actor),(v_channel,p_user);

    insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(v_actor,'PRIVATE_CHAT_CREATED','chat_channel',v_channel,jsonb_build_object('peer_id',p_user));
  end if;

  return v_channel;
end;
$$;

revoke all on function public.upt_create_private_chat(uuid) from public,anon;
grant execute on function public.upt_create_private_chat(uuid) to authenticated;

create or replace function public.upt_private_chat_peers()
returns table(
  channel_id uuid,
  user_id uuid,
  full_name text,
  phone_number text,
  profile_photo_url text
)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;

  return query
  select c.id,p.id,p.full_name,p.phone_number,p.profile_photo_url
  from public.chat_channels c
  join public.chat_members mine
    on mine.channel_id=c.id
   and mine.user_id=auth.uid()
  join public.chat_members peer
    on peer.channel_id=c.id
   and peer.user_id<>auth.uid()
  join public.profiles p
    on p.id=peer.user_id
  where c.kind='private'
    and c.name is null
    and 2=(select count(*) from public.chat_members members where members.channel_id=c.id)
    and p.approved=true
    and coalesce(p.account_blocked,false)=false
  order by c.created_at desc;
end;
$$;

revoke all on function public.upt_private_chat_peers() from public,anon;
grant execute on function public.upt_private_chat_peers() to authenticated;

create or replace function public.upt_delete_private_chat(p_channel uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_actor uuid:=auth.uid();
  v_peer uuid;
begin
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;

  select peer.user_id into v_peer
  from public.chat_channels c
  join public.chat_members mine
    on mine.channel_id=c.id
   and mine.user_id=v_actor
  join public.chat_members peer
    on peer.channel_id=c.id
   and peer.user_id<>v_actor
  where c.id=p_channel
    and c.kind='private'
    and c.name is null
    and 2=(select count(*) from public.chat_members members where members.channel_id=c.id)
  limit 1;

  if v_peer is null then raise exception 'Privéchat niet gevonden.'; end if;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'PRIVATE_CHAT_DELETED','chat_channel',p_channel,jsonb_build_object('peer_id',v_peer));

  delete from public.chat_channels where id=p_channel;
end;
$$;

revoke all on function public.upt_delete_private_chat(uuid) from public,anon;
grant execute on function public.upt_delete_private_chat(uuid) to authenticated;

notify pgrst,'reload schema';
