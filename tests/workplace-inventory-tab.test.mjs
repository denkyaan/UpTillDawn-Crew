import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('inventory is a workplace-scoped role navigation feature', async () => {
  const nav = await readFile(new URL('../components/layout/navigation-items.ts', import.meta.url), 'utf8')
  const roles = await readFile(new URL('../lib/role-ui.ts', import.meta.url), 'utf8')
  const layout = await readFile(new URL('../components/layout/app-layout.tsx', import.meta.url), 'utf8')

  assert.ok(nav.includes('key:"inventory"'))
  assert.ok(nav.includes('href:"/inventory"'))
  assert.ok(roles.includes('navRule("admin","inventory","Inventaris"'))
  assert.match(roles,/navRule\("responsible_lead","inventory","Inventaris",\d+,"assigned_workplace_role"\)/)
  assert.match(roles,/navRule\("staff","inventory","Inventaris",\d+,"assigned_workplace_role"\)/)
  assert.ok(layout.includes('pathname.startsWith("/inventory")?"inventory"'))
  assert.ok(layout.includes('inventory:showInventory'))
})

test('inventory stays workplace scoped while operational checklists live in briefing', async () => {
  const page = await readFile(new URL('../app/(app)/inventory/page.tsx', import.meta.url), 'utf8')
  const briefing = await readFile(new URL('../app/(app)/briefings/page.tsx', import.meta.url), 'utf8')
  const workplaces = await readFile(new URL('../app/(app)/workplaces/page.tsx', import.meta.url), 'utf8')
  const documents = await readFile(new URL('../components/crew/event-documents-panel.tsx', import.meta.url), 'utf8')

  assert.ok(page.includes('workplaceId={workplace.id}'))
  assert.ok(page.includes('showTextEntry={isAdmin}'))
  assert.ok(!page.includes('OperationalChecklistPanel'))
  assert.ok(!workplaces.includes('OperationalChecklistPanel'))
  assert.ok(briefing.includes('OperationalChecklistPanel'))
  assert.ok(briefing.includes("kinds={['opening','closing','safety','custom']}"))
  assert.ok(briefing.includes('workplaceOptions={workplaces.map'))
  assert.ok(documents.includes("query=query.eq('workplace_id',workplaceId)"))
  assert.ok(documents.includes('createInventoryTextEntry'))
})

test('admin overview no longer exposes health or release shortcuts', async () => {
  const admin = await readFile(new URL('../app/(app)/admin/page.tsx', import.meta.url), 'utf8')
  assert.ok(!admin.includes('href="/admin/health"'))
  assert.ok(!admin.includes('href="/admin/release"'))
  assert.ok(admin.includes('href="/admin/time-records"'))
})


test('admin inventory is always accessible and workplace materials are synchronized', async () => {
  const layout = await readFile(new URL('../components/layout/app-layout.tsx', import.meta.url), 'utf8')
  const page = await readFile(new URL('../app/(app)/inventory/page.tsx', import.meta.url), 'utf8')
  const materials = await readFile(new URL('../components/crew/workplace-inventory-materials.tsx', import.meta.url), 'utf8')
  const migration = await readFile(new URL('../supabase/migrations/20260928014432_inventory_workplace_condition_reporting.sql', import.meta.url), 'utf8')

  assert.ok(layout.includes('pathname.startsWith("/inventory")'))
  assert.ok(layout.includes('const showInventory=Boolean(isAdmin)||feature("inventory",context.assignedWorkplaceRole)'))
  assert.ok(page.includes('const visible=isAdmin'))
  assert.ok(page.includes("from('inventory_items')"))
  assert.ok(page.includes('materials={materials.filter(item=>item.workplace_id===workplace.id)}'))
  assert.ok(materials.includes('Materiaal toevoegen aan deze werkplek'))
  assert.ok(materials.includes('Voorraad gekoppeld aan'))
  assert.match(migration,/public\.upt_is_admin\(\(select auth\.uid\(\)\)\)/)
  assert.match(migration,/s\.workplace_id=p_workplace/)
  assert.match(migration,/s\.status<>'cancelled'/)
})

test('responsible can report missing or damaged inventory at opening and closing', async () => {
  const materials = await readFile(new URL('../components/crew/workplace-inventory-materials.tsx', import.meta.url), 'utf8')
  const actions = await readFile(new URL('../lib/actions/uptilldawn.ts', import.meta.url), 'utf8')
  const migration = await readFile(new URL('../supabase/migrations/20260928014432_inventory_workplace_condition_reporting.sql', import.meta.url), 'utf8')

  assert.ok(materials.includes('OPSTARTCONTROLE'))
  assert.ok(materials.includes('SLUITCONTROLE'))
  assert.ok(materials.includes('value="missing"'))
  assert.ok(materials.includes('value="damaged"'))
  assert.ok(actions.includes('reportWorkplaceInventoryCondition'))
  assert.ok(actions.includes("z.enum(['opening','closing'])"))
  assert.match(migration,/upt_report_workplace_inventory_condition/)
  assert.match(migration,/p_phase not in \('opening','closing'\)/)
  assert.match(migration,/p_condition not in \('damaged','missing'\)/)
  assert.match(migration,/available_quantity=available_quantity-p_quantity/)
  assert.match(migration,/inventory\.workplace\.'\|\|p_phase\|\|'\.'\|\|p_condition/)
})
