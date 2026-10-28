import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('reminder draft editing checks inputs and status',()=>{
 const action=page.slice(page.indexOf('async function editPaymentReminderDraft('),page.indexOf('async function updatePaymentReminder('))
 assert.match(action,/recipient\.length>320/)
 assert.match(action,/subject\.length>200/)
 assert.match(action,/body\.length>10000/)
 assert.match(action,/\.eq\('status','draft'\)/)
 assert.match(action,/\.update\(\{recipient_email:recipient,subject,body\}\)/)
})
test('reminder draft editing renders localized fields',()=>{
 assert.match(page,/action=\{editPaymentReminderDraft\}/)
 assert.match(page,/recipient_email,subject,body,created_at/)
 assert.match(page,/nl:'Herinneringsconcept bewerken',fr:'Modifier le brouillon de rappel',en:'Edit reminder draft',de:'Erinnerungsentwurf bearbeiten'/)
})
