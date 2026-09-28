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
  assert.ok(roles.includes('navRule("responsible_lead","inventory","Inventaris",75,"assigned_workplace_role")'))
  assert.ok(roles.includes('navRule("staff","inventory","Inventaris",75,"assigned_workplace_role")'))
  assert.ok(layout.includes('pathname.startsWith("/inventory")?"inventory"'))
  assert.ok(layout.includes('inventory:showInventory'))
})

test('inventory page scopes content per workplace and limits checklist to startup and closing', async () => {
  const page = await readFile(new URL('../app/(app)/inventory/page.tsx', import.meta.url), 'utf8')
  const documents = await readFile(new URL('../components/crew/event-documents-panel.tsx', import.meta.url), 'utf8')

  assert.ok(page.includes('workplaceId={workplace.id}'))
  assert.ok(page.includes('showTextEntry={isAdmin}'))
  assert.ok(page.includes("kinds={['opening','closing']}"))
  assert.ok(page.includes('canManage={isAdmin}'))
  assert.ok(page.includes('canClose={isAdmin||isResponsible}'))
  assert.ok(documents.includes("query=query.eq('workplace_id',workplaceId)"))
  assert.ok(documents.includes('createInventoryTextEntry'))
})

test('admin overview no longer exposes health or release shortcuts', async () => {
  const admin = await readFile(new URL('../app/(app)/admin/page.tsx', import.meta.url), 'utf8')
  assert.ok(!admin.includes('href="/admin/health"'))
  assert.ok(!admin.includes('href="/admin/release"'))
  assert.ok(admin.includes('href="/admin/time-records"'))
})
