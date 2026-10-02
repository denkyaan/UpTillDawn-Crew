-- Align channel/message/attachment RLS with the canonical three-day chat retention helper.
drop policy if exists chat_channels_read on public.chat_channels;
create policy chat_channels_read on public.chat_channels
for select to authenticated
using (public.upt_can_read_channel(id));

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages
for select to authenticated
using (public.upt_can_read_channel(channel_id));

drop policy if exists message_attachments_read on public.message_attachments;
create policy message_attachments_read on public.message_attachments
for select to authenticated
using (
  exists (
    select 1 from public.messages m
    where m.id=message_attachments.message_id
      and public.upt_can_read_channel(m.channel_id)
  )
);

notify pgrst,'reload schema';
