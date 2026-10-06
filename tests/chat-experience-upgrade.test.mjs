import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('advanced chat experience remains wired end to end',async()=>{
  const [chat,layout,page,queue,types,migration,catalog,push]=await Promise.all([
    readFile(new URL('../components/crew/chat-client.tsx',import.meta.url),'utf8'),
    readFile(new URL('../components/layout/app-layout.tsx',import.meta.url),'utf8'),
    readFile(new URL('../app/(app)/chat/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../lib/crew-queue.ts',import.meta.url),'utf8'),
    readFile(new URL('../types/crew-database.ts',import.meta.url),'utf8'),
    readFile(new URL('../supabase/migrations/20261006124500_chat_experience_upgrade.sql',import.meta.url),'utf8'),
    readFile(new URL('../lib/ui-translation-catalog-crew-extra.ts',import.meta.url),'utf8'),
    readFile(new URL('../supabase/functions/push-notification/i18n.ts',import.meta.url),'utf8'),
  ])

  for(const rpc of [
    'upt_mark_chat_read','upt_set_chat_mute','upt_chat_channel_summaries','upt_chat_unread_total',
    'upt_set_chat_typing','upt_chat_typing_users','upt_chat_pins','upt_toggle_chat_pin',
    'upt_search_chat_messages','upt_send_chat_message_operation_v2','upt_send_chat_photo_message_operation_v2',
  ])assert.ok(migration.includes(rpc),rpc)

  assert.match(migration,/mentioned_user_ids uuid\[\]/)
  assert.match(migration,/chat_reply/)
  assert.match(migration,/chat_mention/)
  assert.match(migration,/chat_message/)
  assert.match(migration,/\/chat\?channel=%s&message=%s/)
  assert.match(migration,/c\.kind in \('event','workplace'\) and public\.upt_is_admin\(\)/)
  assert.match(migration,/maximaal 5 berichten/)
  assert.match(migration,/mute_mode in \('all','mentions','muted'\)/)

  assert.match(queue,/mention_ids/)
  assert.match(queue,/upt_send_chat_message_operation_v2/)
  assert.match(queue,/upt_send_chat_photo_message_operation_v2/)

  assert.match(page,/upt_chat_channel_summaries/)
  assert.match(page,/focusMessageId=\{params\.message\|\|null\}/)

  assert.match(layout,/upt_chat_unread_total/)
  assert.match(layout,/uptilldawn-chat-read/)

  assert.match(chat,/Oudere berichten laden/)
  assert.match(chat,/Nieuwe berichten/)
  assert.match(chat,/upt_chat_typing_users/)
  assert.match(chat,/upt_set_chat_typing/)
  assert.match(chat,/upt_search_chat_messages/)
  assert.match(chat,/upt_toggle_chat_pin/)
  assert.match(chat,/upt_set_chat_mute/)
  assert.match(chat,/peer_last_read_at/)
  assert.match(chat,/Gelezen/)
  assert.match(chat,/Afgeleverd/)
  assert.match(chat,/draftFilesRef/)
  assert.match(chat,/uptilldawn-chat-draft/)
  assert.match(chat,/mentionIdsForText/)
  assert.match(chat,/ring-2 ring-amber-300/)
  assert.match(chat,/unread=\{Number\(channelStates\[channel\.id\]\?\.unread_count/)
  assert.match(chat,/mentions=\{Number\(channelStates\[channel\.id\]\?\.mention_count/)

  assert.match(types,/upt_chat_channel_summaries/)
  assert.match(types,/upt_search_chat_messages/)
  assert.match(types,/upt_set_chat_mute/)
  assert.match(types,/mentioned_user_ids/)

  for(const label of [
    'Nieuwe berichten','Oudere berichten laden','Alleen @mentions en antwoorden','Meldingen voor deze chat',
    'Zoeken in chat','Vastgepind','Gelezen','Afgeleverd','Verzenden…','Verzonden.',
  ])assert.ok(catalog.includes(`"${label}"`),label)

  assert.match(push,/chatDynamic/)
  assert.match(push,/heeft je vermeld in/)
  assert.match(push,/heeft op je bericht geantwoord/)
})
