import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('invoice draft uses counterparty terms only when due date is empty',()=>{
 const action=page.slice(page.indexOf('async function createDraft('),page.indexOf('async function updateDraftCounterparty('))
 assert.match(action,/let dueDate=String\(formData\.get\('due_date'\)/)
 assert.match(action,/\.select\('id,kind,payment_terms_days'\)/)
 assert.match(action,/!dueDate&&issueDate/)
 assert.match(action,/\['sales_invoice','purchase_invoice'\]\.includes\(kind\)/)
 assert.match(action,/party\.payment_terms_days<=365/)
 assert.match(action,/due\.setUTCDate\(due\.getUTCDate\(\)\+party\.payment_terms_days\)/)
})
