import test from 'node:test'
import assert from 'node:assert/strict'
import {responsibleAssignmentsOverlap,responsibleHasConflict,workplaceHasResponsible} from '../lib/responsible-coverage.ts'
import {responsibleCoverageGaps,responsibleCoverageIsComplete} from '../lib/responsible-coverage-health.ts'
import {eventCanArchive,eventCanRestore} from '../lib/event-archive-policy.ts'
test('responsible assignment checks reject invalid shifts without false coverage',()=>{
 const a={userId:'u1',workplaceId:'bar',startsAt:100,endsAt:200}
 assert.equal(responsibleAssignmentsOverlap(a,{...a,startsAt:150,endsAt:250}),true)
 assert.equal(responsibleAssignmentsOverlap(a,{...a,endsAt:Infinity}),false)
 assert.equal(responsibleHasConflict({...a,startsAt:-1},[]),true)
 assert.equal(workplaceHasResponsible('bar',150,[{...a,startsAt:NaN}]),false)
 assert.equal(workplaceHasResponsible('bar',150,[a]),true)
})
test('coverage health never marks invalid scheduled shifts as complete',()=>{
 const shift={userId:'u1',workplaceId:'bar',startsAt:100,endsAt:200}
 const roles=[{userId:'u1',workplaceId:'bar'}]
 assert.deepEqual(responsibleCoverageGaps('bar',[shift],roles),[])
 assert.equal(responsibleCoverageIsComplete('bar',[shift],roles),true)
 assert.equal(responsibleCoverageIsComplete('bar',[{...shift,endsAt:NaN}],roles),false)
 assert.equal(responsibleCoverageIsComplete('bar',[{...shift,startsAt:-10}],roles),false)
})
test('archive and restore require valid event identity and finite timestamps',()=>{
 const record={eventId:'event-1',state:'completed',completedAt:0}
 assert.equal(eventCanArchive(record),true)
 assert.equal(eventCanArchive({...record,completedAt:-1}),false)
 assert.equal(eventCanArchive({...record,completedAt:Infinity}),false)
 assert.equal(eventCanArchive({...record,eventId:' '}),false)
 assert.equal(eventCanRestore({eventId:'event-1',state:'archived',archivedAt:0}),true)
 assert.equal(eventCanRestore({eventId:'event-1',state:'archived',archivedAt:NaN}),false)
})
