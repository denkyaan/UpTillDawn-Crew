// Dedicated disposable loopback Supabase only. Real signed clients, actual native
// handlers and persisted-state assertions. No external provider or real account.
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {encode} from '../../lib/migration/wire.ts'
import {nativeAdminActionResponse} from '../src/api/native-admin-actions.ts'
import {nativeInventoryActionResponse} from '../src/api/native-inventory-checklist-actions.ts'
import {nativeCatalogActionResponse} from '../src/api/native-catalog-event-actions.ts'
import {megaCrewEventResponse} from '../src/api/native-mega-crew-event-actions.ts'
import {megaOperationsResponse} from '../src/api/native-mega-operations-actions.ts'
import {nativeRosterActionResponse as roster} from '../src/api/native-roster-handover-actions.ts'
import {nativeWaveThreeActionResponse as shiftAction} from '../src/api/native-event-shift-actions.ts'
import {nativeWaveTwoActionResponse as memberAction} from '../src/api/native-platform-actions.ts'
import {megaPeopleResponse as peopleAction} from '../src/api/native-mega-people-actions.ts'
import {finalCrewActionResponse as crewAction} from '../src/api/native-final-crew-actions.ts'
import {finalFinanceResponse as financeAction} from '../src/api/native-final-finance-actions.ts'
import {nativeWaveNineResponse as safeAction} from '../src/api/native-wave-nine-safe-actions.ts'
import {megaMakerResponse,godLogoutId} from '../src/api/native-mega-maker-actions.ts'
const target='http://127.0.0.1:54321'
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||''
const password=process.env.BOT_TEST_PASSWORD||''
if(process.env.BOT_SUPABASE_URL!==target||process.env.NEXT_PUBLIC_SUPABASE_URL!==target||
 process.env.BOT_DB_URL!=='postgresql://postgres:postgres@127.0.0.1:54322/postgres'||
 !key||key===process.env.BOT_SERVICE_ROLE_KEY||password.length<24)throw Error('DISPOSABLE_LOOPBACK_REQUIRED')
const originalFetch=globalThis.fetch
let lastLocalDbFailure=null
const localFetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input))
 if(url.origin!==target)throw Error('NONLOCAL_NETWORK_BLOCKED')
 const response=await originalFetch(input,{...init,redirect:'error'})
 // Disposable synthetic database: only bounded error code and message.
 // Never serialize headers, auth responses, SQL details or raw bodies.
 if(!response.ok&&url.pathname.startsWith('/rest/v1/')){
  try{
   const data=await response.clone().json()
   const code=String(data.code||'DB').replace(/[^A-Za-z0-9_]/g,'').slice(0,16)
   const message=String(data.message||'').replaceAll(password,'[redacted]').replaceAll(key,'[redacted]').replace(/[\r\n]/g,' ').slice(0,160)
   lastLocalDbFailure={code,message}
  }catch{}
 }
 return response
}
globalThis.fetch=localFetch
const event='00000000-0000-4000-8000-00000000e2e1'
const workplace='00000000-0000-4000-8000-00000000e2e2'
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
const prefix='PHASE23-'+sha.slice(0,12)
const actors=[],operations=[],domains=[],failures=[]
let failed=null
const crew=name=>'lib/actions/uptilldawn.ts#'+name
const guest=name=>'lib/actions/guestlist.ts#'+name
const sales=name=>'lib/actions/sales.ts#'+name
const platform=name=>'lib/actions/platform.ts#'+name
async function actor(name,owner,admin){
 const db=createClient(target,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:localFetch}})
 const email=name+'@bots.uptilldawn.test'
 const {data,error}=await db.auth.signInWithPassword({email,password})
 assert.ifError(error);assert.equal(data.user?.email,email)
 const id=data.user.id
 actors.push(db)
 const {data:own,error:oe}=await db.rpc('upt_current_is_owner')
 assert.ifError(oe);assert.equal(own,owner)
 if(!owner){
  const {data:a,error:ae}=await db.rpc('upt_is_admin',{uid:id})
  assert.ifError(ae);assert.equal(a,admin)
 }
 return {db,id}
}
async function read(q,label){
 const {data,error}=await q
 if(error)throw Error(label+'_'+(error.code||'DB')+(lastLocalDbFailure?': '+lastLocalDbFailure.message:''))
 return data
}
async function one(q,label){
 const data=await read(q,label)
 assert.ok(Array.isArray(data)&&data.length===1,label+'_ONE')
 return data[0]
}
function req(id,fields,options={}){
 const fd=new FormData()
 for(const [k,v] of Object.entries(fields))for(const item of Array.isArray(v)?v:[v])fd.append(k,String(item))
 const body=new FormData();body.set('_id',id)
 body.set('_args',JSON.stringify(encode(options.noForm?[]:options.state?[{error:null},fd]:[fd],body)))
 return new Request('http://127.0.0.1:5174/api/migration/actions',{method:'POST',headers:{Origin:'http://127.0.0.1:5174','Sec-Fetch-Site':'same-origin','X-UpTillDawn-Action-Hint':id,...(options.cookie?{Cookie:options.cookie}:{})},body})
}
async function invoke(handler,identity,id,fields={},options={}){
 lastLocalDbFailure=null
 const res=await handler(req(id,fields,options),identity.db,id)
 if(res.status!==(options.status||200))throw Error(id+'_HTTP_'+res.status+(lastLocalDbFailure?' '+lastLocalDbFailure.code+': '+lastLocalDbFailure.message:''))
 const data=await res.json()
 if(options.status===422)assert.equal(data.code,'action_failed',id)
 return {data,cookies:res.headers.getSetCookie()}
}
async function verified(id,fn){
 lastLocalDbFailure=null
 try{
  await fn()
  operations.push({id,outcome:'positive',persistenceVerified:true})
  console.log('PASS native local '+id)
 }catch(error){
  const reason=safeFailure(error)
  operations.push({id,outcome:'failure',persistenceVerified:false,reason})
  console.error('FAIL native action '+id+': '+reason)
  throw error // only the dependent lifecycle stops; other domains continue
 }
}
function safeFailure(error){
 return (error instanceof Error?error.message.split('\n')[0]:'LOCAL_NATIVE_FAILED').replaceAll(password,'[redacted]').replaceAll(key,'[redacted]').slice(0,160)
}
async function domain(name,fn){
 try{
  await fn()
  domains.push({name,outcome:'success'})
 }catch(error){
  const reason=safeFailure(error)
  domains.push({name,outcome:'failure'})
  failures.push({domain:name,reason})
  console.error('FAIL native local '+name+': '+reason)
 }
}
async function denied(handler,identity,id,fields){
 await invoke(handler,identity,id,fields,{status:422})
 operations.push({id,outcome:'denied'})
}
try{
 const head=await actor('bot-01-admin-nl',false,true)
 const staff=await actor('bot-03-staff-en',false,false)
 const maker=await actor('bot-16-maker',true,false)
 const unrelated=await actor('bot-08-staff-de',false,false)
 const office=await actor('bot-04-staff-de',false,false)
 const promoter=await actor('bot-05-staff-nl',false,false)
 const alternate=await actor('bot-09-staff-nl',false,false)
 const a=head.db
 const owned=await one(a.from('events').select('id,created_by,status,start_at,end_at').eq('id',event),'LOCAL_EVENT')
 assert.equal(owned.created_by,head.id);assert.equal(owned.status,'scheduled')
 assert.equal((await one(a.from('workplaces').select('event_id').eq('id',workplace),'LOCAL_WORKPLACE')).event_id,event)
 await domain('guestlist',async()=>{
 const guestFields={event_id:event,name:prefix+' Artist',entry_type:'artist',spots:'2'}
 await denied(nativeAdminActionResponse,staff,guest('addGuestlistEntry'),guestFields)
 assert.equal((await read(a.from('event_guestlist_entries').select('id').eq('event_id',event).eq('name',guestFields.name),'GUEST_DENIAL')).length,0)
 let entry
 await verified(guest('addGuestlistEntry'),async()=>{
  await invoke(nativeAdminActionResponse,head,guest('addGuestlistEntry'),guestFields)
  entry=await one(a.from('event_guestlist_entries').select('id,spots_total,entry_type,is_active').eq('event_id',event).eq('name',guestFields.name),'GUEST_ADD')
  assert.equal(entry.spots_total,2);assert.equal(entry.entry_type,'artist');assert.equal(entry.is_active,true)
 })
 await verified(guest('updateGuestlistEntry'),async()=>{
  await invoke(nativeAdminActionResponse,head,guest('updateGuestlistEntry'),{...guestFields,entry_id:entry.id,name:prefix+' Artist edited',spots:'3'})
  const row=await one(a.from('event_guestlist_entries').select('name,spots_total').eq('id',entry.id),'GUEST_EDIT')
  assert.equal(row.name,prefix+' Artist edited');assert.equal(row.spots_total,3)
 })
 await verified(guest('setBackstageWorkplace'),async()=>{
  await invoke(nativeAdminActionResponse,head,guest('setBackstageWorkplace'),{event_id:event,workplace_id:workplace})
  assert.equal((await one(a.from('event_guestlist_settings').select('backstage_workplace_id').eq('event_id',event),'BACKSTAGE')).backstage_workplace_id,workplace)
 })
 await verified(guest('setArtistHospitality'),async()=>{
  await invoke(nativeAdminActionResponse,head,guest('setArtistHospitality'),{entry_id:entry.id,drinks:'Water',hospitality_notes:prefix})
  const row=await one(a.from('artist_backstage_checklists').select('drinks,hospitality_notes').eq('guestlist_entry_id',entry.id),'HOSPITALITY')
  assert.equal(row.drinks,'Water');assert.equal(row.hospitality_notes,prefix)
 })
 await verified(guest('removeGuestlistEntry'),async()=>{
  await invoke(nativeAdminActionResponse,head,guest('removeGuestlistEntry'),{entry_id:entry.id})
  // The installed guestlist SELECT policy deliberately hides inactive rows.
  // Prove both the signed user's view and the exact persisted soft-delete,
  // without changing RLS or using a privileged client to execute the action.
  assert.equal((await read(a.from('event_guestlist_entries').select('id').eq('id',entry.id),'GUEST_REMOVE_VISIBILITY')).length,0)
  assert.match(entry.id,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  assert.match(event,/^[0-9a-f-]{36}$/i)
  const stored=execFileSync('psql',[process.env.BOT_DB_URL,'-X','-v','ON_ERROR_STOP=1','-At','-c',
   "SELECT is_active FROM public.event_guestlist_entries WHERE id='"+entry.id+"'::uuid AND event_id='"+event+"'::uuid"],
   {encoding:'utf8',timeout:10000}).trim()
  assert.equal(stored,'f','GUEST_REMOVE_PERSISTED')
  await denied(nativeAdminActionResponse,head,guest('removeGuestlistEntry'),{entry_id:entry.id})
 })
 })
 await domain('inventory',async()=>{
 const inventoryFields={workplace_id:workplace,name:prefix+' Radio',category:'QA',quantity:'3',item_kind:'asset'}
 let item
 await verified(crew('createInventoryItem'),async()=>{
  await invoke(nativeInventoryActionResponse,head,crew('createInventoryItem'),inventoryFields)
  item=await one(a.from('inventory_items').select('id,event_id,total_quantity,available_quantity').eq('workplace_id',workplace).eq('name',inventoryFields.name),'INVENTORY_CREATE')
  assert.equal(item.event_id,event);assert.equal(item.total_quantity,3);assert.equal(item.available_quantity,3)
 })
 await verified(crew('updateInventoryAssetDetails'),async()=>{
  await invoke(nativeInventoryActionResponse,head,crew('updateInventoryAssetDetails'),{item_id:item.id,item_kind:'asset',asset_code:prefix,barcode:prefix+'-bar',serial_number:'QA-1'})
  const row=await one(a.from('inventory_items').select('asset_code,barcode,serial_number').eq('id',item.id),'INVENTORY_DETAILS')
  assert.equal(row.asset_code,prefix);assert.equal(row.barcode,prefix+'-bar');assert.equal(row.serial_number,'QA-1')
 })
 await verified(crew('restockInventoryItem'),async()=>{
  await invoke(nativeInventoryActionResponse,head,crew('restockInventoryItem'),{item_id:item.id,quantity:'2',notes:prefix})
  const row=await one(a.from('inventory_items').select('total_quantity,available_quantity').eq('id',item.id),'INVENTORY_RESTOCK')
  assert.equal(row.total_quantity,5);assert.equal(row.available_quantity,5)
 })
 // Actual signed inventory and sales lifecycles on the disposable fixture.
 await denied(nativeInventoryActionResponse,staff,crew('restockInventoryItem'),{item_id:item.id,quantity:'1'})
 assert.equal((await one(a.from('inventory_items').select('total_quantity').eq('id',item.id),'RESTOCK_DENIAL')).total_quantity,5)
 let issue
 await verified(crew('issueInventoryItem'),async()=>{
  await invoke(nativeInventoryActionResponse,head,crew('issueInventoryItem'),{item_id:item.id,user_id:staff.id,quantity:'2',notes:prefix})
  issue=await one(a.from('inventory_issues').select('id,quantity,outstanding_quantity').eq('item_id',item.id).eq('user_id',staff.id),'ISSUE')
  assert.equal(issue.quantity,2);assert.equal(issue.outstanding_quantity,2)
  // The Head's read access must match the actual original Inventory UI,
  // and a different employee must not gain access to the issued asset.
  const movement=await one(a.from('inventory_movements').select('quantity,target_user_id').eq('issue_id',issue.id).eq('movement_type','issued'),'ISSUE_MOVEMENT')
  assert.equal(movement.quantity,2);assert.equal(movement.target_user_id,staff.id)
  assert.equal((await read(unrelated.db.from('inventory_issues').select('id').eq('id',issue.id),'FOREIGN_ISSUE_DENIAL')).length,0)
  assert.equal((await read(unrelated.db.from('inventory_movements').select('id').eq('issue_id',issue.id),'FOREIGN_MOVEMENT_DENIAL')).length,0)
  const row=await one(a.from('inventory_items').select('available_quantity,issued_quantity').eq('id',item.id),'ISSUE_STOCK')
  assert.equal(row.available_quantity,3);assert.equal(row.issued_quantity,2)
 })
 await verified(crew('settleInventoryIssue'),async()=>{
  await invoke(nativeInventoryActionResponse,head,crew('settleInventoryIssue'),{issue_id:issue.id,condition:'returned',quantity:'2'})
  const row=await one(a.from('inventory_issues').select('outstanding_quantity,closed_at').eq('id',issue.id),'ISSUE_RETURN')
  assert.equal(row.outstanding_quantity,0);assert.ok(row.closed_at)
  const stock=await one(a.from('inventory_items').select('available_quantity,issued_quantity').eq('id',item.id),'RETURN_STOCK')
  assert.equal(stock.available_quantity,5);assert.equal(stock.issued_quantity,0)
 })
 await verified(platform('updateAssetMetadata'),async()=>{
  const originalPurchase='2026-01-01',originalMaintenance='2026-02-01T12:00:00Z'
  await read(a.rpc('upt_update_inventory_asset_metadata',{p_item:item.id,p_asset_code:prefix,p_barcode:prefix+'-bar',p_serial_number:'QA-1',p_purchase_date:originalPurchase,p_last_maintenance_at:originalMaintenance}),'ASSET_HIDDEN_FIXTURE')
  const fields={item_id:item.id,asset_code:prefix,barcode:prefix+'-bar',serial_number:'QA-1',location_label:'QA shelf',reorder_threshold:'2',unit_cost:'12.50',asset_notes:prefix}
  await denied(megaOperationsResponse,staff,platform('updateAssetMetadata'),fields)
  const deniedDirect=await staff.db.rpc('upt_update_inventory_asset_form',{p_item:item.id,p_asset_code:'denied'})
  assert.equal(deniedDirect.error?.code,'42501','ASSET_RPC_STAFF_DENIED')
  await invoke(megaOperationsResponse,head,platform('updateAssetMetadata'),fields)
  const row=await one(a.from('inventory_items').select('location_label,reorder_threshold,unit_cost_cents,asset_notes,purchase_date,last_maintenance_at,asset_code').eq('id',item.id),'ASSET_METADATA')
  assert.equal(row.location_label,'QA shelf');assert.equal(row.reorder_threshold,2);assert.equal(row.unit_cost_cents,1250);assert.equal(row.asset_notes,prefix)
  assert.equal(row.asset_code,prefix);assert.equal(row.purchase_date,originalPurchase);assert.equal(Date.parse(row.last_maintenance_at),Date.parse(originalMaintenance))

 })
 })
 await domain('sales',async()=>{
 await verified(sales('configureSaleItem'),async()=>{
  const name=prefix+' Merch'
  await invoke(nativeInventoryActionResponse,head,crew('createInventoryItem'),{workplace_id:workplace,name,quantity:'8',item_kind:'consumable'})
  const saleItem=await one(a.from('inventory_items').select('id').eq('workplace_id',workplace).eq('name',name),'MERCH_ITEM')
  const fields={item_id:saleItem.id,enabled:'on',sale_category:'merch',price:'12.50'}
  await denied(nativeAdminActionResponse,staff,sales('configureSaleItem'),fields)
  assert.equal((await one(a.from('inventory_items').select('sale_enabled').eq('id',saleItem.id),'MERCH_DENIAL')).sale_enabled,false)
  await invoke(nativeAdminActionResponse,head,sales('configureSaleItem'),fields)
  const row=await one(a.from('inventory_items').select('sale_enabled,sale_category,sale_price_cents').eq('id',saleItem.id),'SALE_CONFIG')
  assert.equal(row.sale_enabled,true);assert.equal(row.sale_category,'merch');assert.equal(row.sale_price_cents,1250)
 })
 await verified(sales('setOpeningCash'),async()=>{
  await invoke(nativeAdminActionResponse,head,sales('setOpeningCash'),{event_id:event,workplace_id:workplace,opening_cash:'25.00'})
  const row=await one(a.from('sales_registers').select('opening_cash_cents,opened_by').eq('event_id',event).eq('workplace_id',workplace),'REGISTER')
  assert.equal(row.opening_cash_cents,2500);assert.equal(row.opened_by,head.id)
 })
 })
 await domain('qr-resource',async()=>{
 const item=await one(a.from('inventory_items').select('id').eq('id','00000000-0000-4000-8000-00000000e2e8'),'QR_SEEDED_ITEM')
 await verified(platform('createQrResource'),async()=>{
  await invoke(megaOperationsResponse,head,platform('createQrResource'),{event_id:event,workplace_id:workplace,resource_type:'inventory',resource_id:item.id,title:prefix+' QR',route:'/inventory'})
  const row=await one(a.from('qr_resources').select('resource_id,route,active,created_by').eq('event_id',event).eq('title',prefix+' QR'),'QR')
  assert.equal(row.resource_id,item.id);assert.equal(row.route,'/inventory');assert.equal(row.active,true);assert.equal(row.created_by,head.id)
 })
 })
 await domain('checklist',async()=>{
 let checklist,checkItem
 await verified(crew('createOperationalChecklist'),async()=>{
  await invoke(nativeCatalogActionResponse,head,crew('createOperationalChecklist'),{workplace_id:workplace,kind:'custom',title:prefix+' Checklist'})
  checklist=await one(a.from('operational_checklists').select('id,event_id,status').eq('workplace_id',workplace).eq('title',prefix+' Checklist'),'CHECKLIST_CREATE')
  assert.equal(checklist.event_id,event);assert.equal(checklist.status,'open')
 })
 await verified(crew('addOperationalChecklistItem'),async()=>{
  await invoke(nativeInventoryActionResponse,head,crew('addOperationalChecklistItem'),{checklist_id:checklist.id,label:prefix+' Item',required:'on'})
  checkItem=await one(a.from('checklist_items').select('id,required,completed_at').eq('checklist_id',checklist.id).eq('label',prefix+' Item'),'CHECKLIST_ITEM')
  assert.equal(checkItem.required,true);assert.equal(checkItem.completed_at,null)
 })
 await denied(nativeInventoryActionResponse,head,crew('closeOperationalChecklist'),{checklist_id:checklist.id})
 assert.equal((await one(a.from('operational_checklists').select('status').eq('id',checklist.id),'CHECKLIST_DENIED')).status,'open')
 await verified(crew('completeOperationalChecklistItem'),async()=>{
  await invoke(safeAction,head,crew('completeOperationalChecklistItem'),{item_id:checkItem.id})
  const row=await one(a.from('checklist_items').select('completed_at').eq('id',checkItem.id),'CHECKLIST_COMPLETE')
  assert.ok(row.completed_at)
 })
 await verified(crew('closeOperationalChecklist'),async()=>{
  await invoke(nativeInventoryActionResponse,head,crew('closeOperationalChecklist'),{checklist_id:checklist.id})
  const row=await one(a.from('operational_checklists').select('status,completed_at').eq('id',checklist.id),'CHECKLIST_CLOSE')
  assert.equal(row.status,'completed');assert.ok(row.completed_at)
 })
 await verified(crew('reopenOperationalChecklist'),async()=>{
  await invoke(nativeInventoryActionResponse,head,crew('reopenOperationalChecklist'),{checklist_id:checklist.id})
  const row=await one(a.from('operational_checklists').select('status,completed_at').eq('id',checklist.id),'CHECKLIST_REOPEN')
  assert.equal(row.status,'open');assert.equal(row.completed_at,null)
 })
 await verified(crew('reopenOperationalChecklistItem'),async()=>{
  await invoke(megaOperationsResponse,head,crew('reopenOperationalChecklistItem'),{item_id:checkItem.id})
  assert.equal((await one(a.from('checklist_items').select('completed_at').eq('id',checkItem.id),'CHECK_ITEM_REOPEN')).completed_at,null)
 })
 await verified(crew('removeOperationalChecklistItem'),async()=>{
  await invoke(megaOperationsResponse,head,crew('removeOperationalChecklistItem'),{item_id:checkItem.id})
  assert.equal((await read(a.from('checklist_items').select('id').eq('id',checkItem.id),'CHECK_ITEM_REMOVE')).length,0)
 })
 })
 await domain('events',async()=>{
 await verified(crew('updateEvent'),async()=>{
  await invoke(megaOperationsResponse,head,crew('updateEvent'),{event_id:event,name:prefix+' Event',start_at:owned.start_at,end_at:owned.end_at,registration_deadline:owned.start_at,radius:'150'})
  const row=await one(a.from('events').select('name,checkin_radius_m').eq('id',event),'EVENT_EDIT')
  assert.equal(row.name,prefix+' Event');assert.equal(row.checkin_radius_m,150)
 })
 const start=new Date(Date.now()+5*86400000).toISOString(),end=new Date(Date.parse(start)+3600000).toISOString()
 for(const id of ['lib/actions/events.ts#createEvent',crew('createEvent')]){
  await verified(id,async()=>{
   const name=prefix+' '+id.split('/').at(-1)
   await invoke(megaCrewEventResponse,head,id,{name,start_at:start,end_at:end,radius:'100'})
   const row=await one(a.from('events').select('created_by,start_at,end_at').eq('name',name),'EVENT_CREATE')
   assert.equal(row.created_by,head.id);assert.equal(Date.parse(row.start_at),Date.parse(start));assert.equal(Date.parse(row.end_at),Date.parse(end))
  })
 }
 })
 await domain('pay-rate',async()=>{
 await verified(platform('savePayRate'),async()=>{
  await invoke(megaOperationsResponse,head,platform('savePayRate'),{user_id:staff.id,hourly_rate:'23.50',effective_from:new Date(Date.now()+86400000).toISOString().slice(0,10),notes:prefix})
  const row=await one(a.from('staff_pay_rates').select('hourly_rate_cents,created_by').eq('user_id',staff.id).eq('notes',prefix),'PAY_RATE')
  assert.equal(row.hourly_rate_cents,2350);assert.equal(row.created_by,head.id)
 })
 })
 await domain('knowledge',async()=>{
 await verified(platform('createKnowledgeArticle'),async()=>{
  await invoke(megaOperationsResponse,head,platform('createKnowledgeArticle'),{event_id:event,workplace_id:workplace,title:prefix+' Knowledge',body:'QA fixture'})
  const row=await one(a.from('knowledge_articles').select('body,created_by').eq('event_id',event).eq('title',prefix+' Knowledge'),'KNOWLEDGE')
  assert.equal(row.body,'QA fixture');assert.equal(row.created_by,head.id)
 })
 })
 const finance=name=>'app/(app)/portals/administration/finance/page.tsx#'+name
 const people=(file,name)=>'lib/actions/'+file+'.ts#'+name
 const promotion=name=>people('promotion-tasks',name)
 const find=async(table,id,columns)=>one(a.from(table).select(columns).eq('id',id),table)
 const ownProfile=async identity=>{
  const rows=await read(identity.db.rpc('upt_current_profile'),'SELF_PROFILE')
  assert.equal(rows?.length,1)
  assert.equal(rows[0].id,identity.id)
  return rows[0]
 }
 const sqlLocal=statement=>execFileSync('psql',[process.env.BOT_DB_URL,'-X','-v','ON_ERROR_STOP=1','-At','-c',statement],{encoding:'utf8',timeout:10000}).trim()
 const saved=async(name,identity,fields)=>{
  const r=await invoke(financeAction,identity,finance(name),fields)
  assert.equal(r.data.redirect,'/portals/administration/finance',name+'_SAVED')
 }
 const avail={event_id:event,response:'can',setup_available:'yes',breakdown_available:'no'}
 await domain('availability-membership',async()=>{
  await verified(crew('setEventAvailability'),async()=>{
   await invoke(roster,unrelated,crew('setEventAvailability'),avail)
   const r=await one(unrelated.db.from('event_availability').select('response,setup_available,breakdown_available').eq('event_id',event).eq('user_id',unrelated.id),'AVAILABILITY')
   assert.equal(r.response,'can');assert.equal(r.setup_available,true);assert.equal(r.breakdown_available,false)
  })
  await verified(crew('addEventMember'),async()=>{
   await invoke(megaCrewEventResponse,head,crew('addEventMember'),{event_id:event,user_id:unrelated.id})
   assert.equal((await one(a.from('event_members').select('event_role').eq('event_id',event).eq('user_id',unrelated.id),'MEMBER')).event_role,'employee')
  })
  await verified(crew('addAvailableEventMembers'),async()=>{
   await read(alternate.db.rpc('upt_set_event_availability_with_reason',{p_event:event,p_response:'can',p_setup:false,p_breakdown:false}),'BULK_AVAILABLE')
   await invoke(megaCrewEventResponse,head,crew('addAvailableEventMembers'),{event_id:event,user_id:[alternate.id,unrelated.id]})
   assert.equal((await read(a.from('event_members').select('user_id').eq('event_id',event).in('user_id',[alternate.id,unrelated.id]),'BULK_MEMBERS')).length,2)
  })
 })
 await domain('roster',async()=>{
  // Independently exercise roster on its own newly-created event instead
  // of bypassing a preceding failed membership lifecycle / FIFO queue.
  const rosterStart=new Date(Date.now()+7*86400000).toISOString(),rosterEnd=new Date(Date.parse(rosterStart)+8*3600000).toISOString()
  const rosterName=prefix+' Roster fixture'
  await invoke(megaCrewEventResponse,head,crew('createEvent'),{name:rosterName,start_at:rosterStart,end_at:rosterEnd,radius:'100'})
  const rosterEvent=await one(a.from('events').select('id').eq('name',rosterName),'ROSTER_EVENT')
  const rosterPost=prefix+' Roster post'
  await invoke(megaCrewEventResponse,head,crew('addWorkplace'),{event_id:rosterEvent.id,name:rosterPost,default_shift_start:rosterStart,default_shift_end:rosterEnd})
  const post=await one(a.from('workplaces').select('id').eq('event_id',rosterEvent.id).eq('name',rosterPost),'ROSTER_POST')
  await read(alternate.db.rpc('upt_set_event_availability_with_reason',{p_event:rosterEvent.id,p_response:'can',p_setup:false,p_breakdown:false}),'ROSTER_AVAILABLE')
  await read(a.from('event_members').insert({event_id:rosterEvent.id,user_id:alternate.id,event_role:'employee'}),'ROSTER_MEMBER')
  let shift
  const fields={workplace_id:post.id,user_id:alternate.id,role_name:prefix+' Roster',start:rosterStart,end:rosterEnd}
  await verified(crew('createShift'),async()=>{
   await denied(roster,staff,crew('createShift'),fields)
   await invoke(roster,head,crew('createShift'),fields)
   shift=await one(a.from('shifts').select('id,scheduled_start,scheduled_end').eq('event_id',rosterEvent.id).eq('user_id',alternate.id).eq('role_name',fields.role_name),'SHIFT_CREATE')
   assert.equal(Date.parse(shift.scheduled_start),Date.parse(fields.start));assert.equal(Date.parse(shift.scheduled_end),Date.parse(fields.end))
  })
  await verified(crew('updateShift'),async()=>{
   const end=new Date(Date.parse(fields.end)-3600000).toISOString()
   await invoke(roster,head,crew('updateShift'),{shift_id:shift.id,role_name:prefix+' Changed',start:fields.start,end})
   const r=await find('shifts',shift.id,'role_name,scheduled_end')
   assert.equal(r.role_name,prefix+' Changed');assert.equal(Date.parse(r.scheduled_end),Date.parse(end))
  })
  await verified(crew('confirmShift'),async()=>{
   await denied(shiftAction,staff,crew('confirmShift'),{shift_id:shift.id})
   await invoke(shiftAction,alternate,crew('confirmShift'),{shift_id:shift.id})
   const r=await find('shifts',shift.id,'confirmed_at,response_status')
   assert.ok(r.confirmed_at);assert.equal(r.response_status,'accepted')
  })
  await verified(crew('declineShift'),async()=>{
   await invoke(roster,alternate,crew('declineShift'),{shift_id:shift.id,reason:prefix+' unavailable'})
   assert.equal((await find('shifts',shift.id,'response_status')).response_status,'declined')
  })
  await verified(crew('cancelShift'),async()=>{
   await invoke(shiftAction,head,crew('cancelShift'),{shift_id:shift.id,reason:prefix+' Cancel'})
   assert.equal((await find('shifts',shift.id,'status')).status,'cancelled')
  })
 })
 await domain('emergency',async()=>{
  await verified(crew('updateEventEmergencyInformation'),async()=>{
   const fields={event_id:event,emergency_number:'112',assembly_point:prefix+' Entrance',procedure:'QA procedure'}
   await denied(roster,staff,crew('updateEventEmergencyInformation'),fields)
   const allowed=await read(a.rpc('upt_feature_allowed',{p_feature:'emergency',p_event:event}),'EMERGENCY_FEATURE')
   if(!allowed){
    // Prove fail-closed behavior for a disabled feature before enabling
    // the intended positive fixture in this disposable database only.
    await denied(roster,head,crew('updateEventEmergencyInformation'),fields)
    sqlLocal("INSERT INTO public.role_ui_rules(role,feature_key,label,group_key,visible,enabled,condition_key,sort_order,settings) VALUES ('admin','emergency','Noodinformatie','operations',true,true,'always',115,'{}'::jsonb) ON CONFLICT (role,feature_key) DO UPDATE SET visible=true,enabled=true,condition_key='always'")
    assert.equal(await read(a.rpc('upt_feature_allowed',{p_feature:'emergency',p_event:event}),'EMERGENCY_FIXTURE_ENABLED'),true)
   }
   await invoke(roster,head,crew('updateEventEmergencyInformation'),fields)
   const r=await one(a.from('event_emergency_information').select('emergency_number,assembly_point,updated_by').eq('event_id',event),'EMERGENCY')
   assert.equal(r.emergency_number,'112');assert.equal(r.assembly_point,fields.assembly_point);assert.equal(r.updated_by,head.id)
  })
 })
 await domain('briefing-instructions',async()=>{
  const fields={event_id:event,workplace_id:workplace,title:prefix+' Briefing',body:'QA instructions'}
  let briefing,instruction
  await verified(crew('createBriefing'),async()=>{
   await invoke(crewAction,head,crew('createBriefing'),fields)
   briefing=await one(a.from('briefings').select('id,body').eq('event_id',event).eq('title',fields.title),'BRIEFING_CREATE')
   assert.equal(briefing.body,fields.body)
  })
  await verified(crew('updateBriefing'),async()=>{
   await invoke(crewAction,head,crew('updateBriefing'),{id:briefing.id,title:fields.title,body:'Updated instructions'})
   assert.equal((await find('briefings',briefing.id,'body')).body,'Updated instructions')
  })
  await verified(crew('acknowledgeBriefing'),async()=>{
   const seeded='00000000-0000-4000-8000-00000000e2e3'
   await invoke(memberAction,staff,crew('acknowledgeBriefing'),{id:seeded})
   assert.equal((await one(staff.db.from('briefing_acknowledgements').select('version').eq('briefing_id',seeded).eq('user_id',staff.id),'BRIEFING_ACK')).version,1)
  })
  await verified(crew('createPersonalInstruction'),async()=>{
   const data={...fields,user_id:staff.id,title:prefix+' Personal'}
   await denied(crewAction,staff,crew('createPersonalInstruction'),data)
   await invoke(crewAction,head,crew('createPersonalInstruction'),data)
   instruction=await one(a.from('personal_instructions').select('id,user_id,body').eq('event_id',event).eq('title',data.title),'INSTRUCTION_CREATE')
   assert.equal(instruction.user_id,staff.id);assert.equal(instruction.body,data.body)
  })
  await verified(crew('updatePersonalInstruction'),async()=>{
   await invoke(crewAction,head,crew('updatePersonalInstruction'),{id:instruction.id,title:prefix+' Personal updated',body:'Corrected'})
   assert.equal((await find('personal_instructions',instruction.id,'body')).body,'Corrected')
  })
  await verified(crew('acknowledgeInstruction'),async()=>{
   await invoke(memberAction,staff,crew('acknowledgeInstruction'),{id:instruction.id})
   const r=await one(staff.db.from('personal_instruction_acknowledgements').select('version').eq('instruction_id',instruction.id).eq('user_id',staff.id),'INSTRUCTION_ACK')
   assert.ok(r.version>=1)
  })
 })
 await domain('promotion',async()=>{
  const request=crypto.randomUUID(),fields={request,title:prefix+' Campaign',description:'QA promotion',user_id:promoter.id,admin_view:'1'}
  const save=async(name,data)=>{
   const r=await invoke(peopleAction,head,promotion(name),data)
   assert.ok(r.data.redirect?.includes('saved=1'),name+'_SAVED')
  }
  let task,assignment
  await verified(promotion('createPromotionTask'),async()=>{
   await save('createPromotionTask',fields)
   task=await find('tasks',request,'id,title,promotion_only,event_id,updated_at')
   assert.equal(task.title,fields.title);assert.equal(task.promotion_only,true);assert.equal(task.event_id,null)
  })
  await verified(promotion('editPromotionTask'),async()=>{
   await save('editPromotionTask',{task_id:task.id,title:prefix+' Campaign edit',description:'Updated',expected_updated_at:task.updated_at,admin_view:'1'})
   assert.equal((await find('tasks',task.id,'title')).title,prefix+' Campaign edit')
  })
  await verified(promotion('assignGeneralPromotionTask'),async()=>{
   await save('assignGeneralPromotionTask',{task_id:task.id,user_id:promoter.id,admin_view:'1'})
   assignment=await one(a.from('task_assignments').select('id').eq('task_id',task.id).eq('user_id',promoter.id),'PROMOTION_ASSIGN')
  })
  await verified(promotion('removeGeneralPromotionAssignment'),async()=>{
   await save('removeGeneralPromotionAssignment',{assignment_id:assignment.id,admin_view:'1'})
   assert.equal((await read(a.from('task_assignments').select('id').eq('id',assignment.id),'PROMOTION_REMOVE')).length,0)
  })
 })
 await domain('personnel',async()=>{
  const subject=await actor('bot-10-staff-fr',false,false),target={user_id:subject.id}
  await verified(people('portal-roles','changePortalRole'),async()=>{
   const id=people('portal-roles','changePortalRole'),fields={...target,portal:'promotion',role:'promoter',action:'assign_approved'}
   await denied(peopleAction,staff,id,fields)
   await invoke(peopleAction,head,id,fields)
   const r=(await read(subject.db.rpc('upt_my_portal_assignments'),'PORTAL_ASSIGN')).find(x=>x.portal==='promotion'&&x.role==='promoter')
   assert.ok(r,'PORTAL_ASSIGN_SUBJECT_MISSING')
   assert.equal(r.approved,true);assert.equal(r.revoked_at,null)
  })
  await verified(people('personnel','setPersonnelRole'),async()=>{
   const id=people('personnel','setPersonnelRole')
   await invoke(peopleAction,head,id,{...target,role:'responsible_lead'})
   assert.equal((await ownProfile(subject)).role,'responsible_lead')
   await invoke(peopleAction,head,id,{...target,role:'staff'})
   assert.equal((await ownProfile(subject)).role,'staff')
  })
  await verified(people('personnel','setPersonnelBlock'),async()=>{
   const id=people('personnel','setPersonnelBlock')
   await invoke(peopleAction,head,id,{...target,blocked:'true',reason:prefix+' blocked'})
   assert.equal((await ownProfile(subject)).account_blocked,true)
   assert.equal(await read(subject.db.rpc('upt_is_approved'),'BLOCKED_APPROVAL'),false)
   await invoke(peopleAction,head,id,{...target,blocked:'false',reason:prefix+' restored'})
   assert.equal((await ownProfile(subject)).account_blocked,false)
  })
  await verified(crew('setAccountStatus'),async()=>{
   await invoke(peopleAction,head,crew('setAccountStatus'),{...target,status:'pending',role:'staff'})
   assert.equal((await ownProfile(subject)).approved,false)
  })
  await verified(crew('approvePersonnelAccount'),async()=>{
   await invoke(peopleAction,head,crew('approvePersonnelAccount'),{...target,role:'staff'})
   assert.equal((await ownProfile(subject)).approved,true)
  })
 })
 await domain('finance-draft-settlement',async()=>{
  const partyName=prefix+' Customer',number=prefix+' Invoice'
  const fields={name:partyName,kind:'customer',payment_terms_days:'14',email:'qa@example.invalid'}
  let customer,doc,line,reminder
  const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10),issueDate=day(-40),dueDate=day(-10)
  await verified(finance('createCounterparty'),async()=>{
   await denied(financeAction,staff,finance('createCounterparty'),fields)
   await saved('createCounterparty',office,fields)
   customer=await one(a.from('admin_counterparties').select('id,payment_terms_days').eq('name',partyName),'CUSTOMER')
   assert.equal(customer.payment_terms_days,14)
  })
  await verified(finance('updateCounterparty'),async()=>{
   await saved('updateCounterparty',office,{...fields,counterparty_id:customer.id,payment_terms_days:'30'})
   assert.equal((await find('admin_counterparties',customer.id,'payment_terms_days')).payment_terms_days,30)
  })
  await verified(finance('createDraft'),async()=>{
   await saved('createDraft',office,{kind:'sales_invoice',document_number:number,net_amount:'100',tax_amount:'21',counterparty_id:customer.id,issue_date:issueDate,due_date:dueDate})
   doc=await one(a.from('admin_financial_documents').select('id,status,gross_amount').eq('document_number',number),'INVOICE_DRAFT')
   assert.equal(doc.status,'draft');assert.equal(Number(doc.gross_amount),121)
  })
  const docFields=()=>({document_id:doc.id})
  await verified(finance('updateDraftNotes'),async()=>{
   await saved('updateDraftNotes',office,{...docFields(),notes:prefix})
   assert.equal((await find('admin_financial_documents',doc.id,'notes')).notes,prefix)
  })
  await verified(finance('updateDraftDocumentNumber'),async()=>{
   await saved('updateDraftDocumentNumber',office,{...docFields(),document_number:number+' edited'})
   assert.equal((await find('admin_financial_documents',doc.id,'document_number')).document_number,number+' edited')
  })
  await verified(finance('updateDraftCounterparty'),async()=>{
   await saved('updateDraftCounterparty',office,{...docFields(),counterparty_id:customer.id,use_payment_terms:'on'})
   assert.equal((await find('admin_financial_documents',doc.id,'counterparty_id')).counterparty_id,customer.id)
  })
  await verified(finance('updateInvoiceDates'),async()=>{
   await saved('updateInvoiceDates',office,{...docFields(),issue_date:issueDate,due_date:dueDate})
   assert.equal((await find('admin_financial_documents',doc.id,'due_date')).due_date,dueDate)
  })
  await verified(finance('addInvoiceLine'),async()=>{
   await saved('addInvoiceLine',office,{...docFields(),description:prefix+' Line',quantity:'2',unit_price:'50',vat_rate:'21'})
   line=await one(a.from('admin_financial_lines').select('id,quantity,unit_price').eq('document_id',doc.id).eq('description',prefix+' Line'),'LINE')
   assert.equal(Number(line.quantity),2);assert.equal(Number(line.unit_price),50)
  })
  await verified(finance('updateInvoiceLine'),async()=>{
   await saved('updateInvoiceLine',office,{...docFields(),line_id:line.id,description:prefix+' Line edited',quantity:'1',unit_price:'100',vat_rate:'21'})
   const r=await find('admin_financial_lines',line.id,'description,unit_price')
   assert.equal(r.description,prefix+' Line edited');assert.equal(Number(r.unit_price),100)
  })
  await verified(finance('removeInvoiceLine'),async()=>{
   await saved('addInvoiceLine',office,{...docFields(),description:prefix+' Temporary',quantity:'1',unit_price:'1',vat_rate:'21'})
   const temp=await one(a.from('admin_financial_lines').select('id').eq('document_id',doc.id).eq('description',prefix+' Temporary'),'TEMP_LINE')
   await saved('removeInvoiceLine',office,{...docFields(),line_id:temp.id})
   assert.equal((await read(a.from('admin_financial_lines').select('id').eq('id',temp.id),'LINE_REMOVE')).length,0)
  })
  await verified(finance('updateFinancialStatus'),async()=>{
   await saved('updateFinancialStatus',office,{...docFields(),status:'review'})
   await invoke(financeAction,office,finance('updateFinancialStatus'),{...docFields(),status:'approved'})
   assert.equal((await find('admin_financial_documents',doc.id,'status')).status,'review')
   await saved('updateFinancialStatus',head,{...docFields(),status:'approved'})
   const r=await find('admin_financial_documents',doc.id,'status,approved_by,gross_amount')
   assert.equal(r.status,'approved');assert.equal(r.approved_by,head.id);assert.equal(Number(r.gross_amount),121)
  })
  const reminderFields=()=>({...docFields(),recipient_email:'qa@example.invalid',subject:prefix+' Reminder',body:'QA only; no dispatch'})
  await verified(finance('createPaymentReminder'),async()=>{
   await saved('createPaymentReminder',office,reminderFields())
   reminder=await one(a.from('admin_payment_reminders').select('id,status,revision').eq('document_id',doc.id),'REMINDER')
   assert.equal(reminder.status,'draft')
  })
  await verified(finance('editPaymentReminderDraft'),async()=>{
   await saved('editPaymentReminderDraft',office,{...reminderFields(),reminder_id:reminder.id,expected_revision:reminder.revision,body:'Updated QA only'})
   const r=await find('admin_payment_reminders',reminder.id,'revision,body')
   assert.equal(r.body,'Updated QA only');assert.ok(r.revision>reminder.revision);reminder.revision=r.revision
  })
  await verified(finance('updatePaymentReminder'),async()=>{
   await saved('updatePaymentReminder',head,{reminder_id:reminder.id,expected_revision:reminder.revision,status:'approved'})
   const r=await find('admin_payment_reminders',reminder.id,'status,approved_by')
   assert.equal(r.status,'approved');assert.equal(r.approved_by,head.id)
  })
  await verified(finance('recordFinancialPayment'),async()=>{
   const payment=crypto.randomUUID(),fields={...docFields(),payment_id:payment,amount:'121',paid_on:day(0),bank_reference:prefix}
   await saved('recordFinancialPayment',head,fields);await saved('recordFinancialPayment',head,fields)
   const r=await find('admin_financial_payments',payment,'amount,document_id')
   assert.equal(Number(r.amount),121);assert.equal(r.document_id,doc.id)
   assert.equal((await read(a.from('admin_financial_payments').select('amount').eq('document_id',doc.id),'PAYMENT_REPLAY')).length,1)
  })
 })
 await domain('inventory-condition-recovery',async()=>{
  const name=prefix+' Condition fixture'
  await invoke(nativeInventoryActionResponse,head,crew('createInventoryItem'),{workplace_id:workplace,name,quantity:'4',item_kind:'asset'})
  const item=await one(a.from('inventory_items').select('id').eq('workplace_id',workplace).eq('name',name),'CONDITION_FIXTURE')
  const stock=()=>find('inventory_items',item.id,'total_quantity,available_quantity,damaged_quantity,missing_quantity')
  await verified(crew('reportWorkplaceInventoryCondition'),async()=>{
   const fields={item_id:item.id,phase:'opening',condition:'damaged',quantity:'1',notes:prefix}
   await denied(nativeInventoryActionResponse,staff,crew('reportWorkplaceInventoryCondition'),fields)
   assert.equal((await stock()).damaged_quantity,0)
   await invoke(nativeInventoryActionResponse,head,crew('reportWorkplaceInventoryCondition'),fields)
   const row=await stock();assert.equal(row.total_quantity,4);assert.equal(row.available_quantity,3);assert.equal(row.damaged_quantity,1)
   await invoke(nativeInventoryActionResponse,head,crew('reportWorkplaceInventoryCondition'),{...fields,phase:'closing',condition:'missing'})
   const after=await stock();assert.equal(after.available_quantity,2);assert.equal(after.missing_quantity,1)
  })
  await verified(crew('restoreInventoryQuantity'),async()=>{
   const fields={item_id:item.id,condition:'damaged',quantity:'1',notes:prefix}
   await denied(nativeInventoryActionResponse,staff,crew('restoreInventoryQuantity'),fields)
   await invoke(nativeInventoryActionResponse,head,crew('restoreInventoryQuantity'),fields)
   await denied(nativeInventoryActionResponse,head,crew('restoreInventoryQuantity'),fields)
   await invoke(nativeInventoryActionResponse,head,crew('restoreInventoryQuantity'),{...fields,condition:'missing'})
   const row=await stock();assert.equal(row.total_quantity,4);assert.equal(row.available_quantity,4)
   assert.equal(row.damaged_quantity,0);assert.equal(row.missing_quantity,0)
  })
 })
 await domain('workplace-capacity',async()=>{
  const start=new Date(Date.now()+9*86400000).toISOString(),end=new Date(Date.parse(start)+4*3600000).toISOString()
  const name=prefix+' Workplace event'
  await invoke(megaCrewEventResponse,head,crew('createEvent'),{name,start_at:start,end_at:end,radius:'100'})
  const e=await one(a.from('events').select('id').eq('name',name),'WORKPLACE_EVENT')
  const fields={event_id:e.id,name:prefix+' Capacity',default_shift_start:start,default_shift_end:end,minimum_staff:'1',target_staff:'3',maximum_staff:'5',sort_order:'9'}
  let post
  await verified(crew('addWorkplace'),async()=>{
   await denied(megaCrewEventResponse,staff,crew('addWorkplace'),fields)
   await invoke(megaCrewEventResponse,head,crew('addWorkplace'),fields)
   post=await one(a.from('workplaces').select('id,minimum_staff,target_staff,maximum_staff,sort_order,is_active').eq('event_id',e.id).eq('name',fields.name),'WORKPLACE_ADD')
   assert.equal(post.minimum_staff,1);assert.equal(post.target_staff,3);assert.equal(post.maximum_staff,5);assert.equal(post.sort_order,9);assert.equal(post.is_active,true)
  })
  await verified(crew('updateWorkplace'),async()=>{
   const change={...fields,workplace_id:post.id,name:prefix+' Capacity edited',minimum_staff:'2',target_staff:'4',maximum_staff:'6',is_active:'on'}
   await denied(megaCrewEventResponse,head,crew('updateWorkplace'),{...change,maximum_staff:'1'})
   assert.equal((await find('workplaces',post.id,'name')).name,fields.name)
   await invoke(megaCrewEventResponse,head,crew('updateWorkplace'),change)
   const row=await find('workplaces',post.id,'name,minimum_staff,target_staff,maximum_staff,is_active')
   assert.equal(row.name,change.name);assert.equal(row.minimum_staff,2);assert.equal(row.target_staff,4);assert.equal(row.maximum_staff,6);assert.equal(row.is_active,true)
  })
 })
 await domain('notifications-read-isolation',async()=>{
  // Seed only synthetic notifications using the explicitly loopback psql helper.
  // All mutations under test still use the actual signed native handlers.
  for(const id of [staff.id,unrelated.id])assert.match(id,/^[0-9a-f-]{36}$/i)
  assert.match(prefix,/^PHASE23-[0-9a-f]{12}$/)
  const title=prefix+' Notification'
  sqlLocal("INSERT INTO public.crew_notifications(user_id,title,kind) SELECT '"+staff.id+"'::uuid,'"+title+"','inventory' FROM generate_series(1,51)")
  const foreign=sqlLocal("INSERT INTO public.crew_notifications(user_id,title,kind) VALUES ('"+unrelated.id+"'::uuid,'"+title+"','inventory') RETURNING id").split('\n')[0]
  assert.match(foreign,/^[0-9a-f-]{36}$/i)
  const own=await read(staff.db.from('crew_notifications').select('id,read_at').eq('title',title),'NOTIFICATION_FIXTURES')
  assert.equal(own.length,51);assert.ok(own.every(x=>!x.read_at))
  const foreignRead=()=>one(unrelated.db.from('crew_notifications').select('read_at').eq('id',foreign),'FOREIGN_NOTIFICATION')
  await verified(crew('markNotificationRead'),async()=>{
   await invoke(memberAction,staff,crew('markNotificationRead'),{notification_id:own[0].id})
   assert.ok((await one(staff.db.from('crew_notifications').select('read_at').eq('id',own[0].id),'SINGLE_NOTIFICATION')).read_at)
   const attempted=await memberAction(req(crew('markNotificationRead'),{notification_id:foreign}),staff.db,crew('markNotificationRead'))
   assert.ok([200,422].includes(attempted.status),'FOREIGN_NOTIFICATION_HTTP')
   assert.equal((await foreignRead()).read_at,null)
  })
  await verified(crew('markAllNotificationsRead'),async()=>{
   // Add one extra unread own notification to guarantee >50 pending rows.
   sqlLocal("INSERT INTO public.crew_notifications(user_id,title,kind) VALUES ('"+staff.id+"'::uuid,'"+title+"','inventory')")
   await invoke(megaOperationsResponse,staff,crew('markAllNotificationsRead'),{},{noForm:true})
   const rows=await read(staff.db.from('crew_notifications').select('id,read_at').eq('title',title),'ALL_NOTIFICATIONS')
   assert.equal(rows.length,52);assert.ok(rows.every(x=>x.read_at));assert.equal((await foreignRead()).read_at,null)
  })
 })
 await domain('text-document-storage',async()=>{
  const invTitle=prefix+' Inventory text',postName=prefix+' Price post',body='QA synthetic text only'
  let doc
  const lookup=heading=>one(a.from('event_documents').select('id,storage_path,uploaded_by,mime_type,file_size_bytes,is_active,offline_critical,description').eq('event_id',event).eq('workplace_id',workplace).eq('title',heading),'TEXT_DOCUMENT')
  const verifyDoc=async(row)=>{
   assert.equal(row.uploaded_by,head.id);assert.equal(row.mime_type,'text/plain')
   assert.equal(row.file_size_bytes,new TextEncoder().encode(body).byteLength);assert.equal(row.description,body)
   assert.equal(row.is_active,true);assert.equal(row.offline_critical,true)
   // Independently verify storage existence using the disposable DB catalog.
   assert.match(row.storage_path,/^[0-9a-f-]{36}\/document\/[0-9a-f-]{36}\.txt$/i)
   assert.equal(sqlLocal("SELECT count(*) FROM storage.objects WHERE bucket_id='work-media' AND name='"+row.storage_path+"'"),'1')
  }
  await verified(crew('createInventoryTextEntry'),async()=>{
   const fields={event_id:event,workplace_id:workplace,title:invTitle,content:body}
   await denied(safeAction,staff,crew('createInventoryTextEntry'),fields)
   await invoke(safeAction,head,crew('createInventoryTextEntry'),fields)
   doc=await lookup(invTitle);await verifyDoc(doc)
  })
  await verified(crew('createPriceListTextEntry'),async()=>{
   await invoke(safeAction,head,crew('createPriceListTextEntry'),{event_id:event,workplace_id:workplace,workplace_name:postName,price_list_text:body})
   await verifyDoc(await lookup('Prijslijst · '+postName))
  })
  await verified(crew('archiveEventDocument'),async()=>{
   await denied(megaOperationsResponse,staff,crew('archiveEventDocument'),{document_id:doc.id})
   assert.match(doc.id,/^[0-9a-f-]{36}$/i)
   await invoke(megaOperationsResponse,head,crew('archiveEventDocument'),{document_id:doc.id})
   assert.equal(sqlLocal("SELECT is_active FROM public.event_documents WHERE id='"+doc.id+"'::uuid"),'f')
   assert.equal(sqlLocal("SELECT count(*) FROM storage.objects WHERE bucket_id='work-media' AND name='"+doc.storage_path+"'"),'0')
  })
 })
 await domain('maker',async()=>{
 const enter='lib/actions/god-mode.ts#enterGodModeFromMakerSession'
 const normal='lib/actions/auth.ts#enterNormalAppFromMakerSession'
 const back='lib/actions/god-mode.ts#returnToNormalAppFromGodMode'
 assert.equal((await invoke(megaMakerResponse,head,enter,{}, {noForm:true})).data.redirect,'/unauthorized')
 operations.push({id:enter,outcome:'denied'})
 let token
 const valid=async()=>await read(maker.db.rpc('upt_god_session_valid',{p_token:token}),'GOD_SESSION_VALID')
 const enterGod=async()=>{
  const result=await invoke(megaMakerResponse,maker,enter,{}, {noForm:true})
  assert.equal(result.data.redirect,'/god-mode')
  const cookie=result.cookies.find(x=>x.startsWith('uptilldawn-god-session='))
  assert.ok(cookie?.includes('HttpOnly')&&cookie.includes('Secure'))
  token=decodeURIComponent(cookie.split(';')[0].slice('uptilldawn-god-session='.length))
  assert.ok(token);assert.equal(await valid(),true)
 }
 await verified(enter,enterGod)
 await verified(back,async()=>{
  const r=await invoke(megaMakerResponse,maker,back,{}, {noForm:true,cookie:'uptilldawn-god-session='+encodeURIComponent(token)})
  assert.equal(r.data.redirect,'/admin');assert.equal(await valid(),false)
 })
 await verified(normal,async()=>{
  const r=await invoke(megaMakerResponse,maker,normal,{portal:'staff'})
  assert.equal(r.data.redirect,'/')
  assert.equal(await read(maker.db.rpc('upt_current_effective_role'),'MAKER_STAFF_ROLE'),'staff')
 })
 await enterGod()
 await verified(godLogoutId,async()=>{
  const r=await invoke(megaMakerResponse,maker,godLogoutId,{}, {noForm:true,cookie:'uptilldawn-god-session='+encodeURIComponent(token)})
  assert.equal(r.data.redirect,'/login/admin');assert.equal(await valid(),false)
 })
 })
 if(failures.length)failed=failures.length+' native acceptance domain(s) failed'
}catch(error){
 // Identity/setup failure invalidates all dependent cases; still report it.
 failed=safeFailure(error)
 failures.push({domain:'setup',reason:failed})
 console.error(failed)
}finally{
 for(const db of actors)try{await db.auth.signOut({scope:'local'})}catch{}
 globalThis.fetch=originalFetch
 const dir=resolve(import.meta.dirname,'../../test-results/phase-two-three-local-native')
 mkdirSync(dir,{recursive:true})
 const ids=[...new Set(operations.filter(x=>x.outcome==='positive').map(x=>x.id))]
 writeFileSync(resolve(dir,'report.json'),JSON.stringify({validatedSha:sha,runId:process.env.GITHUB_RUN_ID||null,runAttempt:process.env.GITHUB_RUN_ATTEMPT||null,scope:'disposable-loopback-native-handlers-with-signed-users',operations,positiveActionIds:ids,domains,failures,failed,productionReady:false,liveMainParityVerified:false},null,2)+'\n')
 if(!failed)console.log('PASS actual local native action IDs: '+ids.length)
}
if(failed)process.exitCode=1
