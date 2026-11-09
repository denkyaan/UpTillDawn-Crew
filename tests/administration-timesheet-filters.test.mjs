import test from 'node:test'
import assert from 'node:assert/strict'
import {
 ADMINISTRATION_TIMESHEET_PAGE_SIZE,
 ADMINISTRATION_TIMESHEET_STATUSES,
 parseAdministrationTimesheetFilters,
 administrationTimesheetHref,
} from '../lib/administration/timesheet-filters.ts'
const event='11111111-1111-4111-8111-111111111111'
const user='22222222-2222-4222-8222-222222222222'

test('administration timesheet filters accept only valid identifiers, statuses and pages',()=>{
 assert.deepEqual(parseAdministrationTimesheetFilters({event,user,status:'approved',page:'2'}),{
  eventFilter:event,userFilter:user,statusFilter:'approved',page:2,
 })
 for(const invalid of ['../../admin','1234',[],null,{},'https://example.com']){
  assert.equal(parseAdministrationTimesheetFilters({event:invalid,user:invalid}).eventFilter,null)
  assert.equal(parseAdministrationTimesheetFilters({event:invalid,user:invalid}).userFilter,null)
 }
 for(const invalid of ['0','-1','1e3','1.5','1%00','100000',[],null]){
  assert.equal(parseAdministrationTimesheetFilters({page:invalid}).page,1)
 }
 assert.equal(parseAdministrationTimesheetFilters({page:'99999'}).page,10000)
 assert.equal(parseAdministrationTimesheetFilters({status:'deleted'}).statusFilter,null)
 assert.equal(ADMINISTRATION_TIMESHEET_PAGE_SIZE,25)
 assert.deepEqual(ADMINISTRATION_TIMESHEET_STATUSES,['open','submitted','approved','rejected','locked'])
})
test('same-portal timesheet links preserve filters and normalize untrusted values',()=>{
 assert.equal(
  administrationTimesheetHref('approved',3,event,user),
  '/portals/administration/timesheets?event='+event+'&user='+user+'&status=approved&page=3',
 )
 assert.equal(
  administrationTimesheetHref(null,1,event,null),
  '/portals/administration/timesheets?event='+event,
 )
 assert.equal(administrationTimesheetHref(null,1,null,null),'/portals/administration/timesheets')
 assert.equal(administrationTimesheetHref(null,0,'invalid','invalid'),'/portals/administration/timesheets')
 assert.equal(administrationTimesheetHref('rejected',2,event,user).includes('mode=review'),false)
})
test('administration timesheet URL helpers keep user and event context independently',()=>{
 const eventOnly=administrationTimesheetHref('submitted',1,event,null)
 const staffOnly=administrationTimesheetHref('submitted',1,null,user)
 assert.equal(new URL(eventOnly,'https://example.com').searchParams.get('user'),null)
 assert.equal(new URL(staffOnly,'https://example.com').searchParams.get('event'),null)
 assert.equal(new URL(eventOnly,'https://example.com').searchParams.get('event'),event)
 assert.equal(new URL(staffOnly,'https://example.com').searchParams.get('user'),user)
})
