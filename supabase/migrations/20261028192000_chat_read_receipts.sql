-- Read receipts for chat messages. Only channel members can query.
create or replace function public.upt_chat_message_readers(p_message uuid)
returns table(user_id uuid, full_name text, profile_photo_url text, read_at timestamptz)
language plpgsql stable security definer
set search_path='pg_catalog','public','upt_private'
as $$
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
 join public.chat_members cm on cm.channel_id=s.channel_id and cm.user_id=s.user_id
 join public.profiles p on p.id=s.user_id and p.approved=true
 where s.channel_id=v_channel and s.user_id<>auth.uid()
   and s.last_read_at>=v_created
 order by s.last_read_at desc,p.full_name
 limit 200;
end;
$$;
revoke all on function public.upt_chat_message_readers(uuid) from public,anon;
grant execute on function public.upt_chat_message_readers(uuid) to authenticated;
