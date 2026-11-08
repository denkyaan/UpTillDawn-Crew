import test from 'node:test'
import assert from 'node:assert/strict'
import {workplaceTransferIsValid,workplaceForTime} from '../lib/workplace-transfer.ts'
const base={userId:'u1',eventId:'e1',originalWorkplaceId:'bar',temporaryWorkplaceId:'ticket',startsAt:1000,endsAt:2000}
test('temporary workplace transfer validates identity and finite interval',()=>{
 assert.equal(workplaceTransferIsValid(base),true)
 for(const patch of [{userId:''},{eventId:' '},{originalWorkplaceId:''},{temporaryWorkplaceId:' '},{temporaryWorkplaceId:'bar'},{startsAt:NaN},{startsAt:Infinity},{endsAt:NaN},{endsAt:Infinity},{endsAt:1000},{endsAt:999}]){
  assert.equal(workplaceTransferIsValid({...base,...patch}),false,JSON.stringify(patch))
 }
 assert.equal(workplaceTransferIsValid({...base,endsAt:null}),true)
 assert.equal(workplaceTransferIsValid({...base,endsAt:0}),false)
})
test('workplace lookup respects start/end boundaries and ignores malformed transfers',()=>{
 assert.equal(workplaceForTime('bar',[base],999),'bar')
 assert.equal(workplaceForTime('bar',[base],1000),'ticket')
 assert.equal(workplaceForTime('bar',[base],1999),'ticket')
 assert.equal(workplaceForTime('bar',[base],2000),'bar')
 assert.equal(workplaceForTime('bar',[{...base,startsAt:NaN}],1500),'bar')
 assert.equal(workplaceForTime('bar',[base],NaN),'bar')
})
test('latest valid transfer wins and open-ended transfers remain active',()=>{
 const later={...base,temporaryWorkplaceId:'backstage',startsAt:1500,endsAt:null}
 assert.equal(workplaceForTime('bar',[base,later],1700),'backstage')
 assert.equal(workplaceForTime('bar',[later],5000),'backstage')
})
