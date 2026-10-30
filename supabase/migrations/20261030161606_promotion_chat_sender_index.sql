-- Cover sender lookups and referential checks for promotion chat.
create index if not exists promotion_chat_messages_sender_id_idx
 on public.promotion_chat_messages(sender_id);
