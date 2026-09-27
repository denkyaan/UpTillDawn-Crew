import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  checklistCanClose,
  checklistCompletionRate,
  checklistItemIsComplete,
} from '../lib/checklists.ts'

test('checklist foundation enforces completion and required photo evidence', () => {
  const complete={id:'1',label:'Done',required:true,completedAt:1}
  const photoMissing={id:'2',label:'Photo',required:true,requiresPhoto:true,completedAt:1,photoAttached:false}
  const photoDone={...photoMissing,photoAttached:true}
  assert.equal(checklistItemIsComplete(complete),true)
  assert.equal(checklistItemIsComplete(photoMissing),false)
  assert.equal(checklistItemIsComplete(photoDone),true)
  assert.equal(checklistCanClose({id:'c',kind:'safety',items:[complete,photoMissing]}),false)
  assert.equal(checklistCanClose({id:'c',kind:'safety',items:[complete,photoDone]}),true)
  assert.equal(checklistCompletionRate({id:'c',kind:'safety',items:[complete,photoDone]}),1)
})

test('operational checklist schema is RLS protected and browser mutation is RPC only', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927104024_operational_checklists.sql',import.meta.url),'utf8')
  for(const table of ['operational_checklists','checklist_items'])assert.match(source,new RegExp('alter table public\\.'+table+' enable row level security'))
  assert.match(source,/revoke all on table public\.operational_checklists from anon/)
  assert.match(source,/revoke insert,update,delete on table public\.operational_checklists from authenticated/)
  assert.match(source,/revoke insert,update,delete on table public\.checklist_items from authenticated/)
  assert.match(source,/grant select on table public\.operational_checklists to authenticated/)
  assert.match(source,/grant select on table public\.checklist_items to authenticated/)
  assert.match(source,/upt_current_work_context\(\)/)
})

test('checklist RPCs enforce workplace responsibility active context feature controls and required completion', async () => {
  const base=await readFile(new URL('../supabase/migrations/20260927104024_operational_checklists.sql',import.meta.url),'utf8')
  const hardening=await readFile(new URL('../supabase/migrations/20260927104545_operational_checklist_hardening.sql',import.meta.url),'utf8')
  const source=base+'\n'+hardening
  for(const fn of [
    'upt_create_operational_checklist',
    'upt_add_operational_checklist_item',
    'upt_remove_operational_checklist_item',
    'upt_set_operational_checklist_item',
    'upt_close_operational_checklist',
    'upt_reopen_operational_checklist',
  ])assert.match(source,new RegExp('revoke all on function public\\.'+fn))
  assert.match(source,/upt_is_responsible/)
  assert.match(source,/upt_feature_allowed\('tasks'/)
  assert.match(source,/Checklistpunt kan alleen tijdens je actieve shift/)
  assert.match(source,/Voltooi eerst alle verplichte checklistpunten/)
  assert.match(source,/Voeg minstens één checklistpunt toe/)
})

test('photo-required checklist items validate owned work-media evidence', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927104024_operational_checklists.sql',import.meta.url),'utf8')
  assert.match(source,/Voor dit checklistpunt is een foto verplicht/)
  assert.match(source,/split_part\(v_photo,'\/',1\)<>v_actor::text/)
  assert.match(source,/split_part\(v_photo,'\/',2\)<>'checklist'/)
  assert.match(source,/bucket_id='work-media'/)
  assert.match(source,/upt_work_media_checklist_read/)
})

test('checklist creation reuses existing notification and push delivery pipeline', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927104545_operational_checklist_hardening.sql',import.meta.url),'utf8')
  assert.match(source,/insert into public\.crew_notifications/)
  assert.match(source,/Nieuwe operationele checklist/)
  assert.match(source,/'\/tasks'/)
  assert.match(source,/'checklist'/)
  assert.match(source,/s\.status<>'cancelled'/)
  assert.match(source,/s\.response_status<>'declined'/)
})

test('checklist actions upload and clean evidence safely', async () => {
  const source=await readFile(new URL('../lib/actions/uptilldawn.ts',import.meta.url),'utf8')
  for(const action of [
    'createOperationalChecklist',
    'addOperationalChecklistItem',
    'removeOperationalChecklistItem',
    'completeOperationalChecklistItem',
    'reopenOperationalChecklistItem',
    'closeOperationalChecklist',
    'reopenOperationalChecklist',
  ])assert.ok(source.includes('function '+action),action)
  assert.match(source,/image\/jpeg/)
  assert.match(source,/image\/png/)
  assert.match(source,/image\/webp/)
  assert.match(source,/10\*1024\*1024/)
  assert.match(source,/\/checklist\/\$\{itemId\}\//)
  assert.match(source,/storage\.from\('work-media'\)\.remove/)
})

test('checklist UI is integrated into staff Tasks and manager Workplaces without navigation changes', async () => {
  const [panel,tasks,workplaces]=await Promise.all([
    readFile(new URL('../components/crew/operational-checklists.tsx',import.meta.url),'utf8'),
    readFile(new URL('../app/(app)/tasks/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../app/(app)/workplaces/page.tsx',import.meta.url),'utf8'),
  ])
  for(const label of [
    'Operationele checklists',
    'OPENING',
    'SLUITING',
    'VEILIGHEID',
    'PUNT VOLTOOIEN',
    'PUNT HEROPENEN',
    'CHECKLIST AFRONDEN',
    'CHECKLIST HEROPENEN',
  ])assert.ok(panel.includes(label),label)
  assert.match(tasks,/!manager&&<OperationalChecklistPanel/)
  assert.match(workplaces,/\(isAdmin\|\|isResponsible\)&&<OperationalChecklistPanel/)
})
