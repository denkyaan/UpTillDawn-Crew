import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const api=readFileSync('app/api/administration/assistant/route.ts','utf8')
test('AI administration context includes finance and DJ follow-ups',()=>{
 for(const table of ['admin_artist_bookings','admin_financial_documents','admin_payment_reminders'])assert.ok(api.includes('db.from("'+table+'")'),table)
 for(const key of ['artistBookings','financialDocuments','paymentReminders'])assert.match(api,new RegExp(key+':'))
})
test('AI administration context does not include private artist notes or email addresses',()=>{
 assert.doesNotMatch(api,/select\([^\n]*(?:internal_notes|rider_notes|recipient_email|agency_contact_id)/)
 assert.match(api,/Financial and legal decisions require human approval/)
 assert.match(api,/Do not describe counts as complete totals|not complete totals/)
})
