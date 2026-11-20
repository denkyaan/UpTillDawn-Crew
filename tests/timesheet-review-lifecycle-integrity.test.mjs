import test from 'node:test'
import assert from 'node:assert/strict'
import {timesheetCanSubmit,timesheetCanReview,timesheetCanLock,rejectedTimesheetHasReason} from '../lib/timesheet-approval.ts'
const base={userId:'u1',eventId:'e1',status:'submitted',submittedAt:10}
test('submitted timesheet needs a valid timestamp and no previous review',()=>{
 assert.equal(timesheetCanReview(base),true)
 for(const patch of [{submittedAt:null},{submittedAt:NaN},{submittedAt:-1},{reviewedAt:11,reviewedBy:'admin'},{reviewedBy:'admin'},{reviewedAt:12},{userId:' '}])
  assert.equal(timesheetCanReview({...base,...patch}),false,JSON.stringify(patch))
})
test('approved timesheet requires chronological, attributable review before locking',()=>{
 const approved={...base,status:'approved',reviewedAt:20,reviewedBy:'admin'}
 assert.equal(timesheetCanLock(approved),true)
 for(const patch of [{reviewedAt:null},{reviewedBy:''},{reviewedAt:9},{reviewedAt:Infinity},{submittedAt:NaN},{eventId:''}])
  assert.equal(timesheetCanLock({...approved,...patch}),false,JSON.stringify(patch))
})
test('open and rejected timesheets can be resubmitted without invalid audit history',()=>{
 assert.equal(timesheetCanSubmit({userId:'u1',eventId:'e1',status:'open'}),true)
 assert.equal(timesheetCanSubmit({userId:'u1',eventId:'e1',status:'rejected',submittedAt:10,reviewedAt:20,reviewedBy:'admin',rejectionReason:'Missing clock-out'}),true)
 assert.equal(rejectedTimesheetHasReason({status:'rejected',rejectionReason:' '}),false)
})
