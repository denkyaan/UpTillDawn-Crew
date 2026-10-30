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

test('draft and approval both reconcile credit notes before permitting reminders',()=>{
 assert.match(page,/async function reminderOutstanding/)
 assert.match(page,/\.eq\('kind','credit_note'\)\.eq\('original_invoice_id',documentId\)/)
 assert.match(page,/\['approved','issued','paid'\]\.includes\(credit\.status\)/)
 assert.match(page,/reminderOutstanding\(supabase as unknown as SupabaseClient,documentId/)
 assert.match(page,/reminderOutstanding\(supabase as unknown as SupabaseClient,reminder\.document_id/)
 assert.match(page,/outstanding===null\|\|outstanding<=0\.005/)
 assert.match(page,/invoice\.due_date>=belgianToday\(\)/)
})

test('database trigger enforces credit-adjusted overdue sales invoices',()=>{
 const migration=readFileSync('supabase/migrations/20261030123000_administration_reminder_credit_balance_guard.sql','utf8')
 assert.match(migration,/create or replace function public\.upt_admin_guard_payment_reminder/)
 assert.match(migration,/original_doc\.kind<>'sales_invoice'/)
 assert.match(migration,/original_invoice_id=new\.document_id/)
 assert.match(migration,/status in \('approved','issued','paid'\)/)
 assert.match(migration,/original_doc\.gross_amount<=paid_total\+credited_total/)
 assert.match(migration,/Europe\/Brussels/)
 assert.match(migration,/new\.status<>'cancelled'/)
 assert.match(migration,/not public\.upt_is_admin\(\)/)
 assert.match(migration,/revoke execute on function/)
})
