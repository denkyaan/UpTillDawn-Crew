import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('admin inventory exposes permanent pre-event workplace catalog',async()=>{
  const page=await read('app/(app)/inventory/page.tsx')
  const component=await read('components/crew/workplace-catalog-inventory.tsx')
  const actions=await read('lib/actions/workplace-catalog.ts')
  assert.match(page,/from\('workplace_catalog'\)/)
  assert.match(page,/WorkplaceCatalogInventory/)
  assert.match(component,/Standaardwerkplekken & pre-event inventaris/)
  assert.match(actions,/upt_sync_workplace_catalog_to_event/)
})

test('new events inherit master workplaces and inventory',async()=>{
  const actions=await read('lib/actions/events.ts')
  assert.match(actions,/select\('id'\)\.single\(\)/)
  assert.match(actions,/upt_sync_workplace_catalog_to_event/)
  assert.match(actions,/revalidatePath\('\/inventory'\)/)
})

test('approvals and approved personnel are split into focused admin workflows',async()=>{
  const approvals=await read('app/(app)/personnel/page.tsx')
  const crew=await read('app/(app)/crew/page.tsx')
  const deleteButton=await read('components/admin/personnel-delete-button.tsx')
  const personnel=await read('lib/actions/personnel.ts')
  const auth=await read('lib/actions/auth.ts')
  assert.match(approvals,/Goedkeuringen/)
  assert.match(approvals,/filter\(person=>!person\.approved\)/)
  assert.match(approvals,/approvePersonnelAccount/)
  assert.doesNotMatch(approvals,/BLOKKEREN/)
  assert.match(crew,/filter\(person=>person\.approved\)/)
  assert.match(crew,/BLOKKEREN/)
  assert.match(crew,/DEBLOKKEREN/)
  assert.match(deleteButton,/DEFINITIEF VERWIJDEREN/)
  assert.match(personnel,/upt_admin_set_personnel_block/)
  assert.match(auth,/account_blocked/)
  assert.match(auth,/ACCOUNT GEBLOKKEERD/)
})

test('platform management degrades per module instead of blanking the page',async()=>{
  const page=await read('app/(app)/admin/platform/page.tsx')
  assert.match(page,/Platformbeheer/)
  assert.match(page,/loadProblems/)
  assert.match(page,/upt_admin_personnel_details_v2/)
  assert.doesNotMatch(page,/allResults\.some/)
  assert.match(page,/Begin hier/)
})

test('device locale prioritizes primary device language and runtime handles clock request counters',async()=>{
  const locale=await read('lib/locale-preferences.ts')
  const runtime=await read('lib/ui-translation-runtime.ts')
  assert.match(locale,/parseUiLocale\(navigator\.language\)/)
  assert.match(runtime,/inklokverzoek/)
  assert.match(runtime,/clock-in request/)
  assert.match(runtime,/Einstempel-Anfrage/)
})

test('database migration provides catalog, inventory RLS helper and personnel guards',async()=>{
  const migration=await read('supabase/migrations/20260928084057_pre_event_inventory_personnel_platform_fixes.sql')
  const guard=await read('supabase/migrations/20260928084916_personnel_delete_block_guard.sql')
  assert.match(migration,/grant execute on function upt_private\.inventory_can_view\(uuid,uuid\) to authenticated/)
  assert.match(migration,/create table if not exists public\.workplace_catalog/)
  assert.match(migration,/upt_admin_set_personnel_block/)
  assert.match(guard,/Deblokkeer dit account eerst/)
  assert.match(guard,/delete from auth\.users/)
})
