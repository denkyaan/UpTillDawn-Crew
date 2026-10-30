import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
const f=JSON.parse(await readFile(process.env.UPT_QA_FIXTURE_PATH,'utf8')),url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if(new URL(url).hostname!=='npbjrtiolqperdgljnhi.supabase.co')throw Error('Staging-only fixtures required')
const prefix='QA-RPC-'+randomUUID().slice(0,8),created={prefix,eventId:f.eventId,documentIds:[],counterpartyIds:[],itemIds:[],workplaceIds:[],obligationIds:[],bookingIds:[],rosterIds:[],shiftIds:[]},checks=[]
const pass=name=>{checks.push(name);console.log('PASS:',name)}
async function login(role){const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),user=f.users.find(u=>u.role===role);const r=await db.auth.signInWithPassword({email:user.email,password:f.password});if(r.error)throw r.error;return {db,user}}
const [admin,office,staff]=await Promise.all(['admin','administration','staff'].map(login))
const one=async q=>{const r=await q.single();if(r.error)throw Error(r.error.message);return r.data}
const rpc=async(db,name,args)=>{const r=await db.rpc(name,args);if(r.error)throw Error(name+': '+r.error.message);return r.data}
const today=new Date().toISOString().slice(0,10)
let failure
try{
 const cp=await one(office.db.from('admin_counterparties').insert({name:prefix,kind:'both',email:'sales@artist.agency',iban:'BE68539007547034',street_address:'Test 1',postal_code:'1000',city:'Brussel',country_code:'BE'}).select('id'));created.counterpartyIds.push(cp.id)
 async function document(kind,amount,original=null){const d=await one(office.db.from('admin_financial_documents').insert({kind,event_id:f.eventId,counterparty_id:cp.id,document_number:prefix+'-'+created.documentIds.length,issue_date:today,due_date:today,currency:'EUR',net_amount:0,tax_amount:0,status:'draft',original_invoice_id:original}).select('id'));created.documentIds.push(d.id);const line=await one(office.db.from('admin_financial_lines').insert({document_id:d.id,description:prefix,quantity:2,unit_price:amount/2,vat_rate:0}).select('id'));await one(office.db.from('admin_financial_documents').update({status:'review'}).eq('id',d.id).select('id'));return {...d,line:line.id}}
 const invoice=await document('purchase_invoice',20)
 const forged=await office.db.from('admin_financial_documents').update({status:'approved',approved_by:office.user.id,approved_at:new Date().toISOString()}).eq('id',invoice.id).select('id');assert.ok(forged.error||!forged.data?.length)
 await one(admin.db.from('admin_financial_documents').update({status:'approved',approved_by:admin.user.id,approved_at:new Date().toISOString()}).eq('id',invoice.id).select('id'));pass('Invoice review and Admin approval enforce real role permissions')
 const workplace=await one(admin.db.from('workplaces').insert({event_id:f.eventId,name:prefix,sort_order:1,is_active:true}).select('id'));created.workplaceIds.push(workplace.id)
 await rpc(admin.db,'upt_create_inventory_item',{p_workplace:workplace.id,p_name:prefix,p_category:'test',p_quantity:1,p_item_kind:'asset'})
 const item=await one(admin.db.from('inventory_items').select('id,total_quantity').eq('workplace_id',workplace.id));created.itemIds.push(item.id)
 const request=randomUUID(),receipt={p_request:request,p_line:invoice.line,p_item:item.id,p_quantity:2}
 assert.equal(await rpc(admin.db,'upt_receive_invoice_inventory',receipt),true);assert.equal(await rpc(admin.db,'upt_receive_invoice_inventory',receipt),false)
 assert.ok((await admin.db.rpc('upt_receive_invoice_inventory',{...receipt,p_request:randomUUID(),p_quantity:1})).error)
 assert.ok((await office.db.rpc('upt_receive_invoice_inventory',{...receipt,p_request:randomUUID(),p_quantity:1})).error)
 assert.equal((await one(admin.db.from('inventory_items').select('total_quantity').eq('id',item.id))).total_quantity,3);pass('Invoice-linked stock receipt rejects replay inflation, over-receipt and employee writes')
 const sale={externalId:prefix+'-SALE',eventId:f.eventId,quantity:2,grossCents:3000,currency:'EUR',soldAt:'2026-10-30T12:00:00.000Z'}
 const args={p_event:f.eventId,p_source:'qa-rpc',p_sha256:'a'.repeat(64),p_rows:[sale]}
 const imported=await rpc(office.db,'upt_import_ticket_sales',args);assert.equal(imported.inserted,1)
 const repeated=await rpc(office.db,'upt_import_ticket_sales',args);assert.equal(repeated.inserted,0)
 const conflicting=await office.db.rpc('upt_import_ticket_sales',{...args,p_sha256:'b'.repeat(64),p_rows:[{...sale,externalId:prefix+'-NEW'},{...sale,grossCents:9900}]});assert.equal(conflicting.error?.code,'23505')
 assert.equal((await office.db.from('admin_ticket_sales').select('id').eq('external_id',prefix+'-NEW')).data.length,0)
 assert.ok((await staff.db.rpc('upt_import_ticket_sales',{...args,p_sha256:'c'.repeat(64)})).error)
 assert.equal((await staff.db.from('admin_ticket_sales').select('id').eq('external_id',sale.externalId)).data.length,0);pass('Ticket imports persist once, roll back conflicting batches and enforce staff RLS')
 const obligation=await one(office.db.from('admin_operational_obligations').insert({kind:'permits',event_id:f.eventId,title:prefix,due_at:new Date(Date.now()+7*86400000).toISOString(),created_by:office.user.id}).select('id'));created.obligationIds.push(obligation.id)
 await one(office.db.from('admin_operational_obligations').update({status:'submitted'}).eq('id',obligation.id).select('id'))
 assert.ok((await office.db.from('admin_operational_obligations').update({status:'approved'}).eq('id',obligation.id).select('id')).error)
 await one(admin.db.from('admin_operational_obligations').update({status:'approved'}).eq('id',obligation.id).select('id'))
 await one(office.db.from('admin_operational_obligations').update({status:'completed'}).eq('id',obligation.id).select('id'))
 assert.equal((await one(office.db.from('admin_operational_obligations').select('approved_by,status').eq('id',obligation.id))).approved_by,admin.user.id);pass('Case workflow requires independent Admin approval and preserves approval identity')
 await one(office.db.from('admin_financial_payments').insert({document_id:invoice.id,amount:5,paid_on:today,bank_reference:prefix}).select('id'))
 const credit=await document('credit_note',15,invoice.id)
 await one(admin.db.from('admin_financial_documents').update({status:'approved',approved_by:admin.user.id,approved_at:new Date().toISOString()}).eq('id',credit.id).select('id'))
 const balances=await rpc(office.db,'upt_administration_document_balances',{p_ids:[invoice.id]});assert.equal(balances[0].paid_cents,'500');assert.equal(balances[0].credited_cents,'1500');assert.equal(balances[0].outstanding_cents,'0')
 await one(admin.db.from('admin_financial_documents').update({status:'paid'}).eq('id',invoice.id).select('id'))
 assert.ok((await admin.db.from('admin_financial_documents').update({status:'void'}).eq('id',invoice.id).select('id')).error);pass('Partial payment plus approved credit settles exactly; paid invoice cannot be voided')
 const booking=await one(office.db.from('admin_artist_bookings').insert({event_id:f.eventId,artist_name:prefix,agency_contact_id:cp.id,performance_at:new Date(Date.now()+86400000).toISOString(),fee_amount:100,currency:'EUR',status:'enquiry'}).select('id'));created.bookingIds.push(booking.id)
 await one(office.db.from('admin_artist_bookings').update({status:'negotiating'}).eq('id',booking.id).select('id'))
 assert.ok((await office.db.from('admin_artist_bookings').update({status:'confirmed'}).eq('id',booking.id).select('id')).error)
 await one(admin.db.from('admin_artist_bookings').update({status:'confirmed'}).eq('id',booking.id).select('id'))
 assert.equal((await staff.db.from('admin_artist_bookings').select('id').eq('id',booking.id)).data.length,0);pass('Booking confirmation is Admin-only and hidden from ordinary staff')
 const noPayroll=await staff.db.rpc('upt_administration_payroll_rows',{p_event:f.eventId});assert.ok(noPayroll.error)
 const payroll=await rpc(office.db,'upt_administration_payroll_rows',{p_event:f.eventId});assert.ok(Array.isArray(payroll));pass('Payroll RPC denies staff and returns a complete authenticated snapshot')
}catch(e){failure=e;console.error('FAIL:',e.message)}finally{await mkdir('test-results/administration-rpc',{recursive:true});await writeFile('test-results/administration-rpc/manifest.json',JSON.stringify(created,null,2));await writeFile('test-results/administration-rpc/result.json',JSON.stringify({checks,failed:failure?.message??null},null,2))}
if(failure)throw failure
