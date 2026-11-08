import test from 'node:test'
import assert from 'node:assert/strict'
import {shiftReminderAt,shiftReminderShouldSend} from '../lib/shift-reminders.ts'
import {incidentRequiresImmediatePush,incidentNeedsEscalation} from '../lib/incident-workflow.ts'
test('shift reminders reject malformed times and unknown kinds',()=>{
 assert.equal(Number.isNaN(shiftReminderAt('unknown',{shiftStartsAt:1000000})),true)
 assert.equal(Number.isNaN(shiftReminderAt('day-before',{shiftStartsAt:-1})),true)
 assert.equal(shiftReminderShouldSend('unknown',{shiftStartsAt:1000000},2000000),false)
 assert.equal(shiftReminderShouldSend('late-check-in',{shiftStartsAt:1000000},1600000),true)
 assert.equal(shiftReminderShouldSend('late-check-in',{shiftStartsAt:1000000,checkedInAt:1000000},1600000),false)
})
test('incident urgency is restricted to recognized categories and urgency levels',()=>{
 assert.equal(incidentRequiresImmediatePush('medical','normal'),true)
 assert.equal(incidentRequiresImmediatePush('equipment','urgent'),true)
 assert.equal(incidentRequiresImmediatePush('equipment','normal'),false)
 assert.equal(incidentRequiresImmediatePush('unknown','urgent'),false)
 assert.equal(incidentRequiresImmediatePush('medical','unknown'),false)
 assert.equal(incidentNeedsEscalation('new',0,300000),true)
 assert.equal(incidentNeedsEscalation('resolved',0,300000),false)
})
