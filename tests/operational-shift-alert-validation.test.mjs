import test from 'node:test'
import assert from 'node:assert/strict'
import {detectShiftAlerts,isUnderstaffed} from '../lib/operations-alerts.ts'
const base={now:5000000,plannedStart:1000000,plannedEnd:2000000,graceMinutes:10,maxBreakMinutes:30}
test('no-show applies only before arrival; missing checkout requires arrival',()=>{
 assert.deepEqual(detectShiftAlerts(base),['no-show'])
 assert.ok(detectShiftAlerts({...base,checkedInAt:0}).includes('missing-checkout'))
 assert.ok(!detectShiftAlerts({...base,checkedInAt:0}).includes('no-show'))
 assert.deepEqual(detectShiftAlerts({...base,checkedInAt:1000000,checkedOutAt:2000000}),[])
})
test('late arrival and long break require valid active session',()=>{
 const alerts=detectShiftAlerts({...base,checkedInAt:1800000,activeBreakStartedAt:2500000})
 assert.ok(alerts.includes('late-check-in'))
 assert.ok(alerts.includes('long-break'))
 assert.ok(!detectShiftAlerts({...base,checkedInAt:1800000,checkedOutAt:3000000,activeBreakStartedAt:2500000}).includes('long-break'))
})
test('invalid inputs cannot create misleading operational alerts',()=>{
 assert.deepEqual(detectShiftAlerts({...base,now:NaN}),[])
 assert.deepEqual(detectShiftAlerts({...base,plannedEnd:1000000}),[])
 assert.deepEqual(detectShiftAlerts({...base,graceMinutes:-1}),[])
 assert.equal(isUnderstaffed(NaN,1),true)
 assert.equal(isUnderstaffed(2,1),false)
})
