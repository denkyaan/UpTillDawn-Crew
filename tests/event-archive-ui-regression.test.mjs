import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('event archive lifecycle is recoverable and absent from active surfaces',async()=>{
  const [events,button,center,actions,command,inventory,tasks,briefings,migration,toaster]=await Promise.all([
    read('app/(app)/events/manager-page.tsx'),
    read('components/events/archive-event-button.tsx'),
    read('components/events/archive-center.tsx'),
    read('lib/actions/events.ts'),
    read('app/(app)/events/[id]/command/page.tsx'),
    read('app/(app)/inventory/page.tsx'),
    read('app/(app)/tasks/manager-page.tsx'),
    read('app/(app)/briefings/page.tsx'),
    read('supabase/migrations/20260929075332_event_archive_center_and_restore.sql'),
    read('components/save-success-toaster.tsx'),
  ])
  assert.match(events,/const activeEvents=events\.filter\(event=>event\.status!==['"]archived['"]\)/)
  assert.match(events,/ArchiveCenter/)
  assert.doesNotMatch(button,/window\.confirm/)
  assert.match(button,/Geforceerd archiveren vereist een reden/)
  assert.match(center,/restoreEventWithState/)
  assert.match(actions,/upt_force_archive_event/)
  assert.match(actions,/upt_restore_event/)
  assert.match(command,/Gearchiveerd · alleen-lezen/)
  assert.match(inventory,/\.filter\(workplace=>workplace\.events&&workplace\.events\.status!==['"]archived['"]\)/)
  assert.match(tasks,/s\.from\('events'\)\.select\('id,name,start_at,end_at'\)\.neq\('status','archived'\)/)
  assert.match(tasks,/const activeEvents=\(events\|\|\[\]\)\.filter/)
  assert.match(tasks,/Date\.parse\(event\.start_at\)<=now&&Date\.parse\(event\.end_at\)>=now/)
  assert.match(briefings,/neq\('status','archived'\).*gte\('end_at'/s)
  for(const field of ['archived_at','archived_by','archive_reason','restored_at','restored_by','pre_archive_status'])assert.ok(migration.includes(field))
  assert.match(toaster,/event_archived/)
  assert.match(toaster,/event_restored/)
})

test('legacy event deletion aliases cannot permanently delete event rows',async()=>{
  const actions=await read('lib/actions/uptilldawn.ts')
  assert.doesNotMatch(actions,/from\(['"]events['"]\)\.delete\(/)
  assert.match(actions,/deleteEvent[\s\S]*upt_archive_event/)
})
