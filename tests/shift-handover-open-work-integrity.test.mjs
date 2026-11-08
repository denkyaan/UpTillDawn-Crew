import test from 'node:test'
import assert from 'node:assert/strict'
import {handoverCanBeAccepted,handoverHasOpenWork} from '../lib/shift-handover.ts'
const base={id:'h1',eventId:'e1',workplaceId:'w1',outgoingResponsibleId:'a',incomingResponsibleId:'b',status:'ready',openTaskIds:['t1'],openIncidentIds:['i1'],createdAt:0,acceptedAt:null}
test('ready handover accepts unique valid open work',()=>{
 assert.equal(handoverCanBeAccepted(base),true)
 assert.equal(handoverHasOpenWork(base),true)
 assert.equal(handoverCanBeAccepted({...base,openTaskIds:[],openIncidentIds:[]}),true)
 assert.equal(handoverHasOpenWork({...base,openTaskIds:[],openIncidentIds:[]}),false)
})
test('handover rejects malformed or duplicate open work identifiers',()=>{
 for(const patch of [
  {openTaskIds:['t1','t1']},{openTaskIds:['t1',' t1 ']},{openIncidentIds:['i1','i1']},
  {openTaskIds:[' ']},{openIncidentIds:['']},{openTaskIds:null},{openIncidentIds:null},
  {openTaskIds:[null]},{openIncidentIds:[12]}
 ]){
  const handover={...base,...patch}
  assert.equal(handoverCanBeAccepted(handover),false,JSON.stringify(patch))
  assert.equal(handoverHasOpenWork(handover),false,JSON.stringify(patch))
 }
})
test('handover enforces distinct responsible identities and lifecycle',()=>{
 for(const patch of [{status:'draft'},{status:'accepted'},{incomingResponsibleId:'a'},{acceptedAt:0},{createdAt:NaN},{id:' '}])assert.equal(handoverCanBeAccepted({...base,...patch}),false)
})
