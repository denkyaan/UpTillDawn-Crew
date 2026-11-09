import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {validIban,normalizeIban,validateBankStatementCsv,reconcileBankStatementEntries} from '../lib/administration/bank-statement.ts'

const iban='BE68539007547034'
const header='transaction_reference,booking_date,amount,currency,counterparty_iban,description\n'
const line=(id='BANK-001',amount='30.00',date='2026-11-09')=>id+','+date+','+amount+',EUR,,Invoice settlement\n'
const bank=(data={})=>({id:'entry1',bank_account_iban:iban,transaction_reference:'BANK-001',booking_date:'2026-11-09',amount_cents:3000,counterparty_iban:null,description:'Invoice settlement',...data})
const payment=(data={})=>({id:'payment1',document_id:'invoice1',amount:'30.00',paid_on:'2026-11-09',bank_reference:'BANK-001',...data})
const invoice=(data={})=>({id:'invoice1',kind:'sales_invoice',status:'issued',currency:'EUR',document_number:'INV-001',...data})
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')

test('normalizes real IBAN and rejects invalid checksums and lengths',()=>{
 assert.equal(normalizeIban('be68 5390 0754 7034'),iban)
 assert.equal(validIban(iban),true)
 for(const id of ['BE67539007547034','BE68539007547035','BE123','XX00abcdefgh12345'])assert.equal(validIban(id),false)
})
test('bank CSV validates dates, exact cents, signed outgoing movements and rows',()=>{
 const result=validateBankStatementCsv(header+line()+line('BANK-002','-12.53'),iban)
 assert.deepEqual(result.errors,[])
 assert.equal(result.rows.length,2)
 assert.equal(result.rows[0].amountCents,3000)
 assert.equal(result.rows[1].amountCents,-1253)
 assert.equal(result.netCents,1747)
})
test('bank statement CSV fails entire batch closed for duplicate refs, invalid dates, amounts and currencies',()=>{
 for(const value of [
  line('BANK-001','50.00'),
  line('BANK-002','10.000'),
  line('BANK-002','0.00'),
  line('BANK-002','30.00','2026-02-30'),
  line('BANK-002','30.00').replace(',EUR,',',USD,'),
  line('=HYPERLINK','30.00'),
  line('BANK-002','1.00').replace('Invoice settlement','x'.repeat(501)),
 ]){
  const result=validateBankStatementCsv(header+line()+value,iban)
  assert.ok(result.errors.length>0)
  assert.deepEqual(result.rows,[])
  assert.equal(result.netCents,0)
 }
})
test('bank CSV rejects malformed quotes, no rows, malformed header and quantity limit',()=>{
 for(const data of [header,'wrong\n',header+line().replace('BANK-001','"unfinished'),
  header.replace('transaction_reference','payment_id')+line()]){
  assert.ok(validateBankStatementCsv(data,iban).errors.length>0)
 }
 assert.ok(validateBankStatementCsv(header+line(),'BE00539007547034').errors.length)
 assert.ok(validateBankStatementCsv(header+line()+line('BANK-002'),iban,1).errors.length)
})
test('matching exact reference, date and signed amount returns a suggestion without writing payments',()=>{
 const rows=reconcileBankStatementEntries([bank()],[payment()],[invoice()],[])
 assert.deepEqual(rows,[{entryId:'entry1',state:'ready',paymentId:'payment1',documentNumber:'INV-001'}])
 const stored=reconcileBankStatementEntries([bank()],[payment()],[invoice()],[{id:'m1',entry_id:'entry1',payment_id:'payment1'}])
 assert.equal(stored[0].state,'confirmed')
})
test('outgoing purchase invoice payments require a NEGATIVE bank movement',()=>{
 const matched=reconcileBankStatementEntries([bank({amount_cents:-3000})],[payment()],[invoice({kind:'purchase_invoice'})],[])
 assert.equal(matched[0].state,'ready')
 assert.equal(reconcileBankStatementEntries([bank()],[payment()],[invoice({kind:'purchase_invoice'})],[])[0].state,'unmatched')
})
test('never suggest fuzzy matches based only on amount or date',()=>{
 for(const b of [bank({transaction_reference:'DIFFERENT'}),bank({booking_date:'2026-11-08'}),bank({amount_cents:2999})]){
  assert.equal(reconcileBankStatementEntries([b],[payment()],[invoice()],[])[0].state,'unmatched')
 }
})
test('ambiguous invoice payments and conflicting bank lines require review',()=>{
 const a=reconcileBankStatementEntries([bank()],[payment(),payment({id:'payment2',document_id:'invoice2'})],[invoice(),invoice({id:'invoice2',document_number:'INV-002'})],[])
 assert.equal(a[0].state,'ambiguous')
 const b=reconcileBankStatementEntries([bank(),bank({id:'entry2',bank_account_iban:'BE62510007547061'})],[payment()],[invoice()],[])
 assert.deepEqual(b.map(x=>x.state),['ambiguous','ambiguous'])
})
test('previously confirmed payment cannot be linked to a second bank line',()=>{
 const rows=reconcileBankStatementEntries([bank(),bank({id:'entry2',bank_account_iban:'BE62510007547061'})],[payment()],[invoice()],[{id:'m1',entry_id:'entry1',payment_id:'payment1'}])
 assert.equal(rows[0].state,'confirmed')
 assert.equal(rows[1].state,'ambiguous')
})
test('invalid/duplicated persisted bank rows and mismatched confirmation fail closed',()=>{
 assert.throws(()=>reconcileBankStatementEntries([bank(),bank()],[payment()],[invoice()],[]))
 assert.throws(()=>reconcileBankStatementEntries([bank({amount_cents:'3.33'})],[payment()],[invoice()],[]))
 assert.throws(()=>reconcileBankStatementEntries([bank()],[payment()],[invoice()],[{id:'m1',entry_id:'entry1',payment_id:'unknown'}]))
 assert.throws(()=>reconcileBankStatementEntries([bank()],[payment()],[invoice()],[{id:'m1',entry_id:'entry1',payment_id:'payment1'},{id:'m2',entry_id:'entry1',payment_id:'payment1'}]))
})
test('import API uses same-origin guard, bounded upload and authorized transactional RPC',()=>{
 const api=read('../app/api/administration/bank-statements/route.ts')
 assert.match(api,/sameOrigin\(request\)/)
 assert.match(api,/administrationAccess\(\)/)
 assert.match(api,/length>600_000/)
 assert.match(api,/validateBankStatementCsv/)
 assert.match(api,/upt_import_admin_bank_statement/)
 assert.match(api,/reconcileBankStatementEntries/)
 assert.match(api,/count>1000\|\|payments\.count>5000/)
 assert.doesNotMatch(api,/admin_financial_payments'\)\.insert/)
})
test('Admin-only match API checks exact IDs and only invokes confirmation RPC',()=>{
 const api=read('../app/api/administration/bank-statements/match/route.ts')
 assert.match(api,/sameOrigin\(request\)/)
 assert.match(api,/administrationAccess\(\)/)
 assert.match(api,/upt_is_admin/)
 assert.match(api,/upt_admin_confirm_bank_payment_match/)
 assert.doesNotMatch(api,/admin_financial_payments'\)\.insert/)
})
test('SQL is append-only, RLS restricted, and bank matching is strictly Admin-only',()=>{
 const sql=read('../supabase/migrations/20261109070000_administration_bank_statement_matching.sql')
 assert.match(sql,/admin_bank_statement_entries enable row level security/)
 assert.match(sql,/admin_bank_payment_matches enable row level security/)
 assert.match(sql,/grant select on public\.admin_bank_statement_entries to authenticated/)
 assert.match(sql,/revoke all on public\.admin_bank_payment_matches from public,anon,authenticated/)
 assert.match(sql,/not public\.upt_is_admin\(\)/)
 assert.match(sql,/v_payment\.bank_reference is distinct from v_entry\.transaction_reference/)
 assert.match(sql,/v_payment\.paid_on<>v_entry\.booking_date/)
 assert.match(sql,/on conflict \(bank_account_iban,transaction_reference\) do nothing/)
 assert.match(sql,/errcode='23505'/)
})
test('Banking portal includes bank workspace and four translated UI variants',()=>{
 const page=read('../app/(app)/portals/administration/modules/[slug]/page.tsx')
 const ui=read('../components/administration/bank-statement-workspace.tsx')
 assert.match(page,/BankStatementWorkspace/)
 assert.match(page,/slug==="banking"/)
 for(const locale of ['nl','fr','en','de'])assert.match(ui,new RegExp('\\b'+locale+':\\{title:'))
 assert.match(ui,/\/api\/administration\/bank-statements/)
 assert.match(ui,/\/api\/administration\/bank-statements\/match/)
 assert.match(ui,/validateBankStatementCsv/)
})
