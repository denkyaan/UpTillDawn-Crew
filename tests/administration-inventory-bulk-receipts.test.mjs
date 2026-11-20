import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {proposeExactInventoryReceipts} from '../lib/administration/inventory-receipt-matching.ts'

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const invoice={id:'doc1',event_id:'event1'}
const lines=[
 {id:'a',document_id:'doc1',description:'Merch T-shirt',quantity:12},
 {id:'b',document_id:'doc1',description:'Stage Light',quantity:3},
]
const items=[
 {id:'i1',event_id:'event1',name:' merch   t-shirt '},
 {id:'i2',event_id:'event1',name:'Stage Light'},
]

test('only unique same-event exact matches qualify for bulk receipt',()=>{
 assert.deepEqual(proposeExactInventoryReceipts(invoice,lines,items,[]),[
  {line:'a',item:'i1',quantity:12,description:'Merch T-shirt',itemName:' merch   t-shirt '},
  {line:'b',item:'i2',quantity:3,description:'Stage Light',itemName:'Stage Light'},
 ])
 assert.deepEqual(proposeExactInventoryReceipts(invoice,lines,[...items,{id:'i3',event_id:'event1',name:'STAGE LIGHT'}],[]),[
  {line:'a',item:'i1',quantity:12,description:'Merch T-shirt',itemName:' merch   t-shirt '},
 ])
 assert.deepEqual(proposeExactInventoryReceipts(invoice,lines,items.map(x=>({...x,event_id:'other'})),[]),[])
 assert.deepEqual(proposeExactInventoryReceipts({...invoice,event_id:null},lines,items,[]),[])
})

test('never propose already received, fractional, over-allocated or unrelated invoice lines',()=>{
 const modified=[...lines,
  {id:'c',document_id:'doc2',description:'Stage Light',quantity:2},
  {id:'d',document_id:'doc1',description:'Stage Light',quantity:0.5},
 ]
 const proposed=proposeExactInventoryReceipts(invoice,modified,items,[
  {line_id:'a',quantity:5},{line_id:'a',quantity:7},
  {line_id:'b',quantity:2},
 ])
 assert.deepEqual(proposed,[
  {line:'b',item:'i2',quantity:1,description:'Stage Light',itemName:'Stage Light'},
 ])
 assert.deepEqual(proposeExactInventoryReceipts(invoice,lines,items,[
  {line_id:'a',quantity:13},{line_id:'b',quantity:4},
 ]),[])
})

test('database API must be a single Admin-only atomic transaction with replay protection',()=>{
 const sql=read('supabase/migrations/20261109083000_inventory_invoice_bulk_receipts.sql')
 assert.match(sql,/create table if not exists upt_administration_private\.inventory_receipt_batches/)
 assert.match(sql,/primary key/)
 assert.match(sql,/auth\.uid\(\) is null/)
 assert.match(sql,/not public\.upt_is_admin\(\)/)
 assert.match(sql,/pg_advisory_xact_lock/)
 assert.match(sql,/v_prior\.payload_hash<>v_hash/)
 assert.match(sql,/jsonb_array_length\(p_rows\) not between 1 and 50/)
 assert.match(sql,/v_line=any\(v_seen\)/)
 assert.match(sql,/document_id=p_document/)
 assert.match(sql,/public\.upt_receive_invoice_inventory/)
 assert.match(sql,/v_inserted is distinct from true/)
 assert.match(sql,/revoke all on upt_administration_private\.inventory_receipt_batches/)
 assert.match(sql,/revoke all on function public\.upt_admin_receive_inventory_batch/)
 assert.match(sql,/grant execute on function public\.upt_admin_receive_inventory_batch/)
})

test('server action validates explicit approval, JSON, quantities and authorization',()=>{
 const action=read('lib/actions/admin-inventory-batch.ts')
 assert.match(action,/administrationAccess\(\)/)
 assert.match(action,/realIsAdmin/)
 assert.match(action,/isOwner/)
 assert.match(action,/form\.get\('confirm'\)==='yes'/)
 assert.match(action,/JSON\.parse\(raw\)/)
 assert.match(action,/Number\.isSafeInteger\(row\.quantity\)/)
 assert.match(action,/seen\.has\(row\.line\)/)
 assert.match(action,/upt_admin_receive_inventory_batch/)
 assert.match(action,/revalidatePath\(/)
})

test('UI keeps individual inventory receipts and localized review-before-post in four languages',()=>{
 const page=read('app/(app)/portals/administration/modules/[slug]/page.tsx')
 const server=read('components/administration/inventory-bulk-receipts.tsx')
 const form=read('components/administration/inventory-bulk-receipt-form.tsx')
 assert.match(page,/InventoryBulkReceipts/)
 assert.match(page,/InventoryReceipts/)
 assert.match(server,/proposeExactInventoryReceipts/)
 assert.match(server,/\.limit\(501\)/)
 assert.match(server,/\.limit\(1001\)/)
 assert.match(server,/proposals\.slice\(0,50\)/)
 assert.match(form,/useActionState/)
 assert.match(form,/type="checkbox" name="confirm" value="yes" required/)
 assert.match(form,/pending\?t\.loading:t\.submit/)
 for(const code of [server,form]){
  for(const locale of ['nl:','fr:','en:','de:'])
   assert.ok(code.includes(locale),locale)
 }
})
