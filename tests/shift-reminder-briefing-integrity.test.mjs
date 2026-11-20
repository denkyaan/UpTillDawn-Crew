import test from 'node:test'
import assert from 'node:assert/strict'
import {shiftReminderShouldSend,shiftReminderAt} from '../lib/shift-reminders.ts'
import {briefingNeedsConfirmation,nextBriefingVersion} from '../lib/briefing-versioning.ts'
test('shift reminder suppresses late check-in after any recorded arrival',()=>{
 const base={shiftStartsAt:1000000}
 assert.equal(shiftReminderShouldSend('late-check-in',base,1600000),true)
 assert.equal(shiftReminderShouldSend('late-check-in',{...base,checkedInAt:0},1600000),false)
 assert.equal(shiftReminderShouldSend('late-check-in',{...base,checkedInAt:1000000},1600000),false)
 assert.equal(shiftReminderAt('day-before',base),1000000-86400000)
})
test('shift reminders fail closed for invalid timestamps and unknown types',()=>{
 const base={shiftStartsAt:1000000}
 for(const patch of [{shiftStartsAt:NaN},{shiftStartsAt:Infinity},{checkedInAt:NaN},{checkedInAt:Infinity}]){
  assert.equal(shiftReminderShouldSend('late-check-in',{...base,...patch},1600000),false)
 }
 assert.equal(shiftReminderShouldSend('late-check-in',base,NaN),false)
 assert.equal(shiftReminderShouldSend('unknown',base,1600000),false)
})
test('briefing reconfirmation rejects malformed and stale acknowledgements',()=>{
 const version={id:'b1',eventId:'e1',version:2,publishedAt:2000,requiresReconfirmation:true}
 const confirmation={userId:'u1',briefingVersion:2,confirmedAt:3000}
 assert.equal(briefingNeedsConfirmation(version,confirmation),false)
 assert.equal(briefingNeedsConfirmation(version,{...confirmation,confirmedAt:1000}),true)
 assert.equal(briefingNeedsConfirmation(version,{...confirmation,userId:' '}),true)
 assert.equal(briefingNeedsConfirmation(version,{...confirmation,briefingVersion:NaN}),true)
 assert.equal(briefingNeedsConfirmation({...version,version:NaN},confirmation),true)
 assert.equal(briefingNeedsConfirmation({...version,id:''},confirmation),true)
 assert.equal(briefingNeedsConfirmation(version,{...confirmation,briefingVersion:1}),true)
 assert.equal(briefingNeedsConfirmation({...version,requiresReconfirmation:false},{...confirmation,briefingVersion:1}),false)
})
test('briefing version increment only accepts nonnegative safe integers',()=>{
 assert.equal(nextBriefingVersion(0),1)
 assert.equal(nextBriefingVersion(2),3)
 for(const value of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER])assert.throws(()=>nextBriefingVersion(value),/Invalid briefing version/)
})
