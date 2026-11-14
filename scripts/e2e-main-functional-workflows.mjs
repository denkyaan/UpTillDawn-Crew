// Isolated Main functional E2E: real Auth/RLS, DB state transitions and UI reads.
// This creates only uniquely prefixed QA records and always cleans them up.
// Never execute against production, send external mail/payments or create Auth users.
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {createClient} from '@supabase/supabase-js'
import {chromium} from 'playwright'

const MAIN='https://uptilldawn-main.uptilldawn.workers.dev'
const MAIN_DB='https://npbjrtiolqperdgljnhi.supabase.co'
const MAIN_KEY='sb_publishable_zStTw3n8wZ271PehDRDvGg_rs0JOy84'
const base=process.env.E2E_MAIN_QA_BASE_URL
const target=process.env.E2E_MAIN_QA_SUPABASE_URL
const publishable=process.env.E2E_MAIN_QA_PUBLISHABLE_KEY
const secret=process.env.E2E_MAIN_QA_SERVICE_KEY
const password=process.env.E2E_MAIN_QA_PASSWORD
if(base!==MAIN||target!==MAIN_DB||publishable!==MAIN_KEY
 ||process.env.E2E_MAIN_QA_ALLOW_WRITE!=='1'||!secret||!password||password.length<24)
 throw Error('Main-only functional QA requires exact separate Main origins, explicit opt-in and private credentials')
const prefix='UPT-QA-FUNCTION-'+randomUUID().slice(0,8)
const reportDir='test-results/main-functional'
await mkdir(reportDir,{recursive:true})
const checks=[]
const created={event:null,booking:null,timesheet:null,staff:null,office:null}
let browser
let failed=null
const service=createClient(MAIN_DB,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
const tick=name=>{checks.push(name);console.log('PASS functional '+name)}
const one=async q=>{
 const {data,error}=await q.single()
 if(error)throw Error('Main QA database operation failed: '+error.code+' '+error.message)
 return data
}
const scalar=async q=>{
 const {data,error}=await q
 if(error)throw Error('Main QA RPC failed: '+error.code+' '+error.message)
 assert.match(String(data),/^[0-9a-f-]{36}$/i,'Expected a UUID from workflow RPC')
 return data
}
const actor=async(email)=>{
 const db=createClient(MAIN_DB,MAIN_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
 const {data,error}=await db.auth.signInWithPassword({email,password})
 if(error||data.user?.email?.toLowerCase()!==email||!data.session)
  throw Error('Main QA bot login failed for '+email.split('@')[0])
 return {db,id:data.user.id,email}
}
async function denyWrite(request,label){
 const {data,error}=await request
 assert.ok(error||data==null||Array.isArray(data)&&!data.length,'Unauthorized mutation succeeded: '+label)
 tick('denied: '+label)
}
async function remove(table,field,id,extra){
 if(!id)return
 let q=service.from(table).delete().eq(field,id)
 if(extra)q=q.eq(extra.field,extra.value)
 const {error}=await q
 if(error)throw Error('QA cleanup '+table+': '+error.code+' '+error.message)
}
async function clean(){
 if(!created.event)return
 // A safe cleanup may only touch the exact event created by this run.
 const {data:existing,error}=await service.from('events').select('id,name,created_by')
  .eq('id',created.event).maybeSingle()
 if(error)throw Error('QA cleanup cannot authenticate event ownership')
 if(!existing)return
 if(!existing.name?.startsWith(prefix)||existing.created_by!==created.office)
  throw Error('QA cleanup refused: fixture event ownership changed')
 await remove('admin_artist_bookings','id',created.booking,{field:'event_id',value:created.event})
 await remove('timesheets','id',created.timesheet,{field:'event_id',value:created.event})
 await remove('event_availability','event_id',created.event,{field:'user_id',value:created.staff})
 await remove('event_members','event_id',created.event,{field:'user_id',value:created.staff})
 await remove('events','id',created.event,{field:'created_by',value:created.office})
 const {data:residual,error:verifyError}=await service.from('events').select('id').eq('id',created.event)
 if(verifyError||residual?.length)throw Error('QA event still exists after cleanup')
 tick('all Main fixture records deleted and verified')
}
async function checkBrowser(office){
 browser=await chromium.launch({headless:true})
 const context=await browser.newContext({locale:'nl',viewport:{width:1280,height:800}})
 const page=await context.newPage()
 try{
  await page.goto(MAIN+'/login/administration',{waitUntil:'commit',timeout:45000})
  await page.locator('form[data-login-hydrated="true"]').waitFor({state:'attached',timeout:45000})
  await page.locator('#email').fill(office.email)
  await page.locator('#password').fill(password)
  await Promise.all([
   page.waitForURL(url=>!url.pathname.startsWith('/login'),{waitUntil:'commit',timeout:45000}),
   page.locator('button[type="submit"]').click(),
  ])
  for(const [path,needle] of [
   ['/portals/administration/modules/events',prefix+' Edited event'],
   ['/portals/administration/modules/contracts',prefix+' Artist'],
  ]){
   const response=await page.goto(MAIN+path,{waitUntil:'commit',timeout:45000})
   assert.ok(response&&response.status()<400,'Main authenticated route HTTP failure '+path)
   await page.locator('main h1').last().waitFor({state:'visible',timeout:35000})
   await page.getByText(needle,{exact:false}).first().waitFor({state:'visible',timeout:35000})
   assert.equal(new URL(page.url()).pathname,path,'Main UI left its administrative workflow')
   tick('rendered saved record '+path)
  }
  // Finance retains immutable, FK-protected audit events. Never create/delete
  // financial documents in the shared Main QA project just to pass a test.
  // Full draft/review/approval mutation is tested in disposable DB E2E.
  const financePath='/portals/administration/modules/invoices'
  const financeResponse=await page.goto(MAIN+financePath,{waitUntil:'commit',timeout:45000})
  assert.ok(financeResponse&&financeResponse.status()<400,'Finance register HTTP error')
  await page.locator('main h1').last().waitFor({state:'visible',timeout:35000})
  assert.equal(new URL(page.url()).pathname,financePath,'Finance register changed portal')
  tick('Finance register rendered without creating audited invoices')
 }finally{await context.close()}
}

try{
 const [head,office,staff,promotion]=await Promise.all([
  actor('e2e-head-admin@uptilldawn.test'),
  actor('e2e-administration@uptilldawn.test'),
  actor('e2e-staff@uptilldawn.test'),
  actor('e2e-promotion@uptilldawn.test'),
 ])
 created.office=office.id;created.staff=staff.id
 const start=new Date(Date.now()+3*86400000).toISOString()
 const end=new Date(Date.now()+4*86400000).toISOString()
 const args={p_event_id:null,p_name:prefix+' Draft event',p_venue:'QA only',p_start_at:start,p_end_at:end}
 await denyWrite(staff.db.rpc('upt_administration_save_event_draft',args),'Staff cannot create Administration event')
 await denyWrite(promotion.db.rpc('upt_administration_save_event_draft',args),'Promotion cannot create Administration event')
 const draft=await scalar(office.db.rpc('upt_administration_save_event_draft',args))
 assert.match(draft,/^[0-9a-f-]{36}$/i)
 created.event=draft
 const event=await one(office.db.from('events').select('id,name,status,created_by').eq('id',draft))
 assert.equal(event.status,'draft')
 assert.equal(event.created_by,office.id)
 tick('Administration creates and persists an unpublished event draft')
 const updated=await scalar(office.db.rpc('upt_administration_save_event_draft',
  {...args,p_event_id:draft,p_name:prefix+' Edited event'}))
 assert.equal(updated,draft)
 assert.equal((await one(office.db.from('events').select('name').eq('id',draft))).name,prefix+' Edited event')
 tick('Administration edits its existing draft without publishing it')

 const member=await one(head.db.from('event_members').insert({
  event_id:draft,user_id:staff.id,event_role:'employee'
 }).select('id'))
 assert.ok(member.id)
 tick('Head Admin assigns crew membership to the QA event')
 const available=await one(staff.db.from('event_availability').insert({
  event_id:draft,user_id:staff.id,response:'can'
 }).select('response'))
 assert.equal(available.response,'can')
 await denyWrite(promotion.db.from('event_availability').insert({
  event_id:draft,user_id:staff.id,response:'can'
 }).select('event_id'),'Promotion cannot forge Staff availability')
 tick('Staff availability persists under its own user identity')

 const submitted=await scalar(staff.db.rpc('upt_submit_timesheet',{p_event:draft}))
 created.timesheet=submitted
 const ts=await one(head.db.from('timesheets').select('status,user_id,event_id').eq('id',submitted))
 assert.equal(ts.status,'submitted');assert.equal(ts.user_id,staff.id)
 tick('Staff submits a real event timesheet and Admin reads it')
 await denyWrite(office.db.rpc('upt_review_timesheet',{
  p_timesheet:submitted,p_approve:true,p_reason:null
 }),'Administration cannot approve Staff timesheet')
 const invalid=await head.db.rpc('upt_review_timesheet',{
  p_timesheet:submitted,p_approve:false,p_reason:null
 })
 assert.ok(invalid.error,'Rejection without reason was accepted')
 tick('Timesheet rejection reason is mandatory')
 const reviewed=await head.db.rpc('upt_review_timesheet',{
  p_timesheet:submitted,p_approve:false,p_reason:'QA test: correction required'
 })
 assert.ifError(reviewed.error)
 assert.equal((await one(staff.db.from('timesheets').select('status').eq('id',submitted))).status,'rejected')
 const resubmitted=await scalar(staff.db.rpc('upt_submit_timesheet',{p_event:draft}))
 assert.equal(resubmitted,submitted)
 const approved=await head.db.rpc('upt_review_timesheet',{
  p_timesheet:submitted,p_approve:true,p_reason:null
 })
 assert.ifError(approved.error)
 assert.equal((await one(head.db.from('timesheets').select('status').eq('id',submitted))).status,'approved')
 const locked=await head.db.rpc('upt_lock_timesheet',{p_timesheet:submitted})
 assert.ifError(locked.error)
 assert.equal((await one(head.db.from('timesheets').select('status').eq('id',submitted))).status,'locked')
 await denyWrite(staff.db.rpc('upt_submit_timesheet',{p_event:draft}),
  'Staff cannot resubmit a locked timesheet')
 tick('Timesheet rejected, resubmitted, approved and locked with real persisted states')

 await denyWrite(staff.db.from('admin_artist_bookings').insert({
  event_id:draft,artist_name:prefix+' Invalid artist',status:'enquiry'
 }).select('id'),'Staff cannot create DJ booking')
 const booking=await one(office.db.from('admin_artist_bookings').insert({
  event_id:draft,artist_name:prefix+' Artist',status:'enquiry',fee_amount:120,
  agreement_payment_terms:'QA draft - no external delivery'
 }).select('id,status,created_by'))
 created.booking=booking.id
 assert.equal(booking.status,'enquiry');assert.equal(booking.created_by,office.id)
 tick('Administration persists a DJ booking and contract draft')

 // Main's invoice audit is immutable and uses ON DELETE RESTRICT.
 // Attempt only a forbidden Staff insert (must not create any audit row).
 // Positive invoice draft/review/approval belongs to a disposable DB E2E:
 // a live shared Main invoice would be legally/auditably retained, not cleaned.
 await denyWrite(staff.db.from('admin_financial_documents').insert({
  event_id:draft,kind:'sales_invoice',document_number:prefix+'-INVALID'
 }).select('id'),'Staff cannot create invoices')
 tick('Main invoice RLS remains protected without creating irreversible audit fixtures')

 await checkBrowser(office)
} catch(error){
 failed=String(error?.message||error).split(secret).join('[redacted]').split(password).join('[redacted]').slice(0,450)
 console.error('FAIL Main functional workflow: '+failed)
} finally{
 try{if(browser)await browser.close()}catch{}
 try{await clean()}catch(error){
  failed=(failed?failed+' | ':'')+'cleanup: '+String(error?.message||error).slice(0,400)
  console.error('FAIL Main functional QA cleanup: '+String(error?.message||error).slice(0,350))
 }
 await writeFile(reportDir+'/report.json',JSON.stringify({
  target:MAIN,scope:'Isolated Main only; real Auth, RLS, Administration event drafts, crew availability, timesheet lifecycle and DJ bookings; finance authorization and read-only UI',
  completedChecks:checks,passed:checks.length,failed:Boolean(failed),failure:failed,
  fixtureCleaned:checks.includes('all Main fixture records deleted and verified'),
  excluded:'No Maker, production, provider API calls, payments, mutable invoice draft/review/approval (immutable audit must be exercised in disposable DB), contractual signing or emails.'
 },null,2)+'\n')
 console.log('QA MAIN FUNCTIONAL RESULT: '+JSON.stringify({passed:checks.length,failed:Boolean(failed),cleaned:checks.includes('all Main fixture records deleted and verified')}))
}
if(failed)process.exitCode=1
