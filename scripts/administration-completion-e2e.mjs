import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {chromium} from 'playwright'

const base=process.env.BOT_TEST_BASE_URL||'http://localhost:3000'
const url=process.env.BOT_SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const fixture=process.env.UPT_QA_FIXTURE_PATH?JSON.parse(await readFile(process.env.UPT_QA_FIXTURE_PATH,'utf8')):null
const password=fixture?.password||process.env.BOT_TEST_PASSWORD
if(!url||!key||!password)throw Error('Missing isolated test credentials')
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Completion browser tests require a local application')
if(!['localhost','127.0.0.1','npbjrtiolqperdgljnhi.supabase.co'].includes(new URL(url).hostname))throw Error('Production database is forbidden')
const prefix='QA-COMPLETE-'+randomUUID().slice(0,8)
const checks=[],created={prefix,eventId:fixture?.eventId??null,documentIds:[],counterpartyIds:[],itemIds:[],workplaceIds:[],obligationIds:[],bookingIds:[]}
const known={admin:'bot-01-admin-nl@bots.uptilldawn.test',administration:'bot-04-staff-de@bots.uptilldawn.test',staff:'bot-03-staff-en@bots.uptilldawn.test',promotion:'bot-05-staff-nl@bots.uptilldawn.test'}
async function client(role){
 const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
 const email=fixture?.users.find(u=>u.role===role)?.email||known[role]
 const {data,error}=await c.auth.signInWithPassword({email,password})
 if(error||!data.session)throw Error(role+' authentication failed: '+error?.message)
 return {db:c,session:data.session,user:data.user}
}
const [admin,office,staff,promo]=await Promise.all(['admin','administration','staff','promotion'].map(client))
const ok=(name)=>{checks.push(name);console.log('PASS:',name)}
const one=async(query)=>{const {data,error}=await query.single();if(error)throw Error(error.message);return data}
async function browserContext(browser,account,locale='en'){
 const context=await browser.newContext({viewport:{width:390,height:844},locale,acceptDownloads:true})
 const response=await context.request.post(base+'/api/test-auth-session',{data:{access_token:account.session.access_token,refresh_token:account.session.refresh_token}})
 assert.equal(response.status(),200,'authenticated session bridge')
 return context
}
let lastAction
async function clickAndSettle(page,button){
 const path=new URL(page.url()).pathname
 const form=button.locator('xpath=ancestor::form[1]')
 const fields=await form.evaluate(form=>Object.fromEntries([...new FormData(form)].filter(([name])=>!name.startsWith('$ACTION_'))))
 const response=page.waitForResponse(r=>{
  const request=r.request(),target=new URL(r.url())
  return request.method()==='POST'&&target.origin===new URL(base).origin&&target.pathname===path
   &&(request.isNavigationRequest()||Boolean(request.headers()['next-action']))
 },{timeout:45000})
 await button.click()
 const result=await response
 lastAction={path,fields,status:result.status(),redirect:result.headers()['x-action-redirect']??result.headers()['location']??null}
 assert.equal(await result.finished(),null,'server action response did not finish')
 assert.ok(result.status()<400,'server action returned '+result.status())
 assert.ok(!lastAction.redirect?.includes('error=1'),'server action rejected the form: '+JSON.stringify(lastAction))
}
async function assertState(db,id,status){const row=await one(db.from('admin_financial_documents').select('status').eq('id',id));assert.equal(row.status,status)}
await mkdir('test-results/administration-completion',{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined})
let failure
try{
 if(!created.eventId){const event=await one(admin.db.from('events').insert({name:prefix,start_at:new Date(Date.now()+86400000).toISOString(),end_at:new Date(Date.now()+172800000).toISOString(),start_date:new Date(Date.now()+86400000).toISOString(),end_date:new Date(Date.now()+172800000).toISOString(),status:'scheduled',created_by:admin.user.id,onboarding_required:false}).select('id'));created.eventId=event.id}
 const officeContext=await browserContext(browser,office),adminContext=await browserContext(browser,admin),staffContext=await browserContext(browser,staff)
 const page=await officeContext.newPage(),adminPage=await adminContext.newPage()
 let response=await page.goto(base+'/portals/administration/finance',{waitUntil:'networkidle'})
 assert.equal(response.status(),200)
 assert.equal(new URL(page.url()).pathname,'/portals/administration/finance')
 const counterpartyForm=page.locator('form').filter({has:page.locator('input[name="name"]')}).first()
 await counterpartyForm.locator('input[name="name"]').fill(prefix+' Supplier')
 await counterpartyForm.locator('select[name="kind"]').selectOption('both')
 await counterpartyForm.locator('input[name="email"]').fill('sales@artist.agency')
 await counterpartyForm.locator('input[name="iban"]').fill('BE68 5390 0754 7034')
 await clickAndSettle(page,counterpartyForm.getByRole('button'))
 const party=await one(office.db.from('admin_counterparties').select('id,iban,email').eq('name',prefix+' Supplier'))
 created.counterpartyIds.push(party.id);assert.equal(party.iban,'BE68539007547034');assert.equal(party.email,'sales@artist.agency');ok('Counterparty UI persists a valid email and normalizes a spaced IBAN')
 const draft=page.locator('form').filter({has:page.locator('input[name="net_amount"]')})
 await draft.locator('select[name="kind"]').selectOption('purchase_invoice')
 await draft.locator('input[name="document_number"]').fill(prefix+'-BUY')
 await draft.locator('select[name="counterparty_id"]').selectOption(party.id)
 await draft.locator('select[name="event_id"]').selectOption(created.eventId)
 await draft.locator('input[name="net_amount"]').fill('0');await draft.locator('input[name="tax_amount"]').fill('0')
 const today=new Date().toISOString().slice(0,10)
 await draft.locator('input[name="issue_date"]').fill(today);await draft.locator('input[name="due_date"]').fill(today)
 await clickAndSettle(page,draft.getByRole('button'))
 const document=await one(office.db.from('admin_financial_documents').select('id,event_id,status').eq('document_number',prefix+'-BUY'))
 created.documentIds.push(document.id);assert.equal(document.event_id,created.eventId)
 const lineForm=page.locator('form').filter({has:page.locator(`input[name="document_id"][value="${document.id}"]`)}).filter({has:page.locator('input[name="description"]')}).filter({has:page.locator('input[name="quantity"]')}).last()
 await lineForm.locator('input[name="description"]').fill(prefix+' Equipment')
 await lineForm.locator('input[name="quantity"]').fill('2');await lineForm.locator('input[name="unit_price"]').fill('10');await lineForm.locator('input[name="vat_rate"]').fill('0')
 await clickAndSettle(page,lineForm.getByRole('button'))
 const line=await one(office.db.from('admin_financial_lines').select('id,quantity').eq('document_id',document.id))
 const review=page.locator(`form:has(input[name="document_id"][value="${document.id}"]):has(input[name="status"][value="review"])`)
 await clickAndSettle(page,review.getByRole('button'));await assertState(office.db,document.id,'review');ok('Purchase invoice UI creates dated event-linked draft, line and review submission')
 const forged=await office.db.from('admin_financial_documents').update({status:'approved',approved_by:office.user.id,approved_at:new Date().toISOString()}).eq('id',document.id).select('id')
 assert.ok(forged.error||!forged.data?.length);await assertState(admin.db,document.id,'review');ok('Administrative employee cannot approve their invoice through direct API')
 await adminPage.goto(base+'/portals/administration/finance',{waitUntil:'networkidle'})
 const approve=adminPage.locator(`form:has(input[name="document_id"][value="${document.id}"]):has(input[name="status"][value="approved"])`)
 await clickAndSettle(adminPage,approve.getByRole('button'));await assertState(admin.db,document.id,'approved');ok('Admin approval persists through the actual invoice UI')
 const workplace=await one(admin.db.from('workplaces').insert({event_id:created.eventId,name:prefix,sort_order:1,is_active:true}).select('id'));created.workplaceIds.push(workplace.id)
 const itemResult=await admin.db.rpc('upt_create_inventory_item',{p_workplace:workplace.id,p_name:prefix+' Equipment',p_category:'test',p_quantity:1,p_item_kind:'asset'})
 if(itemResult.error)throw itemResult.error
 const item=await one(admin.db.from('inventory_items').select('id,total_quantity').eq('workplace_id',workplace.id).eq('name',prefix+' Equipment'));created.itemIds.push(item.id)
 await adminPage.goto(base+'/portals/administration/modules/inventory',{waitUntil:'networkidle'})
 const receiptForm=adminPage.locator(`form:has(input[name="line"][value="${line.id}"])`)
 await receiptForm.locator('xpath=ancestor::details[1]').evaluate(e=>{e.open=true})
 const receiptRequest=await receiptForm.locator('input[name="request"]').inputValue()
 await receiptForm.locator('select[name="item"]').selectOption(item.id);await receiptForm.locator('input[name="quantity"]').fill('2')
 await clickAndSettle(adminPage,receiptForm.getByRole('button'))
 const stock=await one(admin.db.from('inventory_items').select('total_quantity').eq('id',item.id));assert.equal(stock.total_quantity,3)
 const replay=await admin.db.rpc('upt_receive_invoice_inventory',{p_request:receiptRequest,p_line:line.id,p_item:item.id,p_quantity:2});assert.equal(replay.error,null);assert.equal(replay.data,false)
 const extra=await admin.db.rpc('upt_receive_invoice_inventory',{p_request:randomUUID(),p_line:line.id,p_item:item.id,p_quantity:1});assert.ok(extra.error)
 const denied=await office.db.rpc('upt_receive_invoice_inventory',{p_request:randomUUID(),p_line:line.id,p_item:item.id,p_quantity:1});assert.ok(denied.error)
 assert.equal((await one(admin.db.from('inventory_items').select('total_quantity').eq('id',item.id))).total_quantity,3)
 ok('Inventory UI receives approved purchases; replay, over-receipt and employee writes cannot inflate stock')
 await page.goto(base+'/portals/administration/modules/ticketing',{waitUntil:'networkidle'})
 const importer=page.getByRole('region',{name:'Import ticket sales'})
 await importer.locator('select').selectOption(created.eventId)
 const external=prefix+'-SALE'
 const header='external_id,event_id,quantity,gross_amount,currency,sold_at\n'
 const csv=header+`${external},${created.eventId},2,30.00,EUR,2026-10-30T00:30:00+02:00\n`
 await importer.locator('input[type="file"]').setInputFiles({name:'sales.csv',mimeType:'text/csv',buffer:Buffer.from(csv)})
 await importer.getByRole('button',{name:'Save sales',exact:true}).click();await importer.getByRole('status').filter({hasText:'Saved: 1'}).waitFor({timeout:30000})
 assert.equal((await one(office.db.from('admin_ticket_sales').select('quantity,gross_cents').eq('event_id',created.eventId).eq('external_id',external))).gross_cents,3000)
 await importer.getByRole('button',{name:'Save sales',exact:true}).click();await importer.getByRole('status').filter({hasText:'Duplicates skipped: 1'}).waitFor({timeout:30000})
 ok('Ticket CSV UI saves sales and replays an identical file without duplicating revenue')
 const conflictCsv=header+`${prefix}-NEW,${created.eventId},1,5.00,EUR,2026-10-30T12:00:00Z\n`+`${external},${created.eventId},2,99.00,EUR,2026-10-30T00:30:00+02:00\n`
 const conflict=await officeContext.request.post(base+'/api/administration/ticketing/import',{headers:{origin:base},multipart:{eventId:created.eventId,source:'ticketplatform',file:{name:'conflict.csv',mimeType:'text/csv',buffer:Buffer.from(conflictCsv)}}})
 assert.equal(conflict.status(),409)
 const absent=await office.db.from('admin_ticket_sales').select('id').eq('external_id',prefix+'-NEW');assert.equal(absent.data.length,0)
 const noAccess=await staffContext.request.post(base+'/api/administration/ticketing/import',{headers:{origin:base},multipart:{eventId:created.eventId,source:'ticketplatform',file:{name:'sales.csv',mimeType:'text/csv',buffer:Buffer.from(csv)}}});assert.equal(noAccess.status(),403)
 const crossOrigin=await officeContext.request.post(base+'/api/administration/ticketing/import',{headers:{origin:'https://invalid.example'},multipart:{eventId:created.eventId,source:'ticketplatform',file:{name:'sales.csv',mimeType:'text/csv',buffer:Buffer.from(csv)}}});assert.equal(crossOrigin.status(),403)
 ok('Conflicting ticket batch rolls back all rows; staff and foreign origins are denied')
 await page.goto(base+'/portals/administration/modules/permits',{waitUntil:'networkidle'})
 const caseForm=page.locator('form').filter({has:page.locator('input[name="title"]')}).first()
 await caseForm.locator('input[name="title"]').fill(prefix+' Permit')
 await caseForm.locator('input[name="deadline"]').fill(new Date(Date.now()+86400000*7).toISOString().slice(0,10))
 await caseForm.locator('select[name="event"]').selectOption(created.eventId)
 await clickAndSettle(page,caseForm.getByRole('button'))
 const obligation=await one(office.db.from('admin_operational_obligations').select('id').eq('title',prefix+' Permit'));created.obligationIds.push(obligation.id)
 let submit=page.locator(`form:has(input[name="id"][value="${obligation.id}"]):has(button[value="submitted"])`)
 await clickAndSettle(page,submit.locator('button[value="submitted"]'))
 const selfApprove=await office.db.from('admin_operational_obligations').update({status:'approved'}).eq('id',obligation.id).select('id');assert.ok(selfApprove.error||!selfApprove.data?.length)
 await adminPage.goto(base+'/portals/administration/modules/permits',{waitUntil:'networkidle'})
 const caseReview=adminPage.locator(`form:has(input[name="id"][value="${obligation.id}"]):has(button[value="approved"])`)
 await clickAndSettle(adminPage,caseReview.locator('button[value="approved"]'))
 await page.reload({waitUntil:'networkidle'})
 const complete=page.locator(`form:has(input[name="id"][value="${obligation.id}"]):has(button[value="completed"])`)
 await clickAndSettle(page,complete.locator('button[value="completed"]'))
 assert.equal((await one(office.db.from('admin_operational_obligations').select('status').eq('id',obligation.id))).status,'completed')
 ok('Permit case UI submits, requires Admin approval and persists employee completion')
 const forbiddenPayroll=await staffContext.request.get(base+'/api/administration/payroll/export?event='+created.eventId);assert.equal(forbiddenPayroll.status(),403)
 ok('Payroll export denies ordinary staff')
 const promoContext=await browserContext(browser,promo)
 const promotionPage=await promoContext.newPage();response=await promotionPage.goto(base+'/portals/promotion',{waitUntil:'networkidle'});assert.equal(response.status(),200);assert.ok(!new URL(promotionPage.url()).pathname.startsWith('/login'))
 for(const locale of ['nl','fr','en','de']){
  const context=await browserContext(browser,office,locale),tab=await context.newPage()
  for(const path of ['/portals/administration','/portals/administration/modules/ticketing','/portals/administration/modules/banking','/portals/administration/modules/inventory','/portals/administration/modules/permits','/portals/administration/modules/automations']){
   const errors=[];tab.on('pageerror',e=>errors.push(e.message));const r=await tab.goto(base+path,{waitUntil:'domcontentloaded'});assert.ok(r.status()<400,path+' HTTP '+r.status());assert.equal(errors.length,0);const body=await tab.locator('body').innerText();assert.ok(!/application error|internal server error|404\s*\|/i.test(body));assert.ok(!new URL(tab.url()).pathname.startsWith('/login'))
  }
  await context.close()
 }
 ok('Promotion opens and Administration routes render in all four locales at mobile width')
}catch(e){
 failure=e;console.error('FAIL:',e.message)
 console.error('Last submitted form:',JSON.stringify(lastAction??null))
 const pages=browser.contexts().flatMap(context=>context.pages()).slice(0,4)
 for(const [index,page] of pages.entries()){
  console.error('Failure page:',page.url(),await page.getByRole('alert').allTextContents().catch(()=>[]))
  await page.screenshot({path:`test-results/administration-completion/failure-${index}.png`,fullPage:true}).catch(()=>{})
 }
}
finally{
 await browser.close()
 await writeFile('test-results/administration-completion/manifest.json',JSON.stringify(created,null,2))
 await writeFile('test-results/administration-completion/result.json',JSON.stringify({checks,passed:checks.length,failed:failure?failure.message:null,lastAction},null,2))
}
if(failure)throw failure
console.log('PASS:',checks.length,'verified administration workflow checks')
