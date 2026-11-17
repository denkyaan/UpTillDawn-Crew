-- Main performance repair: the shell's unread badge must not materialize
-- chat_channel_summaries, which also calculates unread mentions, pin counts,
-- mute mode, permissions and peer reads on every layout/focus refresh.
-- Preserve exact unread semantics and per-channel authorization. No chat writes.
create or replace function public.upt_chat_unread_total()
returns bigint
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid := auth.uid();
  v_total bigint;
begin
  if v_actor is null or not public.upt_is_approved() then
    raise exception 'ACCOUNT NOT APPROVED';
  end if;

  -- MATERIALIZED ensures the expensive authorization predicate only executes
  -- for channels which actually have unread messages. For an empty inbox,
  -- zero per-channel permission RPCs are needed. The message index on
  -- (channel_id,created_at) supports each bounded unread count.
  with pending as materialized (
    select c.id as channel_id,
      (select count(*)::bigint
       from public.messages m
       where m.channel_id = c.id
         and m.sender_id is distinct from v_actor
         and m.moderated_at is null
         and m.created_at > coalesce(st.last_read_at,now())
      ) as unread_count
    from public.chat_channels c
    left join upt_private.chat_user_states st
      on st.channel_id = c.id and st.user_id = v_actor
  )
  select coalesce(sum(p.unread_count),0)::bigint
    into v_total
    from pending p
   where p.unread_count > 0
     and public.upt_can_read_channel(p.channel_id);

  return coalesce(v_total,0);
end;
$function$;

-- This SECURITY DEFINER routine is intentionally callable only by signed-in
-- users. It uses auth.uid() and the existing can-read channel predicate.
revoke all on function public.upt_chat_unread_total() from public,anon;
grant execute on function public.upt_chat_unread_total() to authenticated;
