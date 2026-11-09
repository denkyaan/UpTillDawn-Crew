import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {validateInvoiceLinesCsv,invoiceCsvHeader} from '../lib/administration/invoice-line-csv.ts'

const line=(description='Ticket scanning devices',quantity='3',price='22.50',vat='21')=>
 JSON.stringify(description)+','+quantity+','+price+','+vat+'\n'
const csv=(...values)=>invoiceCsvHeader+'\n'+values.join('')
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8')

test('valid normalized invoice CSV captures rows and exact VAT-inclusive cent totals',()=>{
 const parsed=validateInvoiceLinesCsv(csv(line('T-shirts', '10','12.50'),line('Supplier, materials','2','45.00')))
 assert.deepEqual(parsed.errors,[])
 assert.equal(parsed.rows.length,2)
 assert.deepEqual(parsed.rows[1],{description:'Supplier, materials',quantity:'2',unitPrice:'45.00',vatRate:'21'})
 assert.equal(parsed.netCents,21500)
 assert.equal(parsed.taxCents,4515)
})

test('precision retains fractional quantities, 4-decimal unit prices and line-based VAT rounding',()=>{
 const result=validateInvoiceLinesCsv(csv(line('Precision line','0.125','19.9925','21.00')))
 assert.deepEqual(result.errors,[])
 assert.equal(result.netCents,250)
 assert.equal(result.taxCents,52)
 const zero=validateInvoiceLinesCsv(csv(line('Zero rated','1','10','0')))
 assert.deepEqual(zero.errors,[])
 assert.equal(zero.netCents,1000)
 assert.equal(zero.taxCents,0)
})

test('invalid CSV rejects whole batch instead of silently accepting valid neighbours',()=>{
 const invalid=[
  csv(line('Good'),line('Bad','1.1234','1.00')),
  csv(line('Good'),line('Bad','0','1.00')),
  csv(line('Good'),line('Bad','1','1e6')),
  csv(line('Good'),line('Bad','1','10','100.01')),
  csv(line('Good'),line('=WEBSERVICE("https://example.com")')),
  csv(line('Good'),line('-SUM(1+1)')),
  csv(line('Good'),'Bad,1,10,21,unexpected\n'),
  csv(line('Good'),'Bad,"unterminated,10,21\n'),
  'other,quantity,unit_price,vat_rate\n'+line('Good'),
  csv(),
  csv(...Array.from({length:101},(_,i)=>line('Item '+i))),
  csv(line('Good'))+' '.repeat(100001)
 ]
 for(const input of invalid){
  const result=validateInvoiceLinesCsv(input)
  assert.ok(result.errors.length>0,'Invalid CSV accepted: '+input.slice(0,90))
  assert.deepEqual(result.rows,[])
  assert.equal(result.netCents,0)
  assert.equal(result.taxCents,0)
 }
})

test('normalized imports expose a fully audited atomic SQL boundary and no automatic approval',()=>{
 const sql=read('../supabase/migrations/20261109073000_admin_invoice_lines_csv_atomic.sql')
 assert.match(sql,/create table if not exists public\.admin_financial_line_imports/)
 assert.match(sql,/unique\(document_id,source_sha256\)/)
 assert.match(sql,/create or replace function public\.upt_admin_import_invoice_lines_csv/)
 assert.match(sql,/auth\.uid\(\) is null or not public\.upt_can_manage_administration\(\)/)
 assert.match(sql,/from public\.admin_financial_documents\s+where id=p_document for update/)
 assert.match(sql,/v_document\.status<>'draft'/)
 assert.match(sql,/p_request is null/)
 assert.match(sql,/source_sha256=p_sha256/)
 assert.match(sql,/insert into public\.admin_financial_lines/)
 assert.match(sql,/revoke all on function public\.upt_admin_import_invoice_lines_csv/)
 assert.doesNotMatch(sql,/\badmin_financial_payments\b|\binventory_movements\b|\bapprove\s+invoice\b/)
 const route=read('../app/api/administration/finance/invoice-lines/import/route.ts')
 assert.match(route,/sameOrigin\(request\)/)
 assert.match(route,/administrationAccess\(\)/)
 assert.match(route,/boundedForm\(request\)/)
 assert.match(route,/validateInvoiceLinesCsv\(csv\)/)
 assert.match(route,/createHash\('sha256'\)/)
 assert.match(route,/upt_admin_import_invoice_lines_csv/)
})

test('import UI has four languages, explicit confirmation, and no automatic inventory mutation',()=>{
 const ui=read('../components/administration/invoice-line-csv-import.tsx')
 for(const label of ['nl:','fr:','en:','de:'])assert.match(ui,new RegExp('\\b'+label))
 assert.match(ui,/window\.confirm\(t\.confirm\)/)
 assert.match(ui,/preview\.errors\.length/)
 assert.match(ui,/router\.refresh\(\)/)
 const page=read('../app/(app)/portals/administration/finance/page.tsx')
 assert.match(page,/<InvoiceLineCsvImport/)
 assert.match(page,/d\.status==='draft'&&d\.currency==='EUR'/)
})
