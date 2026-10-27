import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const sql=readFileSync('supabase/migrations/20261027210000_administration_payment_reminders.sql','utf8')
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('reminder drafts require overdue unpaid invoices and admin approval',()=>{
 assert.match(sql,/original_doc\.due_date>=current_date/)
 assert.match(sql,/original_doc\.gross_amount<=paid_total/)
 assert.match(sql,/not public\.upt_is_admin\(\)/)
 assert.match(sql,/status='draft'/)
 assert.match(sql,/Reminder identity and finalized reminders are immutable/)
})
test('finance UI prepares reminder drafts without sending email',()=>{
 assert.match(page,/async function createPaymentReminder/)
 assert.match(page,/async function updatePaymentReminder/)
 assert.match(page,/action=\{createPaymentReminder\}/)
 assert.match(page,/action=\{updatePaymentReminder\}/)
 assert.match(page,/no automatic sending/)
})
