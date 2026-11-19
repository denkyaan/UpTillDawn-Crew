import test from 'node:test'
import assert from 'node:assert/strict'
import {payrollCsv,PAYROLL_POLICY_VERSION} from '../lib/administration/payroll-export.ts'

const row={
 session_id:'session-1',event_id:'event-1',event_name:'Night Event',
 user_id:'staff-1',full_name:'Crew Member',timesheet_status:'approved',
 started_at:'2026-11-08T10:00:00Z',ended_at:'2026-11-08T12:00:00Z',
 gross_seconds:7200,break_seconds:1800,net_seconds:7200,policy_version:PAYROLL_POLICY_VERSION
}
test('approved and locked sessions export precise net hours',()=>{
 const csv=payrollCsv([row,{...row,session_id:'session-2',timesheet_status:'locked'}])
 assert.match(csv,/2\.000000/)
 assert.match(csv,/session-2/)
})
test('rejects missing payroll audit identity, duplicate sessions and unapproved status',()=>{
 for(const patch of [{session_id:''},{event_id:''},{event_name:' '},{user_id:''},{timesheet_status:'submitted'}]){
  assert.throws(()=>payrollCsv([{...row,...patch}]))
 }
 assert.throws(()=>payrollCsv([row,row]))
})
test('rejects fractional, negative and inconsistent timesheet seconds',()=>{
 for(const patch of [{gross_seconds:7200.5},{break_seconds:0.5},{net_seconds:5400.1},{break_seconds:7300},{net_seconds:5300},{net_seconds:7201},{policy_version:'legacy-all-breaks'},{gross_seconds:Number.MAX_SAFE_INTEGER}]){
  assert.throws(()=>payrollCsv([{...row,...patch}]))
 }
 assert.throws(()=>payrollCsv([{...row,ended_at:'2026-11-08T12:00:00.500Z'}]))
})
test('escapes spreadsheet formulas in names',()=>{
 assert.match(payrollCsv([{...row,full_name:'=SUM(1,2)'}]),/'=SUM\(1,2\)/)
})

test('rejects coercible payroll durations instead of silently converting them',()=>{
 for(const invalid of ['', ' ', '1e3', '01', '+10', '-0', '1.0', '0x10', 'Infinity', '9007199254740992']){
  assert.throws(()=>payrollCsv([{...row,break_seconds:invalid}]))
 }
 assert.match(payrollCsv([{...row,gross_seconds:'7200',break_seconds:'1800',net_seconds:'7200'}]),/2\.000000/)
})
test('rejects malformed, offset and impossible UTC payroll timestamps',()=>{
 for(const invalid of ['2026-11-08','2026-11-08T10:00:00+01:00','2026-02-30T10:00:00Z','2026-11-08T25:00:00Z','2026-11-08T10:00:00.1234Z','not-a-date']){
  assert.throws(()=>payrollCsv([{...row,started_at:invalid}]))
 }
})

test('paid first-hour break, 70-minute grace and deductible excess export with clear columns',()=>{
 const exact=payrollCsv([{...row,break_seconds:4200,net_seconds:7200}])
 assert.match(exact,/Deducted excess break seconds/)
 assert.match(exact,/7200,4200,0,7200,2\.000000/)
 const over=payrollCsv([{...row,break_seconds:4201,net_seconds:6599}])
 assert.match(over,/7200,4201,601,6599,1\.833056/)
 const split=payrollCsv([
  {...row,session_id:'one',break_seconds:3900,net_seconds:6900},
  {...row,session_id:'two',break_seconds:360,net_seconds:6840}
 ])
 assert.match(split,/7200,3900,300,6900/)
 assert.match(split,/7200,360,360,6840/)
})
test('legacy or missing database payroll version fails closed, not silently exported',()=>{
 assert.throws(()=>payrollCsv([{...row,policy_version:''}]))
 assert.throws(()=>payrollCsv([{...row,policy_version:'legacy'}]))
 assert.throws(()=>payrollCsv([{...row,policy_version:undefined}]))
})
