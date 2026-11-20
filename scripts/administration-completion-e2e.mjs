import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {chromium} from 'playwright'
import {gotoReady,browserTimeoutMs,openInventoryReceiptForm} from './browser-navigation.mjs'
import {promotionTaskWorkflow} from './promotion-task-workflow-e2e.mjs'

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
 const context=await browser.newContext({viewport:{width:390,height:844},locale,acceptDownloads:true,ignoreHTTPSErrors:process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS==='1'})
 context.setDefaultTimeout(browserTimeoutMs)
 const response=await context.request.post(base+'/api/test-auth-session',{data:{access_token:account.session.access_token,refresh_token:account.session.refresh_token}})
 assert.equal(response.status(),200,'authenticated session bridge')
 return context
}
let lastAction
async function clickAndSettle(page,button){
 const path=new URL(page.url()).pathname
 const form=button.locator('xpath=ancestor::form[1]')
 const formHandle=await form.elementHandle()
 const fields=await form.evaluate(form=>Object.fromEntries([...new FormData(form)].filter(([name])=>!name.startsWith('$ACTION_'))))
 const response=page.waitForResponse(r=>{
  const request=r.request(),target=new URL(r.url())
  return request.method()==='POST'&&target.origin===new URL(base).origin&&target.pathname===path
   &&(request.isNavigationRequest()||Boolean(request.headers()['next-action']))
 },{timeout:Math.max(45000,browserTimeoutMs)})
 const [result]=await Promise.all([response,button.click()])
 lastAction={path,fields,status:result.status(),redirect:result.headers()['x-action-redirect']??result.headers()['location']??null}
 assert.ok(result.status()<400,'server action returned '+result.status())
 assert.ok(!lastAction.redirect?.includes('error=1'),'server action rejected the form: '+JSON.stringify(lastAction))
 // RSC action responses can stay streamed after the UI commit. Wait for the
 // actual form reset or transition, rather than the document's old networkidle.
 const resetField=['name','document_number','description','title'].find(name=>fields[name])
 if(resetField){
  await page.waitForFunction(({form,name})=>!form.isConnected||!form.getClientRects().length||form.querySelector(`input[name="${name}"]`)?.value==='',{form:formHandle,name:resetField},{timeout:browserTimeoutMs})
 }else if(fields.request){
  await page.locator(`form:visible input[name="request"][value="${fields.request}"]`).waitFor({state:'detached',timeout:browserTimeoutMs})
 }else{
  await button.waitFor({state:'detached',timeout:browserTimeoutMs})
 }
}
async function assertState(db,id,status){const row=await one(db.from('admin_financial_documents').select('status').eq('id',id));assert.equal(row.status,status)}
await mkdir('test-results/administration-completion',{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined})
let failure
try{
 if(!created.eventId){const event=await one(admin.db.from('events').insert({name:prefix,start_at:new Date(Date.now()+86400000).toISOString(),end_at:new Date(Date.now()+172800000).toISOString(),start_date:new Date(Date.now()+86400000).toISOString(),end_date:new Date(Date.now()+172800000).toISOString(),status:'scheduled',created_by:admin.user.id,onboarding_required:false}).select('id'));created.eventId=event.id}
 const [officeContext,adminContext,staffContext]=await Promise.all([browserContext(browser,office),browserContext(browser,admin),browserContext(browser,staff)])
 const page=await officeContext.newPage(),adminPage=await adminContext.newPage()
 let response=await gotoReady(page,base+'/portals/administration/finance')
 assert.equal(response.status(),200)
 assert.equal(new URL(page.url()).pathname,'/portals/administration/finance')
 const counterpartyForm=page.locator('form:visible').filter({has:page.locator('input[name="name"]')}).first()
 await counterpartyForm.locator('input[name="name"]').fill(prefix+' Supplier')
 await counterpartyForm.locator('select[name="kind"]').selectOption('both')
 await counterpartyForm.locator('input[name="email"]').fill('sales@artist.agency')
 await counterpartyForm.locator('input[name="iban"]').fill('BE68 5390 0754 7034')
 await clickAndSettle(page,counterpartyForm.getByRole('button'))
 const party=await one(office.db.from('admin_counterparties').select('id,iban,email').eq('name',prefix+' Supplier'))
 created.counterpartyIds.push(party.id);assert.equal(party.iban,'BE68539007547034');assert.equal(party.email,'sales@artist.agency');ok('Counterparty UI persists a valid email and normalizes a spaced IBAN')
 const draft=page.locator('form:visible').filter({has:page.locator('input[name="net_amount"]')})
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
 const attachmentBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z1WQAAAAASUVORK5CYII=','base64')
 const attachmentName=prefix+'-proof.png'
 const attachmentForm=page.locator(`form:visible:has(input[name="document_id"][value="${document.id}"]):has(input[name="file"])`)
 await attachmentForm.locator('input[name="file"]').setInputFiles({name:attachmentName,mimeType:'image/png',buffer:attachmentBytes})
 const [attachmentResponse]=await Promise.all([
  page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/portals/administration/finance',{timeout:browserTimeoutMs}),
  attachmentForm.getByRole('button',{name:'Attach document',exact:true}).click(),
 ])
 assert.ok(attachmentResponse.status()<400,'Attachment upload action must succeed')
 assert.ok(!attachmentResponse.headers()['x-action-redirect']?.includes('error=1'),'Attachment upload action must persist metadata')
 const attachment=await one(office.db.from('admin_financial_attachments').select('id,original_name,storage_path').eq('document_id',document.id))
 assert.equal(attachment.original_name,attachmentName)
 const downloadPath='/api/administration/finance/attachments/'+attachment.id
 const {data:pendingScan,error:pendingScanError}=await office.db.from('upload_security_scans')
  .select('storage_path,status').eq('bucket_id','admin-financial-attachments').eq('storage_path',attachment.storage_path).maybeSingle()
 assert.equal(pendingScanError,null,'Authorized Administration can inspect the private scan status')
 assert.equal(pendingScan?.status,'pending','New finance originals must be quarantined, never automatically trusted')
 await gotoReady(page,base+'/portals/administration/finance')
 assert.equal(await page.getByRole('link',{name:attachmentName,exact:true}).count(),0,'Pending uploads must not expose a download link')
 assert.equal((await officeContext.request.get(base+downloadPath)).status(),423,'Pending uploads cannot be signed by the attachment API')
 assert.equal((await staffContext.request.get(base+downloadPath)).status(),403,'Ordinary staff cannot read quarantined attachments')
 // A synthetic verdict is allowed ONLY in the disposable local CI stack.
 // This does not exercise or claim a real malware scan; production must keep
 // its trusted scanner and fail-closed quarantine before offering downloads.
 const localHost=new URL(url).hostname
 const localDatabase=new URL(process.env.BOT_DB_URL||'postgresql://invalid.invalid/postgres')
 if(process.env.UPT_E2E_ALLOW_SYNTHETIC_SCAN!=='1'||
    !['localhost','127.0.0.1'].includes(localHost)||
    localDatabase.hostname!=='127.0.0.1'||localDatabase.port!=='54322'||
    localDatabase.pathname!=='/postgres'||!process.env.BOT_SERVICE_ROLE_KEY)
  throw Error('Synthetic finance scan verdict requires an explicitly enabled, disposable local CI database')
 const scannerFixture=createClient(url,process.env.BOT_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
 const now=new Date().toISOString()
 const {data:syntheticVerdict,error:syntheticError}=await scannerFixture.from('upload_security_scans')
  .update({status:'clean',engine:'isolated-ci-synthetic',engine_result:{successful:true,clean:true,synthetic:true},scanned_at:now,updated_at:now})
  .eq('bucket_id','admin-financial-attachments').eq('storage_path',attachment.storage_path).eq('status','pending')
  .select('id').maybeSingle()
 assert.equal(syntheticError,null,'Synthetic verdict must be written to isolated CI storage only')
 assert.ok(syntheticVerdict,'Exactly one pending test attachment must be transitioned after the quarantine assertions')
 await gotoReady(page,base+'/portals/administration/finance')
 const attachmentLink=page.getByRole('link',{name:attachmentName,exact:true})
 await attachmentLink.waitFor({state:'visible',timeout:browserTimeoutMs})
 assert.equal(await attachmentLink.getAttribute('href'),downloadPath)
 const [download]=await Promise.all([page.waitForEvent('download',{timeout:browserTimeoutMs}),attachmentLink.click()])
 assert.equal(download.suggestedFilename(),attachmentName)
 const downloadStream=await download.createReadStream(),chunks=[]
 for await(const chunk of downloadStream)chunks.push(chunk)
 assert.deepEqual(Buffer.concat(chunks),attachmentBytes,'Private attachment downloads preserve the uploaded bytes')
 assert.equal((await staffContext.request.get(base+'/api/administration/finance/attachments/'+attachment.id)).status(),403)
 assert.equal((await officeContext.request.get(base+'/api/administration/finance/attachments/'+randomUUID())).status(),404)
 ok('Financial attachment UI uploads, persists and downloads exact private bytes while denying staff')
 const lineForm=page.locator('form:visible').filter({has:page.locator(`input[name="document_id"][value="${document.id}"]`)}).filter({has:page.locator('input[name="description"]')}).filter({has:page.locator('input[name="quantity"]')}).last()
 await lineForm.locator('input[name="description"]').fill(prefix+' Equipment')
 await lineForm.locator('input[name="quantity"]').fill('2');await lineForm.locator('input[name="unit_price"]').fill('10');await lineForm.locator('input[name="vat_rate"]').fill('0')
 await clickAndSettle(page,lineForm.getByRole('button'))
 const line=await one(office.db.from('admin_financial_lines').select('id,quantity').eq('document_id',document.id))
 const review=page.locator(`form:visible:has(input[name="document_id"][value="${document.id}"]):has(input[name="status"][value="review"])`)
 await clickAndSettle(page,review.getByRole('button'));await assertState(office.db,document.id,'review');ok('Purchase invoice UI creates dated event-linked draft, line and review submission')
 const forged=await office.db.from('admin_financial_documents').update({status:'approved',approved_by:office.user.id,approved_at:new Date().toISOString()}).eq('id',document.id).select('id')
 assert.ok(forged.error||!forged.data?.length);await assertState(admin.db,document.id,'review');ok('Administrative employee cannot approve their invoice through direct API')
 await gotoReady(adminPage,base+'/portals/administration/finance')
 const approve=adminPage.locator(`form:visible:has(input[name="document_id"][value="${document.id}"]):has(input[name="status"][value="approved"])`)
 await clickAndSettle(adminPage,approve.getByRole('button'));await assertState(admin.db,document.id,'approved');ok('Admin approval persists through the actual invoice UI')
 const workplace=await one(admin.db.from('workplaces').insert({event_id:created.eventId,name:'Ticket scan / Inkom',sort_order:1,is_active:true}).select('id'));created.workplaceIds.push(workplace.id)
 const bar=await one(admin.db.from('workplaces').insert({event_id:created.eventId,name:'Bar',sort_order:2,is_active:true}).select('id'));created.workplaceIds.push(bar.id)
 await gotoReady(adminPage,base+'/workplaces?event='+created.eventId)
 const scanner=adminPage.locator('#workplace-'+workplace.id+' [data-weeztix-scanner]')
 await scanner.getByRole('heading',{name:'Scan tickets',exact:true}).waitFor()
 assert.equal(await scanner.getByRole('button',{name:'Start camera',exact:true}).isVisible(),true)
 assert.equal(await scanner.getByRole('button',{name:'Verify ticket',exact:true}).isVisible(),true)
 assert.equal(await scanner.getByRole('link',{name:'Manage Weeztix',exact:true}).getAttribute('href'),'https://dashboard.weeztix.com')
 assert.equal(await adminPage.locator('#workplace-'+bar.id+' [data-weeztix-scanner]').count(),0,'Ticket scanner must not appear on a bar workplace')
 // Exercise the *integrated* barcode form and server endpoint, not the
 // retired external-scanner onboarding buttons. This isolated event has no
 // configured Weeztix provider: admission must fail closed and never be faked.
 await scanner.getByRole('textbox',{name:'Enter ticket barcode'}).fill('QAENTRANCE123456')
 const scanResponse=adminPage.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/weeztix/scan',{timeout:browserTimeoutMs})
 await scanner.getByRole('button',{name:'Verify ticket',exact:true}).click()
 const scanResult=await scanResponse
 assert.equal(scanResult.status(),503,'Unconfigured Weeztix scanning must not grant entrance')
 assert.equal((await scanResult.json()).code,'not_configured')
 await scanner.getByRole('status').filter({hasText:'Connect this event to Weeztix before in-app scanning.'}).waitFor()
 assert.equal(await scanner.getByText('TICKET ACCEPTED · ADMIT',{exact:true}).count(),0)
 // Provider apps remain available as explicitly labeled offline fallbacks,
 // not as the primary scanner inside UpTillDawn.
 await scanner.locator('summary').filter({hasText:'Official backup scanner'}).click()
 const backups={
  iPhone:'https://apps.apple.com/be/app/weeztix-ticket-scanner/id1327353743',
  Android:'https://play.google.com/store/apps/details?id=com.scantickets.app.eventix',
 }
 for(const [name,href] of Object.entries(backups)){
  const link=scanner.getByRole('link',{name,exact:true})
  assert.equal(await link.getAttribute('href'),href)
  assert.equal(await link.getAttribute('target'),'_blank')
 }
 await gotoReady(adminPage,base+'/guestlist?event='+created.eventId+'&workplace='+workplace.id)
 assert.equal(await adminPage.locator('[data-weeztix-scanner]').count(),0,'Guestlist remains separate from the single entrance ticket scanner')
 ok('In-app entrance ticket scanner verifies through Weeztix endpoint, fails closed without configuration, and provides backup links only on entrance posts')
 const itemResult=await admin.db.rpc('upt_create_inventory_item',{p_workplace:workplace.id,p_name:prefix+' Equipment',p_category:'test',p_quantity:1,p_item_kind:'asset'})
 if(itemResult.error)throw itemResult.error
 const item=await one(admin.db.from('inventory_items').select('id,total_quantity').eq('workplace_id',workplace.id).eq('name',prefix+' Equipment'));created.itemIds.push(item.id)
 await gotoReady(adminPage,base+'/portals/administration/modules/inventory')
 const receiptForm=await openInventoryReceiptForm(adminPage,line.id)
 const receiptRequest=await receiptForm.locator('input[name="request"]').inputValue()
 await receiptForm.locator('select[name="item"]').selectOption(item.id);await receiptForm.locator('input[name="quantity"]').fill('2')
 await clickAndSettle(adminPage,receiptForm.getByRole('button'))
 const stock=await one(admin.db.from('inventory_items').select('total_quantity').eq('id',item.id));assert.equal(stock.total_quantity,3)
 const replay=await admin.db.rpc('upt_receive_invoice_inventory',{p_request:receiptRequest,p_line:line.id,p_item:item.id,p_quantity:2});assert.equal(replay.error,null);assert.equal(replay.data,false)
 const extra=await admin.db.rpc('upt_receive_invoice_inventory',{p_request:randomUUID(),p_line:line.id,p_item:item.id,p_quantity:1});assert.ok(extra.error)
 const denied=await office.db.rpc('upt_receive_invoice_inventory',{p_request:randomUUID(),p_line:line.id,p_item:item.id,p_quantity:1});assert.ok(denied.error)
 assert.equal((await one(admin.db.from('inventory_items').select('total_quantity').eq('id',item.id))).total_quantity,3)
 ok('Inventory UI receives approved purchases; replay, over-receipt and employee writes cannot inflate stock')
 await gotoReady(page,base+'/portals/administration/modules/ticketing')
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
 const conflict=await officeContext.request.post(base+'/api/administration/ticketing/import',{headers:{origin:base},multipart:{eventId:created.eventId,source:'eventix',file:{name:'conflict.csv',mimeType:'text/csv',buffer:Buffer.from(conflictCsv)}}})
 assert.equal(conflict.status(),409)
 const absent=await office.db.from('admin_ticket_sales').select('id').eq('external_id',prefix+'-NEW');assert.equal(absent.data.length,0)
 const noAccess=await staffContext.request.post(base+'/api/administration/ticketing/import',{headers:{origin:base},multipart:{eventId:created.eventId,source:'ticketplatform',file:{name:'sales.csv',mimeType:'text/csv',buffer:Buffer.from(csv)}}});assert.equal(noAccess.status(),403)
 const crossOrigin=await officeContext.request.post(base+'/api/administration/ticketing/import',{headers:{origin:'https://invalid.example'},multipart:{eventId:created.eventId,source:'ticketplatform',file:{name:'sales.csv',mimeType:'text/csv',buffer:Buffer.from(csv)}}});assert.equal(crossOrigin.status(),403)
 ok('Conflicting ticket batch rolls back all rows; staff and foreign origins are denied')
 await gotoReady(page,base+'/portals/administration/modules/permits')
 const caseForm=page.locator('form:visible').filter({has:page.locator('input[name="title"]')}).first()
 await caseForm.locator('input[name="title"]').fill(prefix+' Permit')
 await caseForm.locator('input[name="deadline"]').fill(new Date(Date.now()+86400000*7).toISOString().slice(0,10))
 await caseForm.locator('select[name="event"]').selectOption(created.eventId)
 await clickAndSettle(page,caseForm.getByRole('button'))
 const obligation=await one(office.db.from('admin_operational_obligations').select('id').eq('title',prefix+' Permit'));created.obligationIds.push(obligation.id)
 let submit=page.locator(`form:visible:has(input[name="id"][value="${obligation.id}"]):has(button[value="submitted"])`)
 await clickAndSettle(page,submit.locator('button[value="submitted"]'))
 const selfApprove=await office.db.from('admin_operational_obligations').update({status:'approved'}).eq('id',obligation.id).select('id');assert.ok(selfApprove.error||!selfApprove.data?.length)
 await gotoReady(adminPage,base+'/portals/administration/modules/permits')
 const caseReview=adminPage.locator(`form:visible:has(input[name="id"][value="${obligation.id}"]):has(button[value="approved"])`)
 await clickAndSettle(adminPage,caseReview.locator('button[value="approved"]'))
 await gotoReady(page,page.url())
 const complete=page.locator(`form:visible:has(input[name="id"][value="${obligation.id}"]):has(button[value="completed"])`)
 await clickAndSettle(page,complete.locator('button[value="completed"]'))
 assert.equal((await one(office.db.from('admin_operational_obligations').select('status').eq('id',obligation.id))).status,'completed')
 ok('Permit case UI submits, requires Admin approval and persists employee completion')
 const forbiddenPayroll=await staffContext.request.get(base+'/api/administration/payroll/export?event='+created.eventId);assert.equal(forbiddenPayroll.status(),403)
 ok('Payroll export denies ordinary staff')
 const promoContext=await browserContext(browser,promo)
 const promotionPage=await promoContext.newPage()
 for(const route of ['/portals/promotion','/portals/promotion/tasks']){
  response=await gotoReady(promotionPage,base+route)
  assert.equal(response.status(),200,'Promotion route HTTP 200: '+route)
  assert.equal(new URL(promotionPage.url()).pathname,route,'Promotion route must not redirect: '+route)
  assert.equal(await promotionPage.locator('[data-layout-key]').count(),0,'Promotion must not render staff navigation: '+route)
  const promotionBody=await promotionPage.locator('body').innerText()
  const promotionError=/application error|internal server error|404\s*\|/i.exec(promotionBody)
  if(promotionError)console.error('Promotion error diagnostics:',JSON.stringify({route,match:promotionError[0],context:promotionBody.slice(Math.max(0,promotionError.index-160),promotionError.index+240)}))
  assert.ok(!promotionError,'Promotion error page: '+route)
 }
 await promotionTaskWorkflow({base,prefix,adminPage,promotionPage,admin,promo,office,staff,created,ok,browser,browserContext})
 const taskLinks=await promotionPage.locator('a[href]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')).filter(Boolean))
 assert.ok(taskLinks.every(href=>!href.startsWith('/portals/staff')&&!href.startsWith('/login/staff')),'Promotion task links must not enter staff portal')
 const taskButtons=await promotionPage.locator('button:visible').count()
 const taskForms=await promotionPage.locator('form').count()
 console.log('Promotion tasks interactive surface:',JSON.stringify({taskButtons,taskForms,taskLinks:taskLinks.length}))
 const internalTaskLinks=[...new Set(taskLinks.filter(href=>href.startsWith('/portals/promotion/')))]
 for(const target of internalTaskLinks){
  const link=promotionPage.locator('a[href="'+target.replaceAll('"','\\"')+'"]:visible').first()
  if(!await link.count())continue
  const clicked=await promoContext.newPage()
  try{
   await clicked.goto(base+'/portals/promotion/tasks',{waitUntil:'domcontentloaded'})
   const candidate=clicked.locator('a[href="'+target.replaceAll('"','\\"')+'"]:visible').first()
   if(!await candidate.count())continue
   await candidate.click()
   const expected=new URL(target,base).pathname
   await clicked.waitForURL(location=>location.pathname===expected,{timeout:20000})
   assert.equal(new URL(clicked.url()).pathname,expected,'Promotion link unexpectedly redirected: '+target)
   assert.equal(await clicked.locator('[data-layout-key]').count(),0,'Promotion link rendered staff navigation: '+target)
   assert.ok(!/application error|internal server error|404\s*\|/i.test(await clicked.locator('body').innerText()),'Promotion link rendered error: '+target)
  }finally{await clicked.close()}
 }
 ok('Promotion internal task links navigate inside their own portal')

 ok('Promotion landing and tasks load without redirect or staff navigation')
 for(const locale of ['nl','fr','en','de']){
  const context=await browserContext(browser,promo,locale)
  const tab=await context.newPage()
  try{
   for(const route of ['/portals/promotion','/portals/promotion/tasks']){
    const errors=[]
    tab.on('pageerror',error=>errors.push(error.message))
    const result=await gotoReady(tab,base+route)
    assert.ok(result.status()<400,locale+' promotion HTTP '+result.status())
    assert.equal(new URL(tab.url()).pathname,route,locale+' promotion redirected')
    assert.equal(await tab.locator('[data-layout-key]').count(),0,locale+' promotion rendered staff navigation')
    assert.ok(!/application error|internal server error|(?:^|\n)404\s*\|/i.test(await tab.locator('body').innerText()),locale+' promotion error screen')
    assert.deepEqual(errors,[],locale+' promotion browser errors')
    tab.removeAllListeners('pageerror')
   }
  }finally{await context.close()}
 }
 ok('Promotion landing and tasks render in all four supported locales')
 for(const locale of ['nl','fr','en','de']){
  const context=await browserContext(browser,office,locale),tab=await context.newPage()
  for(const path of ['/portals/administration','/portals/administration/modules/ticketing','/portals/administration/modules/banking','/portals/administration/modules/inventory','/portals/administration/modules/permits','/portals/administration/modules/automations']){
   const errors=[];tab.on('pageerror',e=>errors.push(e.message));const r=await gotoReady(tab,base+path);assert.ok(r.status()<400,path+' HTTP '+r.status());assert.equal(errors.length,0);const body=await tab.locator('body').innerText();assert.ok(!/application error|internal server error|(?:^|\n)404\s*\|/i.test(body));assert.equal(new URL(tab.url()).pathname,path)
  }
  await context.close()
 }
 const marketingTab=await officeContext.newPage()
 try{
  await gotoReady(marketingTab,base+'/portals/administration/modules/marketing')
  const promotionManagement=marketingTab.locator('a[href="/portals/administration/promotion-tasks"]').first()
  assert.equal(await promotionManagement.count(),1,'Administration marketing must link to internal promotion management')
  await promotionManagement.click()
  await marketingTab.waitForURL(url=>url.pathname==='/portals/administration/promotion-tasks',{timeout:20000})
  assert.equal(new URL(marketingTab.url()).pathname,'/portals/administration/promotion-tasks')
  const promotionBody=await marketingTab.locator('body').innerText()
  const promotionErrors=[]
  marketingTab.on('pageerror',error=>promotionErrors.push(error.message))
  assert.ok(!/application error|internal server error|(?:^|\n)404\s*\|/i.test(promotionBody),'Administration promotion tasks rendered an error at '+marketingTab.url()+': '+promotionBody.slice(0,1600))
  assert.deepEqual(promotionErrors,[],'Administration promotion tasks client errors')
  const review=marketingTab.locator('a[href="/portals/administration/promotion-discipline"]')
  assert.equal(await review.count(),1,'Administration promotion management must expose evidence and strike review')
  ok('Administration Marketing to Promotion tasks remains within administration')
 }finally{await marketingTab.close()}
 ok('Promotion opens and Administration routes render in all four locales at mobile width')
}catch(e){
 failure=e;console.error('FAIL:',e.message)
 console.error('Last submitted form:',JSON.stringify(lastAction??null))
 const pages=browser.contexts().flatMap(context=>context.pages()).slice(0,4)
 for(const [index,page] of pages.entries()){
  console.error('Failure page:',page.url(),await page.getByRole('alert').allTextContents().catch(()=>[]))
  await page.screenshot({path:`test-results/administration-completion/failure-${index}.png`,fullPage:true,timeout:5000}).catch(()=>{})
 }
}
finally{
 await browser.close()
 await writeFile('test-results/administration-completion/manifest.json',JSON.stringify(created,null,2))
 await writeFile('test-results/administration-completion/result.json',JSON.stringify({checks,passed:checks.length,failed:failure?failure.message:null,lastAction},null,2))
}
if(failure)throw failure
console.log('PASS:',checks.length,'verified administration workflow checks')
