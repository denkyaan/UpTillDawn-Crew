import test from 'node:test'
import assert from 'node:assert/strict'
import {timeCorrectionIsValid as requestValid,timeCorrectionCanReview} from '../lib/time-correction.ts'
import {timeCorrectionIsValid as policyValid,timeCorrectionChangesValue,timeCorrectionIsApproved} from '../lib/time-correction-policy.ts'
const request={id:'r1',userId:'u1',shiftId:'s1',reason:'Forgot clock-out',status:'pending',createdAt:0,requestedStartAt:0,requestedEndAt:60}
const policy={entryId:'e1',requestedBy:'u1',reason:'wrong-time',explanation:'Verified clock',originalMinutes:60,correctedMinutes:90}
test('time correction request requires identity and finite chronological timestamps',()=>{
 assert.equal(requestValid(request),true)
 assert.equal(timeCorrectionCanReview(request),true)
 for(const patch of [{id:' '},{userId:''},{shiftId:' '},{reason:''},{createdAt:NaN},{createdAt:-1},{requestedStartAt:Infinity},{requestedEndAt:NaN},{requestedEndAt:-1},{requestedEndAt:0},{reviewedAt:-1}]){
  assert.equal(requestValid({...request,...patch}),false,JSON.stringify(patch))
 }
 for(const patch of [{status:'approved'},{reviewedBy:'reviewer'},{reviewedAt:0}])assert.equal(timeCorrectionCanReview({...request,...patch}),false)
})
test('time correction policy rejects fractional and nonfinite minutes',()=>{
 assert.equal(policyValid(policy),true)
 assert.equal(timeCorrectionChangesValue(policy),true)
 for(const value of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
  assert.equal(policyValid({...policy,correctedMinutes:value}),false)
  assert.equal(timeCorrectionChangesValue({...policy,correctedMinutes:value}),false)
 }
 assert.equal(timeCorrectionIsApproved({...policy,approvedBy:'admin',approvedAt:0}),true)
 assert.equal(timeCorrectionIsApproved({...policy,approvedBy:'admin',approvedAt:NaN}),false)
 assert.equal(timeCorrectionIsApproved({...policy,approvedBy:'admin',approvedAt:-1}),false)
})
