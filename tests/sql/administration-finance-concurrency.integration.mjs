// Run with FINANCE_TEST_DATABASE_URL pointing to a local PostgreSQL admin DB:
// node --test tests/sql/administration-finance-concurrency.integration.mjs
// Creates and drops its own database. No application database is modified.
import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {spawn,spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'

const adminUrl=new URL(process.env.FINANCE_TEST_DATABASE_URL??'http://missing')
if(!['postgres:','postgresql:'].includes(adminUrl.protocol)||!['localhost','127.0.0.1','[::1]'].includes(adminUrl.hostname)||adminUrl.search){
 throw new Error('FINANCE_TEST_DATABASE_URL must name a local PostgreSQL admin database without query parameters')
}
const testDatabase='upt_finance_test_'+randomUUID().replaceAll('-','')
const databaseUrl=new URL(adminUrl)
databaseUrl.pathname='/'+testDatabase
const psql=process.env.PSQL_BIN??'psql'
const admin='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const staff='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const party='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const env={...process.env,PGOPTIONS:'-c statement_timeout=8000 -c lock_timeout=6000'}
delete env.PGHOSTADDR
delete env.PGSERVICE
delete env.PGSERVICEFILE
const args=url=>['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','--dbname',String(url)]
const asUser=(sql,user=admin)=>`SET ROLE authenticated; SET request.jwt.claim.sub='${user}'; ${sql}`
function run(sql,url=databaseUrl){
 const result=spawnSync(psql,args(url),{input:sql,encoding:'utf8',env,timeout:12000,maxBuffer:2**22})
 assert.equal(result.status,0,result.stderr||result.error?.message)
 return result.stdout.trim()
}
function start(sql,applicationName='finance_'+randomUUID()){
 const child=spawn(psql,args(databaseUrl),{env:{...env,PGAPPNAME:applicationName},stdio:['pipe','pipe','pipe']})
 let stdout='',stderr='',readyResolve
 const ready=new Promise(resolve=>{readyResolve=resolve})
 child.stdout.on('data',chunk=>{
  stdout+=chunk
  if(stdout.includes('TRANSACTION_HELD'))readyResolve()
 })
 child.stderr.on('data',chunk=>{stderr+=chunk})
 const timeout=setTimeout(()=>child.kill(),10000)
 const done=new Promise((resolve,reject)=>{
  child.on('error',reject)
  child.on('close',code=>{clearTimeout(timeout);resolve({code,stdout:stdout.trim(),stderr})})
 })
 if(sql!==undefined)child.stdin.end(sql)
 return {child,done,ready,applicationName}
}
async function hold(sql,user=admin){
 const session=start()
 let released=false
 session.child.stdin.write(asUser(`BEGIN; ${sql}\n\\echo TRANSACTION_HELD\n`,user))
 await Promise.race([
  session.ready,
  session.done.then(result=>assert.fail('Transaction did not reach barrier: '+result.stderr)),
 ])
 return {
  async commit(){released=true;session.child.stdin.end('COMMIT;\n');const result=await session.done;assert.equal(result.code,0,result.stderr)},
  async rollback(){if(!released){released=true;session.child.stdin.end('ROLLBACK;\n')}await session.done},
 }
}
async function waitBlocked(session){
 const deadline=Date.now()+5000
 while(Date.now()<deadline){
  if(run(`select count(*) from pg_stat_activity where application_name='${session.applicationName}' and wait_event_type='Lock'`)==='1')return
  await delay(20)
 }
 assert.fail('Expected second transaction to wait on an actual PostgreSQL lock')
}
async function compete(firstSql,secondSql,{firstUser=admin,secondUser=admin}={}){
 const first=await hold(firstSql,firstUser)
 const second=start(asUser(secondSql,secondUser))
 try{
  await waitBlocked(second)
  await first.commit()
  return await second.done
 }finally{
  await first.rollback()
  second.child.stdin.end()
 }
}
function invoice(status='draft'){
 const id=randomUUID()
 run(asUser(`insert into public.admin_financial_documents
  (id,kind,counterparty_id,document_number,issue_date,due_date,net_amount,tax_amount)
  values('${id}','sales_invoice','${party}','TEST-${id}',current_date-30,current_date-1,100,0);
  ${status!=='draft'?`update public.admin_financial_documents set status='review' where id='${id}';`:''}
  ${status==='approved'?`update public.admin_financial_documents set status='approved',approved_by=auth.uid(),approved_at=now() where id='${id}';`:''}`))
 return id
}
const line=(documentId,id,price)=>`insert into public.admin_financial_lines(id,document_id,description,quantity,unit_price,vat_rate) values('${id}','${documentId}','Test line',1,${price},21);`
const payment=(documentId,amount,id=randomUUID())=>`insert into public.admin_financial_payments(id,document_id,amount,paid_on) values('${id}','${documentId}',${amount},current_date);`
const approve=id=>`update public.admin_financial_documents set status='approved',approved_by=auth.uid(),approved_at=now() where id='${id}' and status='review';`
function credit(documentId,amount){
 const id=randomUUID()
 run(asUser(`insert into public.admin_financial_documents(id,kind,original_invoice_id,net_amount,tax_amount) values('${id}','credit_note','${documentId}',${amount},0);update public.admin_financial_documents set status='review' where id='${id}';`))
 return id
}
const reminder=documentId=>{
 const id=randomUUID()
 run(asUser(`insert into public.admin_payment_reminders(id,document_id,reminder_number,subject,body,recipient_email) values('${id}','${documentId}',1,'Original subject','Original body','crew@example.com');`,staff))
 return id
}
const migrations=[
 '20261022103000_administration_finance_foundation.sql',
 '20261027170000_administration_invoice_line_totals.sql',
 '20261027183000_administration_invoice_line_mutations.sql',
 '20261027190000_administration_financial_approval_guard.sql',
 '20261027193000_administration_credit_note_links.sql',
 '20261027200000_administration_payment_ledger.sql',
 '20261027203000_administration_settlement_consistency.sql',
 '20261027210000_administration_payment_reminders.sql',
 '20261027233000_administration_invoice_review_readiness.sql',
 '20261030123000_administration_reminder_credit_balance_guard.sql',
 '20261030130000_administration_credit_adjusted_settlement.sql',
 '20261030133000_administration_paid_invoice_settlement_guard.sql',
 '20261030140000_administration_settlement_guard_alignment.sql',
 '20261030143000_administration_generated_invoice_guard_fix.sql',
 '20261030205235_administration_peppol_preparation.sql',
]
let created=false
before(()=>{
 run(`create database ${testDatabase};`,adminUrl)
 created=true
 run(readFileSync('tests/fixtures/administration-finance-concurrency.sql','utf8'))
 for(const name of migrations)run(readFileSync('supabase/migrations/'+name,'utf8'))
 // For reproducing the pre-fix race with --test-name-pattern='simultaneous line'.
 if(process.env.FINANCE_TEST_BASELINE!=='1')run(readFileSync('supabase/migrations/20261107184322_administration_finance_concurrency.sql','utf8'))
 run(asUser(`insert into public.admin_counterparties(id,name,kind) values('${party}','Concurrency test customer','customer');`))
})
after(()=>{if(created)run(`drop database ${testDatabase} with (force);`,adminUrl)})

test('simultaneous line inserts preserve both amounts and VAT totals',async()=>{
 const id=invoice()
 const result=await compete(line(id,randomUUID(),10),line(id,randomUUID(),20),{firstUser:staff,secondUser:staff})
 assert.equal(result.code,0,result.stderr)
 assert.equal(run(`select net_amount||'|'||tax_amount from public.admin_financial_documents where id='${id}'`),'30.00|6.30')
 assert.equal(run(`select count(*) from public.admin_financial_lines where document_id='${id}'`),'2')
})

test('simultaneous line updates recompute totals after the waiting writer acquires the invoice',async()=>{
 const id=invoice(),firstLine=randomUUID(),secondLine=randomUUID()
 run(asUser(line(id,firstLine,10)+line(id,secondLine,20),staff))
 const result=await compete(
  `update public.admin_financial_lines set unit_price=15 where id='${firstLine}';`,
  `update public.admin_financial_lines set unit_price=25 where id='${secondLine}';`,
  {firstUser:staff,secondUser:staff},
 )
 assert.equal(result.code,0,result.stderr)
 assert.equal(run(`select net_amount||'|'||tax_amount from public.admin_financial_documents where id='${id}'`),'40.00|8.40')
})

test('submission wins the lock: a waiting line edit is rejected and rolled back',async()=>{
 const id=invoice(),lineId=randomUUID()
 run(asUser(line(id,lineId,10),staff))
 const result=await compete(
  `update public.admin_financial_documents set status='review' where id='${id}';`,
  `update public.admin_financial_lines set unit_price=999 where id='${lineId}';`,
  {firstUser:staff,secondUser:staff},
 )
 assert.notEqual(result.code,0)
 assert.match(result.stderr,/Invoice lines can only change while the document is draft/)
 assert.equal(run(`select unit_price from public.admin_financial_lines where id='${lineId}'`),'10.0000')
 assert.equal(run(`select status||'|'||net_amount from public.admin_financial_documents where id='${id}'`),'review|10.00')
})

test('line edit wins the lock: submission includes the committed total',async()=>{
 const id=invoice(),lineId=randomUUID()
 run(asUser(line(id,lineId,10),staff))
 const result=await compete(
  `update public.admin_financial_lines set unit_price=25 where id='${lineId}';`,
  `update public.admin_financial_documents set status='review' where id='${id}';`,
  {firstUser:staff,secondUser:staff},
 )
 assert.equal(result.code,0,result.stderr)
 assert.equal(run(`select status||'|'||net_amount||'|'||tax_amount from public.admin_financial_documents where id='${id}'`),'review|25.00|5.25')
})

test('simultaneous payments cannot exceed the invoice balance',async()=>{
 const id=invoice('approved')
 const result=await compete(payment(id,60),payment(id,60),{firstUser:staff,secondUser:staff})
 assert.notEqual(result.code,0)
 assert.match(result.stderr,/Payment exceeds credit-adjusted outstanding amount/)
 assert.equal(run(`select sum(amount) from public.admin_financial_payments where document_id='${id}'`),'60.00')
})

test('payments and credit approvals share the same remaining balance in either order',async()=>{
 const id=invoice('approved'),creditId=credit(id,40)
 const result=await compete(payment(id,70),approve(creditId),{firstUser:staff})
 assert.notEqual(result.code,0)
 assert.match(result.stderr,/Credit note exceeds credit-adjusted remaining invoice amount/)
 assert.equal(run(`select status from public.admin_financial_documents where id='${creditId}'`),'review')
 const other=invoice('approved'),otherCredit=credit(other,40)
 const reversed=await compete(approve(otherCredit),payment(other,70),{secondUser:staff})
 assert.notEqual(reversed.code,0)
 assert.match(reversed.stderr,/Payment exceeds credit-adjusted outstanding amount/)
 assert.equal(run(`select count(*) from public.admin_financial_payments where document_id='${other}'`),'0')
})

test('repeated submission IDs produce one payment even with no bank reference',async()=>{
 const id=invoice('approved'),paymentId=randomUUID()
 const result=await compete(payment(id,10,paymentId),payment(id,10,paymentId),{firstUser:staff,secondUser:staff})
 assert.notEqual(result.code,0)
 assert.match(result.stderr,/duplicate key value violates unique constraint "admin_financial_payments_pkey"/)
 assert.equal(run(`select count(*)||'|'||sum(amount) from public.admin_financial_payments where document_id='${id}'`),'1|10.00')
})

test('concurrent financial approvals only update the expected review status once',async()=>{
 const id=invoice('review')
 const result=await compete(approve(id),`with approved as (${approve(id).replace(/;$/,'')} returning id) select count(*) from approved;`)
 assert.equal(result.code,0,result.stderr)
 assert.equal(result.stdout,'0')
 assert.equal(run(`select count(*) from public.admin_financial_audit where document_id='${id}' and new_record->>'status'='approved'`),'1')
})

test('a draft edit invalidates an Admin approval of the previous reminder revision',async()=>{
 const documentId=invoice('approved'),id=reminder(documentId)
 const result=await compete(
  `update public.admin_payment_reminders set subject='Changed subject',revision=999 where id='${id}' and revision=1;`,
  `with approved as (update public.admin_payment_reminders set status='approved',approved_by=auth.uid(),approved_at=now() where id='${id}' and status='draft' and revision=1 returning id) select count(*) from approved;`,
  {firstUser:staff},
 )
 assert.equal(result.code,0,result.stderr)
 assert.equal(result.stdout,'0')
 assert.equal(run(`select status||'|'||revision||'|'||subject from public.admin_payment_reminders where id='${id}'`),'draft|2|Changed subject')
 run(asUser(`update public.admin_payment_reminders set status='approved',approved_by=auth.uid(),approved_at=now() where id='${id}' and status='draft' and revision=2;`))
 assert.equal(run(`select status||'|'||revision from public.admin_payment_reminders where id='${id}'`),'approved|3')
})

test('full payment wins the invoice lock: a waiting reminder approval is rejected',async()=>{
 const documentId=invoice('approved'),id=reminder(documentId)
 const result=await compete(payment(documentId,100),`update public.admin_payment_reminders set status='approved',approved_by=auth.uid(),approved_at=now() where id='${id}' and status='draft' and revision=1;`,{firstUser:staff})
 assert.notEqual(result.code,0)
 assert.match(result.stderr,/Reminder requires an overdue credit-adjusted outstanding balance/)
 assert.equal(run(`select status||'|'||revision from public.admin_payment_reminders where id='${id}'`),'draft|1')
})

test('Administration can edit drafts but cannot cancel or approve them through direct SQL',async()=>{
 const id=reminder(invoice('approved'))
 const cancelled=await start(asUser(`update public.admin_payment_reminders set status='cancelled' where id='${id}';`,staff)).done
 assert.notEqual(cancelled.code,0)
 assert.match(cancelled.stderr,/Reminder finalization requires an Admin/)
 const approved=await start(asUser(`update public.admin_payment_reminders set status='approved',approved_by=auth.uid(),approved_at=now() where id='${id}';`,staff)).done
 assert.notEqual(approved.code,0)
 assert.match(approved.stderr,/Reminder approval requires an Admin/)
 assert.equal(run(`select status||'|'||revision from public.admin_payment_reminders where id='${id}'`),'draft|1')
 run(asUser(`update public.admin_payment_reminders set status='cancelled' where id='${id}' and revision=1;`))
 assert.equal(run(`select status||'|'||revision from public.admin_payment_reminders where id='${id}'`),'cancelled|2')
})

test('new trigger functions retain invoker rights and are not directly executable by app roles',()=>{
 for(const name of ['upt_admin_lock_invoice_line_document','upt_admin_guard_reminder_revision']){
  assert.equal(run(`select prosecdef from pg_proc where oid='public.${name}()'::regprocedure`),'f')
  assert.equal(run(`select has_function_privilege('authenticated','public.${name}()','execute') or has_function_privilege('anon','public.${name}()','execute')`),'f')
 }
 assert.equal(run(`select bool_and(relrowsecurity) from pg_class where oid in ('public.admin_financial_lines'::regclass,'public.admin_payment_reminders'::regclass)`),'t')
})
