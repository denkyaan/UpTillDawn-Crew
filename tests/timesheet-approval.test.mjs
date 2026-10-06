import test from 'node:test'
import assert from 'node:assert/strict'
import {
  timesheetCanSubmit,
  timesheetCanReview,
  timesheetCanLock,
  rejectedTimesheetHasReason,
} from '../lib/timesheet-approval.ts'

const sheet=(status,extra={})=>({
  userId:'staff',
  eventId:'event',
  status,
  submittedAt:null,
  reviewedAt:null,
  reviewedBy:null,
  rejectionReason:null,
  ...extra,
})

test('timesheet submit gate only permits open and rejected states',()=>{
  for(const status of ['open','rejected']) assert.equal(timesheetCanSubmit(sheet(status)),true,status)
  for(const status of ['submitted','approved','locked']) assert.equal(timesheetCanSubmit(sheet(status)),false,status)
})

test('timesheet review gate only permits submitted state',()=>{
  for(const status of ['open','rejected','approved','locked']) assert.equal(timesheetCanReview(sheet(status)),false,status)
  assert.equal(timesheetCanReview(sheet('submitted')),true)
})

test('timesheet lock gate only permits approved state',()=>{
  for(const status of ['open','submitted','rejected','locked']) assert.equal(timesheetCanLock(sheet(status)),false,status)
  assert.equal(timesheetCanLock(sheet('approved')),true)
})

test('rejected timesheets require a non-whitespace rejection reason',()=>{
  assert.equal(rejectedTimesheetHasReason(sheet('rejected')),false)
  assert.equal(rejectedTimesheetHasReason(sheet('rejected',{rejectionReason:''})),false)
  assert.equal(rejectedTimesheetHasReason(sheet('rejected',{rejectionReason:'   '})),false)
  assert.equal(rejectedTimesheetHasReason(sheet('rejected',{rejectionReason:'uren controleren'})),true)
})

test('non-rejected timesheets never require a rejection reason',()=>{
  for(const status of ['open','submitted','approved','locked']) {
    assert.equal(rejectedTimesheetHasReason(sheet(status)),true,status)
  }
})
