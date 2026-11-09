import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {validateBankStatementCsv} from '../lib/administration/bank-statement-import.ts'

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')
const header='transaction_id,booked_on,direction,amount,currency,payment_reference,description\n'
const row=(id='TX-001',direction='credit',amount='123.45',reference='INV-1',description='Received')=>
 id+',2026-11-09,'+direction+','+amount+',EUR,'+reference+','+description+'\n'

test('valid EUR bank statement captures exact cents for receipts and outgoing payments',()=>{
 const r=validateBankStatementCsv(header+row()+row('TX-002','debit','30.01','SUP-1'))
 assert.deepEqual(r.errors,[])
 assert.equal(r.rows.length,2)
 assert.equal(r.creditCents,12345)
 assert.equal(r.debitCents,3001)
 assert.deepEqual(r.rows[1],{transactionId:'TX-002',bookedOn:'2026-11-09',direction:'debit',
  amountCents:3001,paymentReference:'SUP-1',description:'Received'})
})
test('bank statement headers and dates are strictly checked, including impossible dates',()=>{
 for(const source of [
  '',header,'wrong\n',header.replace('transaction_id','payment_id')+row(),
  header+row().replace('2026-11-09','2026-02-30'),
  header+row().replace('2026-11-09','2026-11-31'),
  header+row().replace('2026-11-09','2026-11-09T00:00:00Z'),
  header+row().replace('TX-001','"not closed')
 ]){
  const result=validateBankStatementCsv(source)
  assert.ok(result.errors.length>0,'Expected invalid CSV: '+source.slice(0,80))
 }
})
test('duplicate bank IDs, invalid direction, currency, formula IDs and precision reject all rows',()=>{
 for(const bad of [
  row('TX-001'),row('TX-002','refund'),
  row('TX-002','credit','1.001'),row('TX-002','credit','-4.00'),
  row('TX-002','credit','0.00'),row('TX-002','credit','1000000000'),
  row('TX-002','credit','4.50').replace('EUR','USD'),
  row('=FORMULA'),row('TX-002','credit','8.00').replace('Received','with\nnewline')
 ]){
  const value=validateBankStatementCsv(header+row()+bad)
  assert.ok(value.errors.length>0,'Expected invalid row: '+bad)
  assert.deepEqual(value.rows,[])
  assert.equal(value.creditCents,0)
  assert.equal(value.debitCents,0)
 }
})
test('import enforces 500 rows, 1 MB payload, strict quote syntax and useful descriptions',()=>{
 const rows=Array.from({length:501},(_,i)=>row('TX-'+i)).join('')
 assert.ok(validateBankStatementCsv(header+rows).errors.length)
 assert.ok(validateBankStatementCsv(header+row(),501).errors.length)
 assert.ok(validateBankStatementCsv(header+row(),0).errors.length)
 assert.ok(validateBankStatementCsv('A'.repeat(1_000_001)).errors.length)
 const quoted=header+'TX-3,2026-11-09,credit,1.50,EUR,"Invoice, 2026","Received, via SEPA"\n'
 const valid=validateBankStatementCsv(quoted)
 assert.deepEqual(valid.errors,[])
 assert.equal(valid.rows[0].paymentReference,'Invoice, 2026')
 assert.equal(valid.rows[0].description,'Received, via SEPA')
})
test('server routes fail closed and distinguish read-only import from final Admin-only booking',()=>{
 const api=read('../app/api/administration/bank-statements/route.ts')
 for(const fragment of [
  'sameOrigin(request)','administrationAccess()','upt_is_admin',
  'validateBankStatementCsv','upt_admin_import_bank_statement_transactions',
  'upt_admin_post_bank_statement_payment','upt_admin_ignore_bank_statement',
  "statementCount>1000","invoiceCount>500","data.length!==statementCount",
  'financialAmountCents','result.data',
 ]){
  assert.ok(api.includes(fragment),fragment)
 }
 assert.match(api,/export async function GET\(\)/)
 assert.match(api,/export async function POST\(request:Request\)/)
 assert.match(api,/export async function PATCH\(request:Request\)/)
 assert.match(api,/maxBytes=4096/)
 assert.doesNotMatch(api,/\.from\('admin_financial_payments'\)\.insert/)
})
test('SQL ledger is append-only for roles and posts only after Admin approval',()=>{
 const sql=read('../supabase/migrations/20261109070000_administration_bank_statement_invoice_matching.sql')
 for(const fragment of [
  'enable row level security','grant select on public.admin_bank_statement_transactions to authenticated',
  'revoke all on public.admin_bank_statement_transactions from public,anon,authenticated',
  'public.upt_can_manage_administration()','public.upt_is_admin()',
  "on conflict (transaction_id) do nothing","for update",
  'bank_reference like','BANKSTMT:',
  "v_statement.direction='credit' and v_document.kind<>'sales_invoice'",
  "v_statement.direction='debit' and v_document.kind<>'purchase_invoice'",
  'v_remaining:=v_document.gross_amount-v_paid-v_credited',
  "v_amount>v_remaining","v_statement.posted_payment_id is not null",
  'v_statement.ignored_at is not null',
  "v_statement.ignored_reason is distinct from v_reason",
 ]){
  assert.ok(sql.includes(fragment),fragment)
 }
 assert.match(sql,/grant execute on function public\.upt_admin_post_bank_statement_payment\(uuid,uuid\) to authenticated/)
 assert.match(sql,/grant execute on function public\.upt_admin_ignore_bank_statement\(uuid,text\) to authenticated/)
 assert.doesNotMatch(sql,/grant (?:all|insert|update|delete) on public\.admin_bank_statement_transactions to authenticated/)
})
test('Banking module exposes import, invoice matching, reviewer and localized actions',()=>{
 const page=read('../app/(app)/portals/administration/modules/[slug]/page.tsx')
 const ui=read('../components/administration/bank-statement-workspace.tsx')
 assert.match(page,/BankStatementWorkspace/)
 assert.match(page,/slug==="banking"/)
 for(const locale of ['nl','fr','en','de'])assert.match(ui,new RegExp('\\b'+locale+':\\{title:'))
 assert.match(ui,/validateBankStatementCsv/)
 assert.match(ui,/\/api\/administration\/bank-statements/)
 assert.match(ui,/workspace\.canApprove/)
 assert.match(ui,/window\.confirm/)
 assert.match(ui,/maxLength=\{500\}/)
 assert.match(ui,/invoice\.outstandingCents>=entry\.amount_cents/)
 assert.match(ui,/setPage/)
})
