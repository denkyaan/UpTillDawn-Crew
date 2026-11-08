import test from 'node:test'
import assert from 'node:assert/strict'
import {payrollCsv} from '../lib/administration/payroll-export.ts'

const row={
 session_id:'session-1',event_id:'event-1',event_name:'Night Event',
 user_id:'staff-1',full_name:'Crew Member',timesheet_status:'approved',
 started_at:'2026-11-08T10:00:00Z',ended_at:'2026-11-08T12:00:00Z',
 gross_seconds:7200,break_seconds:1800,net_seconds:5400
}
test('approved and locked sessions export precise net hours',()=>{
 const csv=payrollCsv([row,{...row,session_id:'session-2',timesheet_status:'locked'}])
 assert.match(csv,/1\.500000/)
 assert.match(csv,/session-2/)
})
test('rejects missing payroll audit identity, duplicate sessions and unapproved status',()=>{
 for(const patch of [{session_id:''},{event_id:''},{event_name:' '},{user_id:''},{timesheet_status:'submitted'}]){
  assert.throws(()=>payrollCsv([{...row,...patch}]))
 }
 assert.throws(()=>payrollCsv([row,row]))
})
test('rejects fractional, negative and inconsistent timesheet seconds',()=>{
 for(const patch of [{gross_seconds:7200.5},{break_seconds:0.5},{net_seconds:5400.1},{break_seconds:7300},{net_seconds:5300},{gross_seconds:Number.MAX_SAFE_INTEGER}]){
  assert.throws(()=>payrollCsv([{...row,...patch}]))
 }
 assert.throws(()=>payrollCsv([{...row,ended_at:'2026-11-08T12:00:00.500Z'}]))
})
test('escapes spreadsheet formulas in names',()=>{
 assert.match(payrollCsv([{...row,full_name:'=SUM(1,2)'}]),/'=SUM\(1,2\)/)
})
