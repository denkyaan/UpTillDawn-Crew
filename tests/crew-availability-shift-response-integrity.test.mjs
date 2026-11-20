import test from 'node:test'
import assert from 'node:assert/strict'
import {availabilityWindowIsValid,availabilityWindowsOverlap,availabilityHasConflict,canAcceptShift,shiftResponseCanSubmit} from '../lib/crew-self-service.ts'
test('availability rejects negative timestamps and distinguishes adjacent windows',()=>{
 const a={startsAt:0,endsAt:100,status:'available'}
 const b={startsAt:100,endsAt:200,status:'unavailable'}
 assert.equal(availabilityWindowIsValid({...a,startsAt:-1}),false)
 assert.equal(availabilityWindowsOverlap(a,b),false)
 assert.equal(availabilityHasConflict(b,[a]),false)
 assert.equal(availabilityHasConflict({...b,startsAt:99},[a]),true)
 assert.equal(availabilityHasConflict({...b,startsAt:99,status:'available'},[a]),false)
})
test('shift responses enforce deadline, identity, valid clock and decline reason',()=>{
 const r={shiftId:'s',userId:'u',response:'pending',updatedAt:100}
 assert.equal(canAcceptShift({...r,updatedAt:-1}),false)
 assert.equal(shiftResponseCanSubmit(r,'accepted',200,150),true)
 assert.equal(shiftResponseCanSubmit(r,'accepted',200,201),false)
 assert.equal(shiftResponseCanSubmit(r,'declined',200,150),false)
 assert.equal(shiftResponseCanSubmit({...r,reason:'Unavailable'},'declined',200,150),true)
 assert.equal(shiftResponseCanSubmit({...r,updatedAt:180},'accepted',200,150),false)
 assert.equal(shiftResponseCanSubmit({...r,response:'accepted'},'accepted',200,150),false)
})
