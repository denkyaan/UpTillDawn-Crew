import assert from 'node:assert/strict'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {chromium} from 'playwright'
import {createClient} from '@supabase/supabase-js'
import {peppolInput} from '../tests/fixtures/peppol-input.mjs'

const base=process.env.BOT_TEST_BASE_URL,url=process.env.BOT_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,password=process.env.BOT_TEST_PASSWORD
if(!base||!url||!key||!password||![base,url].every(value=>['127.0.0.1','localhost'].includes(new URL(value).hostname)))throw Error('Peppol browser test requires isolated local services')
const checks=[],prefix='QA-PEPPOL-'+randomUUID().slice(0,8),fixture=peppolInput(),output='test-results/peppol-e2e'
await mkdir(output,{recursive:true})
const browser=await chromium.launch({headless:true})
const one=async query=>{const {data,error}=await query.single();if(error)throw error;return data}
async function actor(email){const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await db.auth.signInWithPassword({email,password});if(error)throw error;const context=await browser.newContext({viewport:{width:390,height:844},locale:'en',acceptDownloads:true});const response=await context.request.post(base+'/api/test-auth-session',{data:{access_token:data.session.access_token,refresh_token:data.session.refresh_token}});assert.equal(response.status(),200);return {db,context,user:data.user,page:await context.newPage()}}
async function submit(page,button){const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).origin===new URL(base).origin&&Boolean(r.request().headers()['next-action']));await button.click();const result=await response;assert.ok(result.status()<400);assert.ok(!result.headers()['x-action-redirect']?.includes('error'))}
const ok=message=>{checks.push(message);console.log('PASS:',message)}
let failure
try{
 const office=await actor('bot-04-staff-de@bots.uptilldawn.test'),admin=await actor('bot-01-admin-nl@bots.uptilldawn.test'),staff=await actor('bot-03-staff-en@bots.uptilldawn.test')
 await office.page.goto(base+'/portals/administration/modules/settings',{waitUntil:'networkidle'})
 const region=office.page.getByRole('region',{name:'Your billing organization'})
 for(const [name,value]of Object.entries(fixture.seller))await region.locator(`input[name="${name}"]`).fill(value)
 await submit(office.page,region.getByRole('button',{name:'Save company details'}))
 await office.page.waitForFunction(()=>Boolean(document.querySelector('section[aria-label="Your billing organization"] input[name="version"]')?.value))
 const company=await one(office.db.from('admin_billing_profile').select('*'))
 assert.equal(company.approved_by,null)
 assert.equal(await region.getByRole('button',{name:'Approve company details (Admin)'}).count(),0)
 const forged=await office.db.from('admin_billing_profile').update({approved_by:office.user.id,approved_at:new Date().toISOString()}).eq('singleton',true);assert.equal(forged.error?.code,'42501')
 ok('Office saves company data through Settings and cannot approve it')
 await admin.page.goto(base+'/portals/administration/modules/settings',{waitUntil:'networkidle'})
 await submit(admin.page,admin.page.getByRole('button',{name:'Approve company details (Admin)'}))
 await admin.page.getByRole('status').filter({hasText:'Approved company details'}).waitFor()
 ok('Admin approves the saved company through the actual Settings form')
 const customer=await one(office.db.from('admin_counterparties').insert({...fixture.buyer,name:prefix+' Customer',kind:'customer'}).select('id'))
 const document=await one(office.db.from('admin_financial_documents').insert({kind:'sales_invoice',document_number:prefix,counterparty_id:customer.id,issue_date:'2026-10-30',due_date:'2026-11-13',buyer_reference:'TEST-PO',net_amount:0,tax_amount:0}).select('id'))
 const line=fixture.lines[0];const createdLine=await one(office.db.from('admin_financial_lines').insert({document_id:document.id,description:line.description,quantity:line.quantity,unit_price:line.unit_price,vat_rate:line.vat_rate,vat_category:line.vat_category,unit_code:line.unit_code}).select('id'))
 await office.page.goto(base+`/portals/administration/modules/invoices/${document.id}/peppol`,{waitUntil:'networkidle'})
 const references=office.page.locator('details').filter({has:office.page.locator('input[name="buyer_reference"]')})
 await references.locator('summary').click()
 const referenceForm=references.locator('form').filter({has:office.page.locator('input[name="buyer_reference"]')})
 await referenceForm.locator('input[name="buyer_reference"]').fill('TEST-PO-UI')
 await submit(office.page,referenceForm.getByRole('button'))
 await office.page.waitForFunction(()=>document.querySelector('input[name="buyer_reference"]')?.defaultValue==='TEST-PO-UI')
 assert.equal((await one(office.db.from('admin_financial_documents').select('buyer_reference').eq('id',document.id))).buyer_reference,'TEST-PO-UI')
 const lineForm=references.locator(`form:has(input[name="line_id"][value="${createdLine.id}"])`)
 await lineForm.locator('select[name="unit_code"]').selectOption('DAY')
 await submit(office.page,lineForm.getByRole('button'))
 assert.equal((await one(office.db.from('admin_financial_lines').select('unit_code').eq('id',createdLine.id))).unit_code,'DAY')
 ok('Customer references and invoice line units persist through the preparation forms')
 const {error:reviewError}=await office.db.from('admin_financial_documents').update({status:'review'}).eq('id',document.id);assert.equal(reviewError,null)
 await admin.page.goto(base+'/portals/administration/finance',{waitUntil:'networkidle'})
 const approval=admin.page.locator(`form:has(input[name="document_id"][value="${document.id}"]):has(input[name="status"][value="approved"]) button`)
 await submit(admin.page,approval);await approval.waitFor({state:'detached'})
 await office.page.goto(base+`/portals/administration/modules/invoices/${document.id}/peppol`,{waitUntil:'networkidle'})
 await office.page.getByRole('button',{name:'Check data',exact:true}).click()
 await office.page.getByRole('status').filter({hasText:'The data checks passed'}).waitFor()
 const download=office.page.waitForEvent('download');await office.page.getByRole('button',{name:'Download XML',exact:true}).click();await (await download).saveAs(output+'/outbound.xml')
 const xml=await readFile(output+'/outbound.xml','utf8');assert.ok(xml.includes('<Invoice '));assert.ok(xml.includes('<cbc:PayableAmount currencyID="EUR">24.20'))
 assert.equal((await one(office.db.from('admin_financial_documents').select('peppol_status').eq('id',document.id))).peppol_status,'not_connected')
 ok('Approved invoice validates and downloads Peppol XML through the mobile UI')
 const {error:paymentError}=await admin.db.from('admin_financial_payments').insert({document_id:document.id,amount:10,paid_on:'2026-10-30',bank_reference:prefix});assert.equal(paymentError,null)
 const paidDownload=office.page.waitForEvent('download');await office.page.getByRole('button',{name:'Download XML',exact:true}).click();await(await paidDownload).saveAs(output+'/outbound-prepaid.xml')
 const paidXml=await readFile(output+'/outbound-prepaid.xml','utf8');assert.ok(paidXml.includes('<cbc:PrepaidAmount currencyID="EUR">10.00'));assert.ok(paidXml.includes('<cbc:PayableAmount currencyID="EUR">14.20'))
 ok('Actual recorded payments reduce the exported payable amount without marking the file as sent')
 const denied=await staff.context.request.get(base+'/api/administration/peppol/prepare?documentId='+document.id);assert.equal(denied.status(),403)
 const foreign=await office.context.request.post(base+'/api/administration/peppol/prepare',{headers:{origin:'https://foreign.invalid'},data:{documentId:document.id}});assert.equal(foreign.status(),403)
 ok('Peppol preview denies ordinary staff and export rejects foreign origins')
 await office.page.goto(base+'/portals/administration/modules/settings',{waitUntil:'networkidle'})
 await region.locator('input[name="name"]').fill('Changed example company')
 await submit(office.page,region.getByRole('button',{name:'Save company details'}))
 await office.page.getByRole('status').filter({hasText:'Not yet approved by Admin'}).waitFor()
 assert.equal((await one(office.db.from('admin_billing_profile').select('approved_by'))).approved_by,null)
 const blocked=await office.context.request.post(base+'/api/administration/peppol/prepare',{headers:{origin:base},data:{documentId:document.id}});assert.equal(blocked.status(),422);assert.ok((await blocked.json()).issues.some(issue=>issue.path==='seller.approved'))
 const {count,error:auditError}=await office.db.from('admin_billing_profile_audit').select('id',{count:'exact',head:true});assert.equal(auditError,null);assert.ok(count>=3)
 ok('Company edits revoke approval, block fresh exports and retain an audit trail')
}catch(error){failure=error;console.error('FAIL:',error.message);for(const [index,page]of browser.contexts().flatMap(context=>context.pages()).entries())await page.screenshot({path:output+`/failure-${index}.png`,fullPage:true,timeout:5000}).catch(()=>{})}
finally{await browser.close();await writeFile(output+'/result.json',JSON.stringify({checks,failed:failure?.message??null},null,2))}
if(failure)throw failure
