import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('chat replies and scoped @mentions stay wired end to end',async()=>{
  const [chat,queue,types,migration,route,catalog]=await Promise.all([
    readFile(new URL('../components/crew/chat-client.tsx',import.meta.url),'utf8'),
    readFile(new URL('../lib/crew-queue.ts',import.meta.url),'utf8'),
    readFile(new URL('../types/crew-database.ts',import.meta.url),'utf8'),
    readFile(new URL('../supabase/migrations/20261006120000_chat_reply_mentions.sql',import.meta.url),'utf8'),
    readFile(new URL('../app/api/translate-chat/route.ts',import.meta.url),'utf8'),
    readFile(new URL('../lib/ui-translation-catalog-crew-extra.ts',import.meta.url),'utf8'),
  ])

  assert.match(migration,/reply_to_message_id uuid null references public\.messages\(id\) on delete set null/)
  assert.match(migration,/create index if not exists messages_reply_to_message_id_idx/)
  assert.match(migration,/upt_chat_channel_people\(p_channel uuid\)/)
  assert.match(migration,/not public\.upt_can_read_channel\(p_channel\)/)
  assert.match(migration,/v_channel\.kind='organization'/)
  assert.match(migration,/v_channel\.kind='event'/)
  assert.match(migration,/v_channel\.kind='workplace'/)
  assert.match(migration,/upt_send_chat_message_operation/)
  assert.match(migration,/m\.id=p_reply_to and m\.channel_id=p_channel/)
  assert.match(migration,/upt_send_chat_photo_message_operation/)
  assert.match(queue,/upt_send_chat_message_operation/)
  assert.match(queue,/reply_to_message_id/)
  assert.match(queue,/upt_send_chat_photo_message_operation/)
  assert.match(chat,/translateRuntimeUi\('Antwoorden',uiLocale\)/)
  assert.match(chat,/reply_to_message_id/)
  assert.match(chat,/upt_chat_channel_people/)
  assert.match(chat,/lastIndexOf\('@'\)/)
  assert.match(chat,/max-h-56 overflow-y-auto/)
  assert.match(chat,/full\.startsWith\(query\)/)
  assert.match(chat,/MentionedText/)
  assert.match(route,/Preserve names, @mentions/)
  assert.match(types,/upt_chat_channel_people/)
  assert.match(types,/upt_send_chat_message_operation/)
  assert.match(types,/upt_send_chat_photo_message_operation/)
  for(const label of ['Antwoorden','Antwoord op','Antwoord verwijderen','Geen personen gevonden.'])assert.ok(catalog.includes(`"${label}"`))
})
