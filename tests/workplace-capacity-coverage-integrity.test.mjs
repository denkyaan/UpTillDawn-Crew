import test from 'node:test'
import assert from 'node:assert/strict'
import {workplaceCapacityIsValid,workplaceStaffingState,staffNeededForTarget} from '../lib/workplace-capacity.ts'
import {coverageWindows,coverageShortfall} from '../lib/staffing-coverage.ts'
test('workplace capacity requires valid identity and ordered integer staffing limits',()=>{
 const c={workplaceId:'bar',minimumStaff:2,targetStaff:3,maximumStaff:5}
 assert.equal(workplaceCapacityIsValid(c),true)
 for(const invalid of [{...c,workplaceId:' '},{...c,minimumStaff:1.5},{...c,targetStaff:NaN},{...c,maximumStaff:Infinity},{...c,maximumStaff:2}])assert.equal(workplaceCapacityIsValid(invalid),false)
 assert.equal(workplaceStaffingState(c,1),'understaffed')
 assert.equal(workplaceStaffingState(c,3),'target')
 assert.equal(workplaceStaffingState(c,6),'overstaffed')
 assert.equal(staffNeededForTarget(c,1),2)
})
test('malformed occupancy cannot be reported as adequately staffed',()=>{
 const c={workplaceId:'bar',minimumStaff:2,targetStaff:3}
 assert.equal(workplaceStaffingState(c,NaN),'understaffed')
 assert.equal(workplaceStaffingState({...c,targetStaff:NaN},3),'understaffed')
 assert.equal(staffNeededForTarget(c,NaN),0)
})
test('coverage windows expose concurrent understaffing boundaries',()=>{
 const requirement={workplaceId:'bar',startsAt:0,endsAt:100,requiredStaff:2}
 const shifts=[{workplaceId:'bar',startsAt:0,endsAt:50},{workplaceId:'bar',startsAt:25,endsAt:100}]
 assert.deepEqual(coverageWindows(requirement,shifts).map(w=>w.shortfall),[1,0,1])
 assert.equal(coverageShortfall(requirement,shifts),2)
})
