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
import {megaMakerResponse,godLogoutId} from '../src/api/native-mega-maker-actions.ts'
const target='http://127.0.0.1:54321'
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||''
const password=process.env.BOT_TEST_PASSWORD||''
if(process.env.BOT_SUPABASE_URL!==target||process.env.NEXT_PUBLIC_SUPABASE_URL!==target||
 process.env.BOT_DB_URL!=='postgresql://postgres:postgres@127.0.0.1:54322/postgres'||
 !key||key===process.env.BOT_SERVICE_ROLE_KEY||password.length<24)throw Error('DISPOSABLE_LOOPBACK_REQUIRED')
const originalFetch=globalThis.fetch
const localFetch=(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input))
 if(url.origin!==target)throw Error('NONLOCAL_NETWORK_BLOCKED')
 return originalFetch(input,{...init,redirect:'error'})
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
 if(error)throw Error(label+'_'+(error.code||'DB'))
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
 const res=await handler(req(id,fields,options),identity.db,id)
 assert.equal(res.status,options.status||200,id+'_HTTP')
 const data=await res.json()
 if(options.status===422)assert.equal(data.code,'action_failed',id)
 return {data,cookies:res.headers.getSetCookie()}
}
async function verified(id,fn){
 await fn()
 operations.push({id,outcome:'positive',persistenceVerified:true})
 console.log('PASS native local '+id)
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
  await invoke(megaOperationsResponse,head,platform('updateAssetMetadata'),{item_id:item.id,asset_code:prefix,barcode:prefix+'-bar',serial_number:'QA-1',location_label:'QA shelf',reorder_threshold:'2',unit_cost:'12.50',asset_notes:prefix})
  const row=await one(a.from('inventory_items').select('location_label,reorder_threshold,unit_cost_cents,asset_notes').eq('id',item.id),'ASSET_METADATA')
  assert.equal(row.location_label,'QA shelf');assert.equal(row.reorder_threshold,2);assert.equal(row.unit_cost_cents,1250);assert.equal(row.asset_notes,prefix)
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
 // Complete using the original audited RPC before testing native close/reopen.
 await read(a.rpc('upt_set_operational_checklist_item',{p_item:checkItem.id,p_complete:true}),'CHECKLIST_COMPLETE_FIXTURE')
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
