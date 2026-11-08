import test from 'node:test'
import assert from 'node:assert/strict'
import {shiftReminderShouldSend} from '../lib/shift-reminders.ts'
import {incidentNeedsEscalation} from '../lib/incident-workflow.ts'
test('shift reminders suppress already checked-in staff and reject invalid clocks',()=>{
 const base={shiftStartsAt:1_000_000}
 assert.equal(shiftReminderShouldSend('start-soon',base,1_000_000),true)
 assert.equal(shiftReminderShouldSend('start-soon',{...base,checkedInAt:900_000},1_000_000),false)
 assert.equal(shiftReminderShouldSend('start-soon',{...base,checkedInAt:1_100_000},1_000_000),true)
 for(const patch of [{shiftStartsAt:-1},{checkedInAt:-1},{checkedInAt:NaN}])
  assert.equal(shiftReminderShouldSend('start-soon',{...base,...patch},1_000_000),false)
 assert.equal(shiftReminderShouldSend('start-soon',base,-1),false)
})
test('incident escalation requires positive configured delay and chronological clocks',()=>{
 assert.equal(incidentNeedsEscalation('new',1000,301000,5),true)
 assert.equal(incidentNeedsEscalation('new',1000,1000,0),false)
 assert.equal(incidentNeedsEscalation('new',1000,61000,1),true)
 assert.equal(incidentNeedsEscalation('new',-1,301000,5),false)
 assert.equal(incidentNeedsEscalation('new',1000,-1,5),false)
})
