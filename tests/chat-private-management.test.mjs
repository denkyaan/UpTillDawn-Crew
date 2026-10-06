import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('private chats can be started used and deleted without exposing message deletion',async()=>{
  const [chat,page,types,migration,catalog]=await Promise.all([
    readFile(new URL('../components/crew/chat-client.tsx',import.meta.url),'utf8'),
    readFile(new URL('../app/(app)/chat/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../types/crew-database.ts',import.meta.url),'utf8'),
    readFile(new URL('../supabase/migrations/20261006121000_private_chat_management.sql',import.meta.url),'utf8'),
    readFile(new URL('../lib/ui-translation-catalog-crew-extra.ts',import.meta.url),'utf8'),
  ])

  assert.match(migration,/c\.name='Up Till Dawn · persoonlijk'/)
  assert.match(migration,/c\.name is null/)
  assert.match(migration,/grant execute on function public\.upt_create_private_chat\(uuid\) to authenticated/)
  assert.match(migration,/upt_delete_private_chat\(p_channel uuid\)/)
  assert.match(migration,/delete from public\.chat_channels where id=p_channel/)
  assert.match(migration,/PRIVATE_CHAT_DELETED/)
  assert.match(page,/s\.rpc\('upt_private_chat_peers'\)/)
  assert.match(page,/params\.channel/)
  assert.match(page,/\['organization','event','workplace','private'\]/)
  assert.match(chat,/upt_create_private_chat/)
  assert.match(chat,/upt_delete_private_chat/)
  assert.match(chat,/MessageCirclePlus/)
  assert.match(chat,/Trash2/)
  assert.match(chat,/privatePeerNames/)
  assert.match(chat,/selectedChannel\.name!=='Up Till Dawn · persoonlijk'/)
  assert.doesNotMatch(chat,/upt_delete_message/)
  assert.match(types,/upt_delete_private_chat/)
  for(const label of ['Nieuwe privéchat','Privéchat verwijderen','Privégesprekken','Zoek persoon…'])assert.ok(catalog.includes(`"${label}"`))
})
