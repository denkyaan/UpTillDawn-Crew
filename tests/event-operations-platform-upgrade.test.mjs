import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('event operations architecture keeps templates readiness checklists audit and offline queue connected',async()=>{
  const [
    eventsPage,
    commandPage,
    briefingPage,
    checklistPanel,
    eventActions,
    auditPage,
    offlineMigration,
    checklistTemplateMigration,
  ]=await Promise.all([
    readFile(new URL('../app/(app)/events/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../app/(app)/events/[id]/command/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../app/(app)/briefings/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../components/crew/operational-checklists.tsx',import.meta.url),'utf8'),
    readFile(new URL('../lib/actions/events.ts',import.meta.url),'utf8'),
    readFile(new URL('../app/(app)/audit/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../supabase/migrations/20260928213000_offline_guestlist_checklist_sales_queue.sql',import.meta.url),'utf8'),
    readFile(new URL('../supabase/migrations/20260928215000_operational_checklist_templates.sql',import.meta.url),'utf8'),
  ])

  assert.match(eventsPage,/EVENTTEMPLATES/)
  assert.match(eventsPage,/COMMAND CENTER/)
  assert.match(eventActions,/upt_apply_event_template_v2/)
  assert.match(commandPage,/Event readiness/)
  assert.match(commandPage,/Post-event afsluiting/)
  assert.match(commandPage,/upt_event_command_snapshot/)
  assert.match(briefingPage,/OperationalChecklistPanel/)
  assert.match(checklistPanel,/Checklisttemplate toepassen/)
  assert.match(checklistPanel,/upt_apply_operational_checklist_template|applyOperationalChecklistTemplate/)
  assert.match(auditPage,/Wijzigingslog/)
  assert.match(offlineMigration,/when 'checklist_item'/)
  assert.match(offlineMigration,/when 'guestlist_checkin'/)
  assert.match(offlineMigration,/when 'sale'/)
  assert.match(checklistTemplateMigration,/Bar openen/)
  assert.match(checklistTemplateMigration,/Inkom & Guestlist openen/)
  assert.match(checklistTemplateMigration,/Backstage openen/)
})
