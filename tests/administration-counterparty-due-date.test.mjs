import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('changing counterparty can optionally recalculate due date',()=>{
 const action=page.slice(page.indexOf('async function updateDraftCounterparty('),page.indexOf('async function updateDraftNotes('))
 assert.match(action,/formData\.get\('use_payment_terms'\)==='on'/)
 assert.match(action,/\.select\('kind,status,issue_date'\)/)
 assert.match(action,/\.select\('kind,payment_terms_days'\)/)
 assert.match(action,/due\.setUTCDate\(due\.getUTCDate\(\)\+party\.payment_terms_days\)/)
 assert.match(action,/const patch=useTerms\?\{counterparty_id:counterpartyId\|\|null,due_date:calculatedDueDate\}/)
 assert.match(page,/nl:'Vervaldatum herberekenen'/)
})
