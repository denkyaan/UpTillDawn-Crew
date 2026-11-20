import test from 'node:test'
import assert from 'node:assert/strict'
import {overtimePolicyIsValid,netWorkMinutes,dailyOvertimeMinutes,weeklyOvertimeMinutes,overtimePeriodSummary,payrollOvertimeIsEnabled} from '../lib/overtime-policy.ts'
const policy={excludeBreaks:true,dailyThresholdMinutes:480,weeklyThresholdMinutes:2400,combinationRule:'greater-of-daily-or-weekly',payrollAuthoritative:true,policyVersion:'v1',effectiveFrom:'2026-01-01'}
test('overtime policy rejects invalid thresholds and combination rules',()=>{
 for(const patch of [{dailyThresholdMinutes:-1},{weeklyThresholdMinutes:Infinity},{dailyThresholdMinutes:480.5},{combinationRule:'unknown'},{payPeriod:'unknown'},{excludeBreaks:'yes'}]){
  const invalid={...policy,...patch}
  assert.equal(overtimePolicyIsValid(invalid),false)
  assert.equal(payrollOvertimeIsEnabled(invalid),false)
  assert.throws(()=>overtimePeriodSummary({dailyNetMinutes:[480],weeklyNetMinutes:480},invalid),/Invalid overtime policy/)
 }
})
test('work and overtime durations must be nonnegative integer minutes',()=>{
 for(const summary of [{workedMinutes:-1,breakMinutes:0},{workedMinutes:100,breakMinutes:101},{workedMinutes:100.5,breakMinutes:0},{workedMinutes:100,breakMinutes:NaN}])assert.throws(()=>netWorkMinutes(summary,policy),/Invalid work period summary/)
 assert.throws(()=>weeklyOvertimeMinutes(-1,policy),/Invalid weekly work minutes/)
 assert.throws(()=>overtimePeriodSummary({dailyNetMinutes:[100,NaN],weeklyNetMinutes:100},policy),/Invalid overtime period summary/)
})
test('valid overtime summary preserves daily and weekly calculations',()=>{
 assert.equal(netWorkMinutes({workedMinutes:600,breakMinutes:60},policy),540)
 assert.equal(dailyOvertimeMinutes({workedMinutes:600,breakMinutes:60},policy),60)
 assert.equal(weeklyOvertimeMinutes(2500,policy),100)
 const result=overtimePeriodSummary({dailyNetMinutes:[540,480,480,480,480],weeklyNetMinutes:2460},policy)
 assert.deepEqual([result.dailyOvertimeMinutes,result.weeklyOvertimeMinutes,result.payableOvertimeMinutes],[60,60,60])
 assert.equal(payrollOvertimeIsEnabled(policy),true)
})
