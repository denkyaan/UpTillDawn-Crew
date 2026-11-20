-- Qualify chat channel lookup columns to avoid PL/pgSQL output-column ambiguity.
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

notify pgrst,'reload schema';
