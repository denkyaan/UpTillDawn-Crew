import test from 'node:test'
import assert from 'node:assert/strict'
import {timeCorrectionIsValid as requestValid,timeCorrectionCanReview} from '../lib/time-correction.ts'
import {timeCorrectionIsValid as auditValid,timeCorrectionIsApproved} from '../lib/time-correction-policy.ts'
import {workplaceTransferIsValid,workplaceForTime} from '../lib/workplace-transfer.ts'
test('time correction request audit must have paired reviewer and review timestamp',()=>{
 const request={id:'r',userId:'u',shiftId:'s',reason:'forgot check-in',status:'pending',createdAt:100,requestedStartAt:110}
 assert.equal(requestValid(request),true)
 assert.equal(timeCorrectionCanReview(request),true)
 assert.equal(requestValid({...request,reviewedBy:'admin'}),false)
 assert.equal(requestValid({...request,reviewedAt:200}),false)
 assert.equal(requestValid({...request,status:'unknown'}),false)
})
test('correction audit requires recognized reason and complete approval metadata',()=>{
 const correction={entryId:'e',requestedBy:'u',reason:'wrong-time',explanation:'correct time',originalMinutes:60,correctedMinutes:90}
 assert.equal(auditValid(correction),true)
 assert.equal(auditValid({...correction,reason:'arbitrary'}),false)
 assert.equal(auditValid({...correction,approvedBy:'admin'}),false)
 assert.equal(auditValid({...correction,approvedAt:100}),false)
 assert.equal(timeCorrectionIsApproved({...correction,approvedBy:'admin',approvedAt:0}),true)
})
test('temporary workplace transfer rejects negative times and whitespace-identical workplaces',()=>{
 const transfer={userId:'u',eventId:'e',originalWorkplaceId:'bar',temporaryWorkplaceId:'entrance',startsAt:100,endsAt:200}
 assert.equal(workplaceTransferIsValid(transfer),true)
 assert.equal(workplaceTransferIsValid({...transfer,startsAt:-1}),false)
 assert.equal(workplaceTransferIsValid({...transfer,temporaryWorkplaceId:' bar '}),false)
 assert.equal(workplaceForTime('bar',[transfer],150),'entrance')
 assert.equal(workplaceForTime('bar',[transfer],200),'bar')
})
