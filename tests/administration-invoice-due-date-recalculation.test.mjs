import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('draft invoice dates support optional recalculation from payment terms',()=>{
 const action=page.slice(page.indexOf('async function updateInvoiceDates('),page.indexOf('async function createPaymentReminder('))
 assert.match(action,/formData\.get\('use_payment_terms'\)==='on'/)
 assert.match(action,/\.eq\('status','draft'\)\.maybeSingle\(\)/)
 assert.match(action,/\.select\('payment_terms_days'\)/)
 assert.match(action,/party\.payment_terms_days>365/)
 assert.match(action,/due\.setUTCDate\(due\.getUTCDate\(\)\+party\.payment_terms_days\)/)
 assert.match(page,/name="use_payment_terms"/)
 assert.match(page,/nl:'Vervaldatum berekenen via betalingstermijn'/)
})
