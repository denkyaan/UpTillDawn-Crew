import test from 'node:test'
import assert from 'node:assert/strict'
import {allocateTime} from '../lib/crew-time.ts'
const session={id:'s',user_id:'u',event_id:'e',workplace_id:'bar',started_at:'2026-01-01T08:00Z',ended_at:'2026-01-01T12:00Z'}
test('time allocation rejects invalid allocation clocks',()=>{
 for(const now of [NaN,Infinity,-1])assert.throws(()=>allocateTime([session],[],[],now),/Invalid allocation clock/)
})
test('zero-length breaks are rejected rather than treated as a valid break',()=>{
 assert.throws(()=>allocateTime([session],[{work_session_id:'s',started_at:'2026-01-01T09:00Z',ended_at:'2026-01-01T09:00Z'}],[],0),/Invalid break interval/)
})
test('simultaneous workplace transitions are ambiguous and rejected',()=>{
 const transitions=[{work_session_id:'s',to_workplace_id:'ticket',confirmed_at:'2026-01-01T10:00Z'},{work_session_id:'s',to_workplace_id:'backstage',confirmed_at:'2026-01-01T10:00Z'}]
 assert.throws(()=>allocateTime([session],[],transitions,0),/Conflicting workplace transitions/)
})
test('ordered distinct workplace transitions preserve total allocated time',()=>{
 const transitions=[{work_session_id:'s',to_workplace_id:'ticket',confirmed_at:'2026-01-01T09:00Z'},{work_session_id:'s',to_workplace_id:'backstage',confirmed_at:'2026-01-01T10:00Z'}]
 const segments=allocateTime([session],[],transitions,0)
 assert.deepEqual(segments.map(s=>s.workplaceId),['bar','ticket','backstage'])
 assert.equal(segments.reduce((n,s)=>n+s.grossSeconds,0),14400)
})
