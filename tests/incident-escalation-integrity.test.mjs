import test from 'node:test'
import assert from 'node:assert/strict'
import {canTransitionIncident,incidentNeedsEscalation} from '../lib/incident-workflow.ts'
import {escalationIsDue,escalationDelayMs,escalationTarget} from '../lib/escalation-policy.ts'
test('incident transitions reject unknown statuses without throwing',()=>{
 assert.equal(canTransitionIncident('new','seen'),true)
 assert.equal(canTransitionIncident('resolved','in-progress'),true)
 assert.equal(canTransitionIncident('unknown','seen'),false)
 assert.equal(canTransitionIncident('new','unknown'),false)
})
test('incident escalation respects five-minute boundary and invalid clocks',()=>{
 assert.equal(incidentNeedsEscalation('new',1000,301000),true)
 assert.equal(incidentNeedsEscalation('new',1000,300999),false)
 assert.equal(incidentNeedsEscalation('resolved',1000,301000),false)
 for(const [created,now,minutes] of [[NaN,301000,5],[1000,Infinity,5],[1000,0,5],[1000,301000,NaN],[1000,301000,-1]]){
  assert.equal(incidentNeedsEscalation('new',created,now,minutes),false)
 }
})
test('operational escalation respects urgency, resolution and timestamp integrity',()=>{
 const base={type:'unresolved-help',createdAt:1000,responsibleAvailable:true}
 assert.equal(escalationDelayMs('unresolved-help'),300000)
 assert.equal(escalationTarget(base),'responsible')
 assert.equal(escalationTarget({...base,type:'urgent-incident'}),'admin')
 assert.equal(escalationIsDue(base,301000),true)
 assert.equal(escalationIsDue({...base,resolvedAt:2000},301000),false)
 assert.equal(escalationIsDue({...base,resolvedAt:0},301000),false)
 for(const patch of [{createdAt:NaN},{createdAt:Infinity},{createdAt:400000},{type:'unknown'}]){
  assert.equal(escalationIsDue({...base,...patch},301000),false)
 }
 assert.equal(escalationIsDue(base,Infinity),false)
})
