import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  canIssueInventory,
  inventoryAccountedQuantity,
  inventoryAvailability,
  inventoryCountsAreValid,
} from '../lib/inventory.ts'

test('inventory accounting keeps all stock states balanced', () => {
  const item={
    id:'i1',
    name:'Radio',
    totalQuantity:10,
    availableQuantity:4,
    issuedQuantity:3,
    damagedQuantity:2,
    missingQuantity:1,
  }
  assert.equal(inventoryAccountedQuantity(item),10)
  assert.equal(inventoryCountsAreValid(item),true)
  assert.equal(canIssueInventory(item,4),true)
  assert.equal(canIssueInventory(item,5),false)
  assert.equal(inventoryAvailability(item),'available')
  assert.equal(inventoryAvailability({...item,availableQuantity:2}),'low')
  assert.equal(inventoryAvailability({...item,availableQuantity:0}),'empty')
})

test('inventory schema uses explicit stock buckets RLS and RPC-only mutations', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927110758_inventory_workplace_logistics.sql',import.meta.url),'utf8')
  for(const table of ['inventory_items','inventory_issues','inventory_movements']){
    assert.match(source,new RegExp('alter table public\\.'+table+' enable row level security'))
    assert.match(source,new RegExp('revoke all on table public\\.'+table+' from anon'))
    assert.match(source,new RegExp('revoke insert,update,delete on table public\\.'+table+' from authenticated'))
  }
  assert.match(source,/total_quantity = available_quantity \+ issued_quantity \+ damaged_quantity \+ missing_quantity/)
  assert.match(source,/upt_private\.inventory_can_manage/)
  assert.match(source,/upt_private\.inventory_can_view/)
  assert.match(source,/public\.upt_feature_allowed\('inventory'/)
})

test('inventory issuance is workplace scoped concurrent-safe and audited', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927110758_inventory_workplace_logistics.sql',import.meta.url),'utf8')
  assert.match(source,/select \* into v_item[\s\S]*?for update/)
  assert.match(source,/v_item\.available_quantity<p_quantity/)
  assert.match(source,/s\.workplace_id=v_item\.workplace_id/)
  assert.match(source,/s\.status<>'cancelled'/)
  assert.match(source,/s\.response_status<>'declined'/)
  assert.match(source,/inventory\.issued/)
  assert.match(source,/Materiaal toegewezen/)
})

test('staff inventory settlement is approval based and cannot mutate stock directly', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927111330_inventory_settlement_approval.sql',import.meta.url),'utf8')
  assert.match(source,/create table if not exists public\.inventory_settlement_requests/)
  assert.match(source,/upt_request_inventory_settlement/)
  assert.match(source,/upt_current_work_context\(\)/)
  assert.match(source,/Je kunt alleen je eigen materiaal melden/)
  assert.match(source,/Alleen admin of de verantwoordelijke kan voorraad definitief verwerken/)
  assert.match(source,/upt_private\.apply_inventory_settlement/)
  assert.match(source,/upt_decide_inventory_settlement/)
  assert.match(source,/inventory\.settlement\.requested/)
  assert.match(source,/inventory\.settlement\.'\|\|p_decision/)
})

test('inventory settlement lock order prevents manager approval deadlocks', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927111747_inventory_settlement_lock_order.sql',import.meta.url),'utf8')
  const requestLock=source.indexOf("from public.inventory_settlement_requests")
  const apply=source.indexOf("apply_inventory_settlement")
  assert.ok(requestLock>=0)
  assert.ok(apply>requestLock)
  assert.match(source,/status='pending'[\s\S]*?for update/)
  assert.match(source,/Materiaalmelding vervangen/)
})

test('inventory FK indexes cover workplace references', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927111630_inventory_concurrency_and_indexes.sql',import.meta.url),'utf8')
  assert.match(source,/inventory_issues_workplace_fk_idx/)
  assert.match(source,/inventory_movements_workplace_fk_idx/)
  assert.match(source,/inventory_settlement_requests_workplace_fk_idx/)
})

test('handover captures and exposes inventory state at ready time', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927110758_inventory_workplace_logistics.sql',import.meta.url),'utf8')
  const page=await readFile(new URL('../app/(app)/operations/page.tsx',import.meta.url),'utf8')
  const panel=await readFile(new URL('../components/responsible/shift-handover-panel.tsx',import.meta.url),'utf8')
  assert.match(source,/add column if not exists inventory_snapshot jsonb/)
  assert.match(source,/capture_handover_inventory_snapshot/)
  for(const key of ['issued_quantity','damaged_quantity','missing_quantity','low_stock_count'])assert.ok(source.includes("'"+key+"'"),key)
  assert.match(source,/upt_shift_handover_inventory_snapshots/)
  assert.match(page,/upt_shift_handover_inventory_snapshots/)
  assert.match(panel,/Materiaalstatus bij klaarzetten/)
  assert.match(panel,/ACTUEEL MATERIAAL BEKIJKEN/)
})

test('inventory is integrated as a workplace-scoped navigation feature while retaining material workflows', async () => {
  const [tasks,workplaces,panel,roles,nav,inventoryPage]=await Promise.all([
    readFile(new URL('../app/(app)/tasks/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../app/(app)/workplaces/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../components/crew/inventory-panel.tsx',import.meta.url),'utf8'),
    readFile(new URL('../lib/role-ui.ts',import.meta.url),'utf8'),
    readFile(new URL('../components/layout/navigation-items.ts',import.meta.url),'utf8'),
    readFile(new URL('../app/(app)/inventory/page.tsx',import.meta.url),'utf8'),
  ])
  assert.match(tasks,/!manager&&<InventoryPanel/)
  assert.match(workplaces,/\(isAdmin\|\|isResponsible\)&&<InventoryPanel/)
  for(const label of ['Materiaalbeheer','Mijn materiaal','RETOUR MELDEN','BEVESTIGEN','AFWIJZEN','TERUGGEVONDEN'])assert.ok(panel.includes(label),label)
  assert.match(roles,/navRule\("admin","inventory","Inventaris"/)
  assert.match(roles,/navRule\("responsible_lead","inventory","Inventaris"/)
  assert.match(roles,/navRule\("staff","inventory","Inventaris"/)
  assert.match(nav,/key:"inventory"/)
  assert.match(nav,/href:"\/inventory"/)
  assert.match(inventoryPage,/workplaceId=\{workplace\.id\}/)
})

test('inventory actions expose manager and staff approval workflows', async () => {
  const source=await readFile(new URL('../lib/actions/uptilldawn.ts',import.meta.url),'utf8')
  for(const action of [
    'createInventoryItem',
    'restockInventoryItem',
    'issueInventoryItem',
    'settleInventoryIssue',
    'requestInventorySettlement',
    'cancelInventorySettlement',
    'decideInventorySettlement',
    'restoreInventoryQuantity',
  ])assert.ok(source.includes('function '+action),action)
  assert.match(source,/upt_request_inventory_settlement/)
  assert.match(source,/upt_decide_inventory_settlement/)
})

test('inventory RLS helpers are executable only where policy evaluation needs them', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927111930_inventory_rls_helper_permissions.sql',import.meta.url),'utf8')
  assert.match(source,/grant execute on function upt_private\.inventory_can_view\(uuid,uuid\) to authenticated/)
  assert.match(source,/grant execute on function upt_private\.inventory_can_manage\(uuid,uuid\) to authenticated/)
  assert.match(source,/revoke all on function upt_private\.apply_inventory_settlement/)
})
