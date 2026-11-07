import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'

const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
const invoiceId='11111111-1111-4111-8111-111111111111'
const paymentId='22222222-2222-4222-8222-222222222222'
const reminderId='33333333-3333-4333-8333-333333333333'
const success='/portals/administration/finance'
const conflict=success+'?conflict=1'
const failure=success+'?error=1'

class Redirect extends Error {}
function action(name,next,db,overrides={}){
 const source=page.slice(page.indexOf(`async function ${name}(`),page.indexOf(`async function ${next}(`))
 assert.ok(source.startsWith(`async function ${name}(`))
 const compiled=ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None})
 return runInNewContext(`${compiled}\n${name}`,{
  requireAdministration:async()=>({supabase:db,isAdmin:true}),
  redirect:path=>{throw new Redirect(path)},
  revalidatePath:()=>{},
  financialAmountCents:amount=>Math.round(amount*100),
  loadFinancialSettlement:async()=>({status:'approved',outstandingCents:10000}),
  reminderOutstanding:async()=>100,
  belgianToday:()=> '2026-11-07',
  ...overrides,
 })
}
const form=values=>{const data=new FormData();for(const [key,value]of Object.entries(values))data.set(key,value);return data}
const redirectsTo=(run,path)=>assert.rejects(run,error=>error instanceof Redirect&&error.message===path)

test('repeated payment submissions reuse the rendered ledger ID, including without a bank reference',async()=>{
 const rows=new Map()
 const db={from:table=>{
  assert.equal(table,'admin_financial_payments')
  let id
  const query={
   select:()=>query,
   eq:(_key,value)=>{id=value;return query},
   maybeSingle:async()=>({data:rows.get(id)??null,error:null}),
   insert:async row=>{
   if(rows.has(row.id))return {error:{code:'23505'}}
   rows.set(row.id,row)
   return {error:null}
   },
  }
  return query
 }}
 const record=action('recordFinancialPayment','updateFinancialStatus',db)
 const request=form({document_id:invoiceId,payment_id:paymentId,amount:'10.25',paid_on:'2026-11-07',bank_reference:''})
 await Promise.all([redirectsTo(()=>record(request),success),redirectsTo(()=>record(request),success)])
 // A retry also succeeds after the invoice balance has become zero.
 const retry=action('recordFinancialPayment','updateFinancialStatus',db,{loadFinancialSettlement:()=>assert.fail('Replay must not check a reduced balance')})
 await redirectsTo(()=>retry(request),success)
 await redirectsTo(()=>record(form({document_id:invoiceId,payment_id:paymentId,amount:'99',paid_on:'2026-11-07'})),failure)
 assert.equal(rows.size,1)
 assert.equal(rows.get(paymentId).amount,10.25)
 assert.equal(rows.get(paymentId).bank_reference,null)
 assert.match(page,/<input type="hidden" name="payment_id" value=\{randomUUID\(\)\}/)
})

test('missing or malformed payment submission IDs cannot create ledger entries',async()=>{
 const record=action('recordFinancialPayment','updateFinancialStatus',{from:()=>assert.fail('Unexpected ledger write')})
 for(const id of ['', 'bad-id']){
  await redirectsTo(()=>record(form({document_id:invoiceId,payment_id:id,amount:'10',paid_on:'2026-11-07'})),failure)
 }
})

test('a full-payment replay succeeds when another request settles the invoice during the balance check',async()=>{
 let lookups=0
 const db={from:()=>{
  const query={
   select:()=>query,
   eq:()=>query,
   maybeSingle:async()=>({data:++lookups===1?null:{document_id:invoiceId,amount:'100.00',paid_on:'2026-11-07',bank_reference:null},error:null}),
   insert:()=>assert.fail('A replay must not insert another payment'),
  }
  return query
 }}
 const record=action('recordFinancialPayment','updateFinancialStatus',db,{loadFinancialSettlement:async()=>({status:'paid',outstandingCents:0})})
 await redirectsTo(()=>record(form({document_id:invoiceId,payment_id:paymentId,amount:'100',paid_on:'2026-11-07'})),success)
 assert.equal(lookups,2)
})

test('an unrelated payment insert failure cannot be reported as a successful replay',async()=>{
 const db={from:()=>{
  const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:null,error:null}),insert:async()=>({error:{code:'23505'}})}
  return query
 }}
 const record=action('recordFinancialPayment','updateFinancialStatus',db)
 await redirectsTo(()=>record(form({document_id:invoiceId,payment_id:paymentId,amount:'10',paid_on:'2026-11-07'})),failure)
})

function reminderDatabase(){
 const row={id:reminderId,document_id:invoiceId,status:'draft',revision:2,subject:'Changed since page load'}
 const db={
  auth:{getUser:async()=>({data:{user:{id:invoiceId}}})},
  from:table=>{
   const filters=[]
   let patch
   const query={
    update:value=>{patch=value;return query},
    eq:(key,value)=>{filters.push([key,value]);return query},
    select:()=>patch?Promise.resolve().then(()=>{
     if(!filters.every(([key,value])=>row[key]===value))return {data:[],error:null}
     Object.assign(row,patch,{revision:row.revision+1})
     return {data:[{id:row.id}],error:null}
    }):query,
    maybeSingle:async()=>table==='admin_payment_reminders'
     ?{data:filters.every(([key,value])=>row[key]===value)?{document_id:invoiceId}:null,error:null}
     :{data:{kind:'sales_invoice',status:'approved',due_date:'2026-11-01',gross_amount:100},error:null},
   }
   return query
  },
 }
 return {db,row}
}

test('approval and cancellation reject a reminder draft changed since the form was rendered',async()=>{
 for(const status of ['approved','cancelled']){
  const {db,row}=reminderDatabase()
  const finalize=action('updatePaymentReminder','loadFinancialSettlement',db)
  await redirectsTo(()=>finalize(form({reminder_id:reminderId,status,expected_revision:'1'})),conflict)
  assert.equal(row.status,'draft')
  assert.equal(row.revision,2)
 }
})

test('the current reminder revision can be approved once; a repeat cannot overwrite approval',async()=>{
 const {db,row}=reminderDatabase()
 const finalize=action('updatePaymentReminder','loadFinancialSettlement',db)
 const request=form({reminder_id:reminderId,status:'approved',expected_revision:'2'})
 await redirectsTo(()=>finalize(request),success)
 assert.equal(row.status,'approved')
 assert.equal(row.revision,3)
 await redirectsTo(()=>finalize(request),conflict)
 assert.equal(row.revision,3)
})

test('saving a stale reminder cannot overwrite a newer draft',async()=>{
 const {db,row}=reminderDatabase()
 const edit=action('editPaymentReminderDraft','updatePaymentReminder',db)
 const values={reminder_id:reminderId,recipient_email:'crew@example.com',subject:'Stale edit',body:'Message',expected_revision:'1'}
 await redirectsTo(()=>edit(form(values)),conflict)
 assert.equal(row.subject,'Changed since page load')
 await redirectsTo(()=>edit(form({...values,expected_revision:'2'})),success)
 assert.equal(row.subject,'Stale edit')
 assert.equal(row.revision,3)
})

test('reminder mutations reject missing, coercible and out-of-range revisions',async()=>{
 const db={from:()=>assert.fail('Unexpected reminder write')}
 const edit=action('editPaymentReminderDraft','updatePaymentReminder',db)
 const finalize=action('updatePaymentReminder','loadFinancialSettlement',db)
 for(const revision of ['', '0', '-1', '1.0', '1e0', '2147483648']){
  await redirectsTo(()=>edit(form({expected_revision:revision})),failure)
  await redirectsTo(()=>finalize(form({expected_revision:revision})),failure)
 }
})
