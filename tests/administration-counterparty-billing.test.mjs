import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const sql=readFileSync('supabase/migrations/20261027234500_administration_counterparty_billing_details.sql','utf8')
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('billing migration restricts bank formats, addresses and payment terms',()=>{
 for(const field of ['street_address','postal_code','city','country_code','iban','bic','payment_terms_days'])assert.match(sql,new RegExp(field))
 assert.match(sql,/between 0 and 365/)
 assert.match(sql,/admin_counterparty_iban_format/)
})
test('create and edit counterparty include billing details',()=>{
 assert.match(page,/const billingDetails=/)
 assert.match(page,/enterprise_number:enterpriseNumber\|\|null,[^\n]*\.\.\.billingDetails/g)
 assert.match(page,/name="payment_terms_days"/)
 assert.match(page,/name="street_address"/)
 assert.match(page,/name="iban"/)
})
