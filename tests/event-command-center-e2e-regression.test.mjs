import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('event lifecycle command center connects templates readiness operations and post-event controls',async()=>{
  const [events,command,actions,migration]=await Promise.all([
    read('app/(app)/events/page.tsx'),
    read('app/(app)/events/[id]/command/page.tsx'),
    read('lib/actions/events.ts'),
    read('supabase/migrations/20260928211500_event_command_center_and_close_workflow.sql'),
  ])
  assert.match(events,/EVENTTEMPLATES/)
  assert.match(events,/captureEventTemplate/)
  assert.match(events,/applyEventTemplate/)
  assert.match(events,/COMMAND CENTER/)
  assert.match(command,/upt_event_command_snapshot/)
  for(const requirement of ['Verantwoordelijken','Bezetting','Briefing','Openingschecklists','Inventory','Incidenten']){
    assert.ok(command.includes(requirement),requirement)
  }
  assert.match(command,/Post-event afsluiting/)
  assert.match(actions,/upt_close_event/)
  assert.match(actions,/upt_archive_event/)
  assert.match(migration,/readiness/)
  assert.match(migration,/active_sessions|actieve werkuren/)
  assert.match(migration,/closing_checklists|sluitchecklists/)
})

test('inventory models assets separately and templates preserve asset identity data',async()=>{
  const [materials,actions,assetMigration,templateMigration]=await Promise.all([
    read('components/crew/workplace-inventory-materials.tsx'),
    read('lib/actions/uptilldawn.ts'),
    read('supabase/migrations/20260928213500_inventory_asset_details.sql'),
    read('supabase/migrations/20260928214000_event_template_asset_carryover.sql'),
  ])
  for(const label of ['Herbruikbaar asset','Verbruiksartikel','Assetcode','Barcode','Serienummer']){
    assert.ok(materials.includes(label),label)
  }
  assert.match(actions,/upt_set_inventory_asset_details/)
  assert.match(assetMigration,/inventory_serial_event_unique/)
  assert.match(templateMigration,/itemKind/)
  assert.match(templateMigration,/serialNumber/)
  assert.match(templateMigration,/upt_apply_event_template_v2/)
})

test('critical offline replay includes checklist guestlist and sales operations',async()=>{
  const migration=await read('supabase/migrations/20260928213000_offline_guestlist_checklist_sales_queue.sql')
  assert.match(migration,/when 'checklist_item'/)
  assert.match(migration,/upt_set_operational_checklist_item/)
  assert.match(migration,/when 'guestlist_checkin'/)
  assert.match(migration,/upt_guestlist_checkin/)
  assert.match(migration,/when 'sale'/)
  assert.match(migration,/upt_sales_record/)
  assert.match(migration,/offline_operation_records/)
})

test('admin AI receives active event context and audit exposes mutation detail',async()=>{
  const [assistant,route,audit,auditMigration]=await Promise.all([
    read('components/admin/platform-ai-assistant.tsx'),
    read('app/api/admin-assistant/route.ts'),
    read('app/(app)/audit/page.tsx'),
    read('supabase/migrations/20260928212500_expanded_change_audit_trail.sql'),
  ])
  assert.match(assistant,/eventId/)
  assert.match(route,/activeEventId/)
  assert.match(route,/inEvent/)
  assert.match(audit,/Wijzigingslog/)
  assert.match(audit,/metadata/)
  assert.match(auditMigration,/jsonb_build_object\('old',v_old,'new',v_new\)/)
})

test('briefing owns workplace checklists while inventory and workplaces keep separate responsibilities',async()=>{
  const [briefing,inventory,workplaces,sales]=await Promise.all([
    read('app/(app)/briefings/page.tsx'),
    read('app/(app)/inventory/page.tsx'),
    read('app/(app)/workplaces/page.tsx'),
    read('app/(app)/sales/page.tsx'),
  ])
  assert.match(briefing,/OperationalChecklistPanel/)
  assert.doesNotMatch(inventory,/OperationalChecklistPanel/)
  assert.doesNotMatch(workplaces,/OperationalChecklistPanel/)
  assert.match(workplaces,/Standaardwerkposten/)
  assert.match(sales,/Totale netto-inkomsten/)
  assert.match(sales,/Merchandise-inkomsten/)
  assert.match(sales,/Token- en kassaverkoop/)
})
