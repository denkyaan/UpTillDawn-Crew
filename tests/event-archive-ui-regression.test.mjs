import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('archived events disappear from the admin active overview and use the canonical archive action',async()=>{
  const [events,button,actions]=await Promise.all([
    read('app/(app)/events/page.tsx'),
    read('components/events/delete-event-button.tsx'),
    read('lib/actions/events.ts'),
  ])

  assert.match(events,/user\.isAdmin\s*\?\s*events\.filter\(event=>event\.status!==['"]archived['"]\)/)
  assert.match(button,/import \{ archiveEvent \} from ["']@\/lib\/actions\/events["']/)
  assert.match(button,/form action=\{archiveEvent\}/)
  assert.match(actions,/s\.rpc\(['"]upt_archive_event['"]/)
})
