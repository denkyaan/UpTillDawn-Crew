import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
const fixture=process.env.UPT_QA_FIXTURE_PATH?JSON.parse(await readFile(process.env.UPT_QA_FIXTURE_PATH,'utf8')):null
const url=process.env.BOT_SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,base=process.env.BOT_TEST_BASE_URL||'http://localhost:3000'
const password=fixture?.password||process.env.BOT_TEST_PASSWORD
if(!url||!key||!password)throw Error('Missing isolated test credentials')
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('HTTP workflow tests require a local application')
if(!['localhost','127.0.0.1'].includes(new URL(url).hostname)&&!(fixture&&new URL(url).hostname==='npbjrtiolqperdgljnhi.supabase.co'))throw Error('Production database is forbidden')
const prefix='QA-HTTP-'+randomUUID().slice(0,8),checks=[]
const created={prefix,eventId:fixture?.eventId??null,counterpartyIds:[],documentIds:[],workplaceIds:[],itemIds:[],obligationIds:[],bookingIds:[]}
const known={admin:'bot-01-admin-nl@bots.uptilldawn.test',administration:'bot-04-staff-de@bots.uptilldawn.test',staff:'bot-03-staff-en@bots.uptilldawn.test',promotion:'bot-05-staff-nl@bots.uptilldawn.test'}
const ok=name=>{checks.push(name);console.log('PASS:',name)}
const one=async q=>{const {data,error}=await q.single();if(error)throw Error(error.message);return data}
async function account(role){
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data,error}=await db.auth.signInWithPassword({email:fixture?.users.find(u=>u.role===role)?.email||known[role],password});if(error)throw error
 const response=await fetch(base+'/api/test-auth-session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({access_token:data.session.access_token,refresh_token:data.session.refresh_token})})
 assert.equal(response.status,200)
 return {db,user:data.user,cookie:response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')}
}
const [admin,office,staff,promo]=await Promise.all(['admin','administration','staff','promotion'].map(account))
const decode=s=>s.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>')
async function get(path,who=office){const r=await fetch(base+path,{headers:{cookie:who.cookie,'accept-language':'en'},redirect:'manual'});assert.equal(r.status,200,path+' HTTP '+r.status);return r.text()}
function form(html,contains){
 const found=[...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].find(m=>contains.every(x=>m[1].includes(x)))
 if(!found)throw Error('Rendered form missing: '+contains.join(' + '))
 const data=new FormData()
 for(const tag of found[1].matchAll(/<input\b[^>]*>/g)){
  const attrs=Object.fromEntries([...tag[0].matchAll(/([A-Za-z0-9_$:-]+)="([^"]*)"/g)].map(m=>[m[1],decode(m[2])]))
  if(attrs.name&&attrs.type==='hidden')data.append(attrs.name,attrs.value??'')
 }
 return data
}
async function submit(path,who,contains,values){
 const html=await get(path,who),body=form(html,contains)
 for(const [k,v] of Object.entries(values))body.set(k,String(v))
 const r=await fetch(base+path,{method:'POST',headers:{cookie:who.cookie,origin:base,'accept-language':'en'},body,redirect:'manual'})
 const text=await r.text()
 if(r.status>=400)throw Error('Server form failed '+r.status+' '+path+' '+text.match(/digest[^<]{0,160}/)?.[0])
 const location=r.headers.get('location')??''
 if(location.includes('error=1'))throw Error('Server form rejected '+contains.join(','))
 return {body,location}
}
await mkdir('test-results/administration-http',{recursive:true})
let failure
try{
 if(!created.eventId){const event=await one(admin.db.from('events').insert({name:prefix,start_at:new Date(Date.now()+86400000).toISOString(),end_at:new Date(Date.now()+172800000).toISOString(),start_date:new Date(Date.now()+86400000).toISOString(),end_date:new Date(Date.now()+172800000).toISOString(),status:'scheduled',created_by:admin.user.id,onboarding_required:false}).select('id'));created.eventId=event.id}
 const finance='/portals/administration/finance'
 await submit(finance,office,['name="name"','name="iban"'],{name:prefix+' Supplier',kind:'both',email:'sales@artist.agency',iban:'BE68 5390 0754 7034',bic:'',street_address:'Test 1',postal_code:'1000',city:'Brussel',country_code:'BE',payment_terms_days:'14'})
 const cp=await one(office.db.from('admin_counterparties').select('id,iban,email').eq('name',prefix+' Supplier'));created.counterpartyIds.push(cp.id)
 assert.equal(cp.iban,'BE68539007547034');assert.equal(cp.email,'sales@artist.agency');ok('Rendered counterparty form accepts email and spaced IBAN')
 const today=new Date().toISOString().slice(0,10)
 await submit(finance,office,['name="net_amount"'],{kind:'purchase_invoice',document_number:prefix+'-BUY',counterparty_id:cp.id,event_id:created.eventId,net_amount:0,tax_amount:0,issue_date:today,due_date:today,notes:''})
 const doc=await one(office.db.from('admin_financial_documents').select('id,event_id,status').eq('document_number',prefix+'-BUY'));created.documentIds.push(doc.id);assert.equal(doc.event_id,created.eventId)
 await submit(finance,office,[`value="${doc.id}"`,'name="description"','name="quantity"'],{document_id:doc.id,description:prefix+' Equipment',quantity:2,unit_price:10,vat_rate:0})
 const line=await one(office.db.from('admin_financial_lines').select('id').eq('document_id',doc.id))
 await submit(finance,office,[`value="${doc.id}"`,'name="status"','value="review"'],{document_id:doc.id,status:'review'})
 assert.equal((await one(office.db.from('admin_financial_documents').select('status,gross_amount').eq('id',doc.id))).status,'review');ok('Rendered invoice form persists dates, event, line and review')
 const denied=await office.db.from('admin_financial_documents').update({status:'approved',approved_by:office.user.id,approved_at:new Date().toISOString()}).eq('id',doc.id).select('id');assert.ok(denied.error||!denied.data?.length)
 await submit(finance,admin,[`value="${doc.id}"`,'name="status"','value="approved"'],{document_id:doc.id,status:'approved'})
 assert.equal((await one(admin.db.from('admin_financial_documents').select('status').eq('id',doc.id))).status,'approved');ok('Approval denies administrative employee and succeeds through Admin form')
 const workplace=await one(admin.db.from('workplaces').insert({event_id:created.eventId,name:prefix,sort_order:1,is_active:true}).select('id'));created.workplaceIds.push(workplace.id)
 const makeItem=await admin.db.rpc('upt_create_inventory_item',{p_workplace:workplace.id,p_name:prefix+' Equipment',p_category:'test',p_quantity:1,p_item_kind:'asset'});if(makeItem.error)throw makeItem.error
 const item=await one(admin.db.from('inventory_items').select('id').eq('workplace_id',workplace.id));created.itemIds.push(item.id)
 const receipt=await submit('/portals/administration/modules/inventory',admin,[`value="${line.id}"`,'name="request"'],{line:line.id,item:item.id,quantity:2})
 const request=receipt.body.get('request')
 assert.equal((await one(admin.db.from('inventory_items').select('total_quantity').eq('id',item.id))).total_quantity,3)
 const replay=await admin.db.rpc('upt_receive_invoice_inventory',{p_request:request,p_line:line.id,p_item:item.id,p_quantity:2});assert.equal(replay.error,null);assert.equal(replay.data,false)
 assert.ok((await admin.db.rpc('upt_receive_invoice_inventory',{p_request:randomUUID(),p_line:line.id,p_item:item.id,p_quantity:1})).error)
 assert.ok((await office.db.rpc('upt_receive_invoice_inventory',{p_request:randomUUID(),p_line:line.id,p_item:item.id,p_quantity:1})).error)
 assert.equal((await one(admin.db.from('inventory_items').select('total_quantity').eq('id',item.id))).total_quantity,3);ok('Inventory receipt form is transactional, Admin-only and replay-safe')
 const saleId=prefix+'-SALE',header='external_id,event_id,quantity,gross_amount,currency,sold_at\n'
 const csv=header+`${saleId},${created.eventId},2,30.00,EUR,2026-10-30T00:30:00+02:00\n`
 async function importCsv(who,text,origin=base){const f=new FormData();f.set('eventId',created.eventId);f.set('source','ticketplatform');f.set('file',new File([text],'sales.csv',{type:'text/csv'}));return fetch(base+'/api/administration/ticketing/import',{method:'POST',headers:{cookie:who.cookie,origin},body:f})}
 let r=await importCsv(office,csv);let imported=await r.json();assert.equal(r.status,200,JSON.stringify(imported));assert.equal(imported.result.inserted,1)
 r=await importCsv(office,csv);assert.equal(r.status,200);assert.equal((await r.json()).result.inserted,0)
 const conflict=header+`${prefix}-NEW,${created.eventId},1,5.00,EUR,2026-10-30T12:00:00Z\n`+`${saleId},${created.eventId},2,99.00,EUR,2026-10-30T00:30:00+02:00\n`
 assert.equal((await importCsv(office,conflict)).status,409)
 assert.equal((await office.db.from('admin_ticket_sales').select('id').eq('external_id',prefix+'-NEW')).data.length,0)
 assert.equal((await importCsv(staff,csv)).status,403);assert.equal((await importCsv(office,csv,'https://foreign.invalid')).status,403)
 ok('HTTP CSV import persists once, rolls back conflict batch and denies staff/cross-origin writes')
 const permit='/portals/administration/modules/permits',deadline=new Date(Date.now()+86400000*7).toISOString().slice(0,10)
 await submit(permit,office,['name="title"','name="deadline"'],{kind:'permits',title:prefix+' Permit',deadline,event:created.eventId,details:'Dedicated test case'})
 const obligation=await one(office.db.from('admin_operational_obligations').select('id').eq('title',prefix+' Permit'));created.obligationIds.push(obligation.id)
 await submit(permit,office,[`value="${obligation.id}"`,'value="submitted"'],{kind:'permits',id:obligation.id,action:'submitted',status:'open'})
 assert.ok((await office.db.from('admin_operational_obligations').update({status:'approved'}).eq('id',obligation.id).select('id')).error)
 await submit(permit,admin,[`value="${obligation.id}"`,'value="approved"'],{kind:'permits',id:obligation.id,action:'approved',status:'submitted'})
 await submit(permit,office,[`value="${obligation.id}"`,'value="completed"'],{kind:'permits',id:obligation.id,action:'completed',status:'approved'})
 assert.equal((await one(office.db.from('admin_operational_obligations').select('status').eq('id',obligation.id))).status,'completed');ok('Rendered case forms submit, independently approve and complete with audit')
 const staffPayroll=await fetch(base+'/api/administration/payroll/export?event='+created.eventId,{headers:{cookie:staff.cookie}});assert.equal(staffPayroll.status,403);ok('Payroll export denies ordinary staff')
 for(const locale of ['nl','fr','en','de'])for(const path of ['/portals/administration/modules/ticketing','/portals/administration/modules/banking','/portals/administration/modules/inventory','/portals/administration/modules/permits','/portals/administration/modules/automations']){
  const response=await fetch(base+path,{headers:{cookie:office.cookie,'accept-language':locale},redirect:'manual'});assert.equal(response.status,200,path+' '+locale)
 }
 for(const path of ['/portals/promotion','/portals/promotion/chats','/portals/promotion/tasks','/portals/promotion/staff'])await get(path,promo)
 ok('Four-locale Administration and promotion routes render with real role sessions')
}catch(e){failure=e;console.error('FAIL:',e.message)}finally{
 await writeFile('test-results/administration-http/manifest.json',JSON.stringify(created,null,2));await writeFile('test-results/administration-http/result.json',JSON.stringify({checks,failed:failure?.message??null},null,2))
}
if(failure)throw failure
