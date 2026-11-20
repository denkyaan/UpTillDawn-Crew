import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {findExistingBankPaymentCandidates} from '../lib/administration/bank-statement-import.ts'

const statement={
 booked_on:'2026-11-09',direction:'credit',amount_cents:3000,payment_reference:'TRANSFER-001'
}
const payment=(override={})=>({
 id:'payment-1',documentId:'invoice-1',documentNumber:'INV-1',amountCents:3000,
 paidOn:'2026-11-09',bankReference:'TRANSFER-001',kind:'sales_invoice',...override
})
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')

test('existing-bank-payment reconciliation requires exact reference, date, amount and direction',()=>{
 assert.deepEqual(findExistingBankPaymentCandidates(statement,[payment()]).map(p=>p.id),['payment-1'])
 assert.equal(findExistingBankPaymentCandidates(statement,[payment({paidOn:'2026-11-08'})]).length,0)
 assert.equal(findExistingBankPaymentCandidates(statement,[payment({amountCents:3001})]).length,0)
 assert.equal(findExistingBankPaymentCandidates(statement,[payment({bankReference:'TRANSFER-002'})]).length,0)
 assert.equal(findExistingBankPaymentCandidates(statement,[payment({kind:'purchase_invoice'})]).length,0)
 assert.equal(findExistingBankPaymentCandidates({...statement,direction:'debit'},[payment()]).length,0)
 assert.equal(findExistingBankPaymentCandidates({...statement,payment_reference:''},[payment({bankReference:''})]).length,0)
 assert.equal(findExistingBankPaymentCandidates(statement,[payment({bankReference:'BANKSTMT:uuid'})]).length,0)
 assert.equal(findExistingBankPaymentCandidates({...statement,amount_cents:-3000},[payment()]).length,0)
})

test('ambiguous existing payments are exposed to explicit Admin review, never silently selected',()=>{
 const matches=findExistingBankPaymentCandidates(statement,[payment(),payment({id:'payment-2',documentId:'invoice-2'})])
 assert.deepEqual(matches.map(p=>p.id),['payment-1','payment-2'])
 const ui=read('../components/administration/bank-statement-workspace.tsx')
 assert.match(ui,/existing\.length===1&&!alreadyLinked\.has/)
 assert.match(ui,/existing\.length>0\|\|!candidates\.some/)
 assert.match(ui,/t\.ambiguousExisting/)
 assert.match(ui,/decide\("link",entry,linkCandidate\.id\)/)
})

test('database is the authority for match permission, duplicate avoidance and one-to-one links',()=>{
 const sql=read('../supabase/migrations/20261109071500_admin_bank_existing_payment_link.sql')
 assert.match(sql,/create or replace function public\.upt_admin_post_bank_statement_payment/)
 assert.match(sql,/Matching ledger payment already exists: link it instead of posting twice/)
 assert.match(sql,/p\.document_id=v_document\.id and p\.paid_on=v_statement\.booked_on/)
 assert.match(sql,/p\.amount=v_amount/)
 assert.match(sql,/create or replace function public\.upt_admin_link_existing_bank_statement_payment/)
 assert.match(sql,/not public\.upt_is_admin\(\)/)
 assert.match(sql,/v_payment\.bank_reference is distinct from v_statement\.payment_reference/)
 assert.match(sql,/v_candidate_count<>1/)
 assert.match(sql,/posted_payment_id=p_payment/)
 assert.match(sql,/revoke all on function public\.upt_admin_link_existing_bank_statement_payment\(uuid,uuid\) from public,anon/)
 const route=read('../app/api/administration/bank-statements/route.ts')
 assert.match(route,/action==='link'/)
 assert.match(route,/upt_admin_link_existing_bank_statement_payment/)
 assert.match(route,/sameOrigin\(request\)/)
})

test('bank matching UI is available in all four configured languages',()=>{
 const ui=read('../components/administration/bank-statement-workspace.tsx')
 for(const key of ['nl:','fr:','en:','de:'])assert.ok(ui.includes(key))
 for(const key of ['linkExisting:','linkConfirm:','possibleDuplicate:','ambiguousExisting:']){
  assert.equal(ui.split(','+key+'"').length-1,4)
 }
})
