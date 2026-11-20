import test from 'node:test'
import assert from 'node:assert/strict'
import {allocateTime} from '../lib/crew-time.ts'
const session=(id,start,end)=>({id,user_id:'u',event_id:'e',workplace_id:'bar',started_at:start,ended_at:end})
test('60 minute allowance shared across sessions: 10h gross,75min break = 9h45',()=>{
 const sessions=[session('a','2026-01-01T08:00Z','2026-01-01T13:00Z'),session('b','2026-01-01T14:00Z','2026-01-01T19:00Z')]
 const breaks=[{work_session_id:'a',started_at:'2026-01-01T10:00Z',ended_at:'2026-01-01T11:00Z'},{work_session_id:'b',started_at:'2026-01-01T16:00Z',ended_at:'2026-01-01T16:15Z'}]
 const rows=allocateTime(sessions,breaks,[],0);assert.equal(rows.reduce((a,b)=>a+b.netSeconds,0),35100);assert.equal(rows[1].excessBreakSeconds,900)
})
test('transition splits breaks without counting time twice',()=>{
 const rows=allocateTime([session('a','2026-01-01T08:00Z','2026-01-01T18:00Z')],[{work_session_id:'a',started_at:'2026-01-01T12:00Z',ended_at:'2026-01-01T13:15Z'}],[{work_session_id:'a',to_workplace_id:'ticket',confirmed_at:'2026-01-01T12:30Z'}],0)
 assert.equal(rows.length,2);assert.equal(rows.reduce((n,r)=>n+r.grossSeconds,0),36000);assert.equal(rows.reduce((n,r)=>n+r.netSeconds,0),35100);assert.equal(rows[1].workplaceId,'ticket')
})
test('midnight and DST use elapsed UTC time',()=>{
 for(const [start,end,expected] of [['2026-03-29T01:00:00+01:00','2026-03-29T04:00:00+02:00',7200],['2026-10-25T01:00:00+02:00','2026-10-25T04:00:00+01:00',14400],['2026-01-01T23:00Z','2026-01-02T02:00Z',10800]])assert.equal(allocateTime([session('s',start,end)],[],[],0)[0].grossSeconds,expected)
})
test('overlapping corrected sessions fail instead of silently doubling payroll',()=>{assert.throws(()=>allocateTime([session('a','2026-01-01T08:00Z','2026-01-01T13:00Z'),session('b','2026-01-01T12:00Z','2026-01-01T14:00Z')],[],[],0),/Overlapping/)})

test('rejects duplicate and missing session identities before payroll allocation',()=>{
 const first=session('a','2026-01-01T08:00Z','2026-01-01T12:00Z')
 assert.throws(()=>allocateTime([first,{...first}],[],[],0),/duplicate work session/)
 for(const patch of [{id:''},{user_id:''},{event_id:''}]){
  assert.throws(()=>allocateTime([{...first,...patch}],[],[],0),/session identity/)
 }
})
test('rejects invalid and orphan break intervals instead of silently dropping them',()=>{
 const first=session('a','2026-01-01T08:00Z','2026-01-01T12:00Z')
 const good={work_session_id:'a',started_at:'2026-01-01T09:00Z',ended_at:'2026-01-01T09:30Z'}
 for(const patch of [{work_session_id:'missing'},{started_at:'invalid'},{ended_at:'invalid'},{ended_at:'2026-01-01T08:00Z'}]){
  assert.throws(()=>allocateTime([first],[{...good,...patch}],[],0),/Invalid break interval/)
 }
})
test('rejects orphan and malformed workplace transitions',()=>{
 const first=session('a','2026-01-01T08:00Z','2026-01-01T12:00Z')
 const good={work_session_id:'a',to_workplace_id:'bar',confirmed_at:'2026-01-01T09:00Z'}
 for(const patch of [{work_session_id:'missing'},{to_workplace_id:''},{confirmed_at:'invalid'}]){
  assert.throws(()=>allocateTime([first],[],[{...good,...patch}],0),/Invalid workplace transition/)
 }
})

test('rejects breaks that cross a work-session boundary',()=>{
 const first=session('a','2026-01-01T08:00Z','2026-01-01T12:00Z')
 for(const [started_at,ended_at] of [
  ['2026-01-01T07:59Z','2026-01-01T09:00Z'],
  ['2026-01-01T11:00Z','2026-01-01T12:01Z'],
  ['2026-01-01T13:00Z','2026-01-01T14:00Z']
 ]){
  assert.throws(()=>allocateTime([first],[{work_session_id:'a',started_at,ended_at}],[],0),/Invalid break interval/)
 }
})
test('rejects workplace transitions outside their session',()=>{
 const first=session('a','2026-01-01T08:00Z','2026-01-01T12:00Z')
 for(const confirmed_at of ['2026-01-01T07:59Z','2026-01-01T12:00Z','2026-01-01T12:01Z']){
  assert.throws(()=>allocateTime([first],[],[{work_session_id:'a',to_workplace_id:'ticket',confirmed_at}],0),/Invalid workplace transition/)
 }
})
test('preserves valid in-session breaks and workplace transitions',()=>{
 const first=session('a','2026-01-01T08:00Z','2026-01-01T12:00Z')
 const rows=allocateTime([first],[{work_session_id:'a',started_at:'2026-01-01T09:00Z',ended_at:'2026-01-01T09:30Z'}],[{work_session_id:'a',to_workplace_id:'ticket',confirmed_at:'2026-01-01T10:00Z'}],0)
 assert.equal(rows.length,2)
 assert.equal(rows.reduce((total,row)=>total+row.grossSeconds,0),14400)
 assert.equal(rows.reduce((total,row)=>total+row.regularBreakSeconds,0),1800)
 assert.equal(rows[1].workplaceId,'ticket')
})
