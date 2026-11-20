import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {administrationDeadline} from '../lib/administration/deadline.ts'
import {payrollCsv} from '../lib/administration/payroll-export.ts'
import {validateTicketSalesCsv} from '../lib/administration/ticket-import.ts'

test('Belgian deadlines honor winter, summer and transition-day offsets',()=>{
 assert.equal(administrationDeadline('2026-10-30'),'2026-10-30T22:59:59.000Z')
 assert.equal(administrationDeadline('2026-07-01'),'2026-07-01T21:59:59.000Z')
 assert.equal(administrationDeadline('2026-03-29'),'2026-03-29T21:59:59.000Z')
 assert.equal(administrationDeadline('2026-10-25'),'2026-10-25T22:59:59.000Z')
 assert.throws(()=>administrationDeadline('2026-02-30'))
})
test('ticket timestamps accept valid time zones across UTC midnight and reject impossible clocks',()=>{
 const header='external_id,event_id,quantity,gross_amount,currency,sold_at\n'
 const parse=date=>validateTicketSalesCsv(header+'A,evt,1,10.01,EUR,'+date,'evt')
 assert.equal(parse('2026-10-30T00:30:00+02:00').rows[0].soldAt,'2026-10-29T22:30:00.000Z')
 for(const bad of ['2026-10-30T24:00:00Z','2026-02-30T12:00:00+01:00','2026-10-30T12:00:00+15:00','2026-10-30T12:00:00+14:30'])assert.ok(parse(bad).errors.length)
})
const row={session_id:'session-1',event_id:'event-1',event_name:'=HYPERLINK("bad")',user_id:'user-1',full_name:'QA',timesheet_status:'approved',started_at:'2026-10-30T10:00:00Z',ended_at:'2026-10-30T12:00:00Z',gross_seconds:7200,break_seconds:1800,net_seconds:5400}
test('payroll exports exact recorded seconds, decimal hours and spreadsheet-safe text',()=>{
 const csv=payrollCsv([row]);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"1.500000"'));assert.ok(csv.includes("'=HYPERLINK"))
})
test('payroll rejects pending, duplicate and inconsistent time records',()=>{
 assert.throws(()=>payrollCsv([{...row,timesheet_status:'submitted'}]))
 assert.throws(()=>payrollCsv([row,row]))
 assert.throws(()=>payrollCsv([{...row,net_seconds:7000}]))
 assert.throws(()=>payrollCsv([{...row,gross_seconds:0,break_seconds:0,net_seconds:0}]))
})
test('actual finance input regexes accept valid dates, spaced IBANs and agency emails',()=>{
 const finance=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
 const dateSource=finance.match(/const datePattern=(\/.*?\/)/)[1]
 const datePattern=Function('return '+dateSource)()
 assert.ok(datePattern.test('2026-10-30'));assert.ok(!datePattern.test('wrong'))
 const emailSource=finance.match(/email&&!\/(.*?)\/\.test\(email\)/)[1]
 const emailPattern=new RegExp(emailSource)
 assert.ok(emailPattern.test('sales@artist.agency'));assert.ok(!emailPattern.test('wrong email'))
 const ibanSource=finance.match(/get\('iban'\).*?replace\((\/.*?\/g),/)[1]
 assert.equal('BE68 5390 0754 7034'.replace(Function('return '+ibanSource)(),''),'BE68539007547034')
})
