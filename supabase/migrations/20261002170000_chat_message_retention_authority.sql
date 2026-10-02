-- Keep message visibility aligned with the channel authorization contract during post-event retention.
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages
for select to authenticated
using (
  exists (
    select 1 from public.chat_channels c
    where c.id=messages.channel_id
      and public.upt_can_read_channel(c.id)
  )
);

drop policy if exists message_attachments_read on public.message_attachments;
create policy message_attachments_read on public.message_attachments
for select to authenticated
using (
  exists (
    select 1
    from public.messages m
    join public.chat_channels c on c.id=m.channel_id
    where m.id=message_attachments.message_id
      and public.upt_can_read_channel(c.id)
  )
);
notify pgrst,'reload schema';
