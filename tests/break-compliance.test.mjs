import test from 'node:test'
import assert from 'node:assert/strict'
import {breakIsDue,breakRequirementMet,remainingBreakMinutes} from '../lib/break-compliance.ts'
const policy={workMinutesBeforeBreak:360,minimumBreakMinutes:60}
const context={workedMinutes:400,breakMinutes:15,onBreak:false}
test('break compliance calculates valid thresholds and remaining minutes',()=>{
 assert.equal(breakIsDue(context,policy),true)
 assert.equal(breakRequirementMet(context,policy),false)
 assert.equal(remainingBreakMinutes(context,policy),45)
 assert.equal(breakIsDue({...context,onBreak:true},policy),false)
 assert.equal(breakRequirementMet({...context,breakMinutes:60},policy),true)
})
test('break compliance fails closed on invalid policy and time values',()=>{
 for(const [ctx,rule] of [
  [{...context,workedMinutes:NaN},policy],
  [{...context,breakMinutes:-1},policy],
  [{...context,breakMinutes:Infinity},policy],
  [{...context,onBreak:null},policy],
  [context,{...policy,minimumBreakMinutes:-1}],
  [context,{...policy,workMinutesBeforeBreak:NaN}],
 ]){
  assert.equal(breakIsDue(ctx,rule),false)
  assert.equal(breakRequirementMet(ctx,rule),false)
  assert.throws(()=>remainingBreakMinutes(ctx,rule),/Invalid break policy/)
 }
})
