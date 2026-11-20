import test from 'node:test'
import assert from 'node:assert/strict'
import {detectPlanningConflicts,occupancyStatus} from '../lib/planning-rules.ts'
import {briefingNeedsConfirmation} from '../lib/briefing-versioning.ts'
import {timesheetCanSubmit} from '../lib/timesheet-approval.ts'
test('planning rejects invalid timestamps, rest thresholds and malformed existing shifts',()=>{
 const shift={id:'1',userId:'u',startsAt:100,endsAt:200}
 assert.deepEqual(detectPlanningConflicts({...shift,startsAt:NaN},[]),['invalid-range'])
 assert.deepEqual(detectPlanningConflicts(shift,[],Infinity),['invalid-range'])
 assert.ok(detectPlanningConflicts(shift,[{...shift,id:'2',endsAt:Infinity}]).includes('invalid-range'))
 assert.ok(detectPlanningConflicts(shift,[{...shift,id:'2',startsAt:150,endsAt:250}]).includes('overlap'))
 assert.equal(occupancyStatus(NaN,1),'understaffed')
})
test('briefing confirmation refuses impossible version or timestamps',()=>{
 const briefing={id:'b',eventId:'e',version:2,publishedAt:100,requiresReconfirmation:true}
 assert.equal(briefingNeedsConfirmation(briefing,{userId:'u',briefingVersion:3,confirmedAt:200}),true)
 assert.equal(briefingNeedsConfirmation(briefing,{userId:'u',briefingVersion:2,confirmedAt:200}),false)
 assert.equal(briefingNeedsConfirmation({...briefing,publishedAt:-1},null),true)
})
test('rejected timesheet requires a recorded review and rejection reason before resubmission',()=>{
 const base={userId:'u',eventId:'e',status:'rejected',submittedAt:100,reviewedAt:200,reviewedBy:'admin',rejectionReason:'Missing hours'}
 assert.equal(timesheetCanSubmit(base),true)
 assert.equal(timesheetCanSubmit({...base,rejectionReason:' '}),false)
 assert.equal(timesheetCanSubmit({...base,reviewedAt:null,reviewedBy:null}),false)
})
