import test from 'node:test'
import assert from 'node:assert/strict'
import {submitTimesheet,reviewTimesheet,lockTimesheet,timesheetCanReview} from '../lib/timesheet-approval.ts'
const initial={userId:'worker',eventId:'event',status:'open'}
test('timesheet follows submit approve and immutable lock sequence',()=>{
 const submitted=submitTimesheet(initial,100)
 const approved=reviewTimesheet(submitted,'approved','manager',200)
 const locked=lockTimesheet(approved)
 assert.deepEqual([submitted.status,approved.status,locked.status],['submitted','approved','locked'])
 assert.equal(initial.status,'open')
 assert.throws(()=>submitTimesheet(locked,300),/cannot be submitted/)
 assert.throws(()=>reviewTimesheet(approved,'rejected','manager',300),/cannot be reviewed/)
})
test('rejection requires a reason and resubmission clears previous review',()=>{
 const submitted=submitTimesheet(initial,100)
 assert.throws(()=>reviewTimesheet(submitted,'rejected','manager',200),/requires a reason/)
 const rejected=reviewTimesheet(submitted,'rejected','manager',200,'Incorrect break')
 const resubmitted=submitTimesheet(rejected,300)
 assert.equal(resubmitted.status,'submitted')
 assert.equal(resubmitted.reviewedAt,null)
 assert.equal(resubmitted.reviewedBy,null)
 assert.equal(resubmitted.rejectionReason,null)
 assert.equal(timesheetCanReview(resubmitted),true)
 assert.throws(()=>submitTimesheet(rejected,199),/previous review/)
})
test('timesheet review rejects self-approval and invalid chronology',()=>{
 const submitted=submitTimesheet(initial,100)
 assert.throws(()=>reviewTimesheet(submitted,'approved','worker',200),/Invalid timesheet reviewer/)
 assert.throws(()=>reviewTimesheet(submitted,'approved','manager',99),/Invalid review timestamp/)
 assert.throws(()=>submitTimesheet(initial,-1),/cannot be submitted/)
 assert.throws(()=>submitTimesheet(initial,1.5),/cannot be submitted/)
})
