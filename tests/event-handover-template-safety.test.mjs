import test from 'node:test'
import assert from 'node:assert/strict'
import {handoverCanBeAccepted} from '../lib/shift-handover.ts'
import {eventIsEditable,canTransitionEvent} from '../lib/event-lifecycle.ts'
import {normalizeTemplateSelection,templateIncludes} from '../lib/event-template.ts'
test('handover rejects invalid negative creation time and accepts valid ready handover',()=>{
 const h={id:'h',eventId:'e',workplaceId:'bar',outgoingResponsibleId:'u1',incomingResponsibleId:'u2',status:'ready',openTaskIds:[],openIncidentIds:[],createdAt:0}
 assert.equal(handoverCanBeAccepted(h),true)
 assert.equal(handoverCanBeAccepted({...h,createdAt:-1}),false)
})
test('unknown lifecycle states cannot be editable or transitioned',()=>{
 assert.equal(eventIsEditable('unknown'),false)
 assert.equal(eventIsEditable('archived'),false)
 assert.equal(eventIsEditable('live'),true)
 assert.equal(canTransitionEvent('unknown','live'),false)
})
test('template selection tolerates malformed sections and disallows unknown sections',()=>{
 assert.deepEqual(normalizeTemplateSelection({sections:null}),[])
 assert.deepEqual(normalizeTemplateSelection({sections:['shifts','shifts','tasks','unknown']}),['shifts','tasks'])
 assert.equal(templateIncludes({sections:['unknown']},'unknown'),false)
 assert.equal(templateIncludes({sections:['shifts']},'shifts'),true)
})
