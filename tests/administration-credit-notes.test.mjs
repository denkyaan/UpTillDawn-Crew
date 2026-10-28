import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const sql=readFileSync('supabase/migrations/20261027193000_administration_credit_note_links.sql','utf8')
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('credit notes require a linked approved original invoice and cannot overcredit',()=>{
 assert.match(sql,/original_invoice_id uuid references public\.admin_financial_documents/)
 assert.match(sql,/original_record\.kind not in \('sales_invoice','purchase_invoice'\)/)
 assert.match(sql,/credited\+new\.gross_amount>original_record\.gross_amount/)
 assert.match(sql,/where id=new\.original_invoice_id for update/)
 assert.match(sql,/Original invoice reference cannot be changed/)
})
test('credit note creation validates reference and displays original invoice',()=>{
 assert.match(page,/kind==='credit_note'/)
 assert.match(page,/original_invoice_id:kind==='credit_note'\?originalInvoiceId:null/)
 assert.match(page,/name="original_invoice_id"/)
 assert.match(page,/d\.original_invoice_id/)
})
