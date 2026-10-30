import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const sql=readFileSync('supabase/migrations/20261030143000_administration_generated_invoice_guard_fix.sql','utf8')

test('all invoice BEFORE triggers use base amounts, never NEW generated gross',()=>{
 for(const name of ['upt_admin_guard_credit_note','upt_admin_guard_financial_settlement','upt_admin_require_invoice_review_fields'])
  assert.match(sql,new RegExp('create or replace function public\\.'+name+'\\('))
 assert.doesNotMatch(sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n'),/new\.gross_amount/i)
 assert.match(sql,/\(new\.net_amount\+new\.tax_amount\)/)
})
test('paid invoices require actual full credit-adjusted settlement and void is blocked',()=>{
 assert.match(sql,/paid_total\+credited_total<>\(new\.net_amount\+new\.tax_amount\)/)
 assert.match(sql,/paid_total>0 or credited_total>0/)
})
test('credit notes require positive value before review and cannot overcredit',()=>{
 assert.match(sql,/Credit note amount must be positive before review/)
 assert.match(sql,/credited\+paid_total\+\(new\.net_amount\+new\.tax_amount\)>original_record\.gross_amount/)
})
test('invoice review cannot proceed with zero total',()=>{
 assert.match(sql,/\(new\.net_amount\+new\.tax_amount\)<=0/)
 assert.match(sql,/Invoice amount must be positive before review/)
})

test('null invoice and credit-note totals are rejected explicitly',()=>{
 assert.match(sql,/if \(new\.net_amount\+new\.tax_amount\) is null or \(new\.net_amount\+new\.tax_amount\)<0 then/)
 assert.match(sql,/if new\.status in \('review','approved','issued','paid'\) and \(\(new\.net_amount\+new\.tax_amount\) is null or \(new\.net_amount\+new\.tax_amount\)<=0\) then/)
 assert.match(sql,/if \(new\.net_amount\+new\.tax_amount\) is null or \(new\.net_amount\+new\.tax_amount\)<=0 then\s+raise exception 'Invoice amount must be positive before review'/)
})
