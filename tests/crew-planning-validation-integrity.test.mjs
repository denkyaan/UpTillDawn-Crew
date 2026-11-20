import test from 'node:test'
import assert from 'node:assert/strict'
import {shiftChangeIsReadyForApproval} from '../lib/shift-change-requests.ts'
import {coverageCount,coverageShortfall,requirementIsCovered,coverageWindows} from '../lib/staffing-coverage.ts'
import {canTransitionEvent} from '../lib/event-lifecycle.ts'
test('shift changes reject negative timestamps and malformed claims',()=>{
 const request={id:'r1',type:'claim-open-shift',shiftId:'s1',requesterId:'u1',status:'pending',createdAt:0}
 assert.equal(shiftChangeIsReadyForApproval(request),true)
 assert.equal(shiftChangeIsReadyForApproval({...request,createdAt:-1}),false)
 assert.equal(shiftChangeIsReadyForApproval({...request,replacementUserId:'u2'}),false)
})
test('staffing coverage refuses invalid staffing windows and quantities',()=>{
 const req={workplaceId:'bar',startsAt:1000,endsAt:2000,requiredStaff:1}
 const valid={workplaceId:'bar',startsAt:500,endsAt:2500}
 assert.equal(coverageCount(req,[valid]),1)
 assert.equal(requirementIsCovered(req,[valid]),true)
 assert.equal(coverageCount(req,[{...valid,endsAt:Infinity}]),0)
 assert.equal(coverageShortfall({...req,requiredStaff:-1},[valid]),Infinity)
 assert.equal(requirementIsCovered({...req,requiredStaff:-1},[valid]),false)
 assert.deepEqual(coverageWindows({...req,requiredStaff:1.5},[valid]),[])
})
test('event transitions reject unknown phases without throwing',()=>{
 assert.equal(canTransitionEvent('planning','published'),true)
 assert.equal(canTransitionEvent('unknown','published'),false)
 assert.equal(canTransitionEvent('planning','unknown'),false)
})
