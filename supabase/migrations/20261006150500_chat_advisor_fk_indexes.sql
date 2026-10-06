-- Cover foreign keys introduced by the advanced chat experience.
-- These indexes improve cascades/joins and clear Supabase unindexed-FK advisor findings.

create index if not exists chat_pins_message_id_idx
  on upt_private.chat_pins(message_id);

create index if not exists chat_pins_pinned_by_idx
  on upt_private.chat_pins(pinned_by);

create index if not exists chat_typing_states_user_idx
  on upt_private.chat_typing_states(user_id);
