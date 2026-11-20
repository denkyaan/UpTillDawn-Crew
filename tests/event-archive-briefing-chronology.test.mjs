import test from 'node:test'
import assert from 'node:assert/strict'
import {eventCanArchive,eventCanRestore,eventIsReadOnly} from '../lib/event-archive-policy.ts'
import {briefingNeedsConfirmation} from '../lib/briefing-versioning.ts'
test('archive requires completed state without stale archive or restore metadata',()=>{
 const r={eventId:'event',state:'completed',completedAt:100}
 assert.equal(eventCanArchive(r),true)
 assert.equal(eventCanArchive({...r,archivedAt:150}),false)
 assert.equal(eventCanArchive({...r,restoredAt:90}),false)
})
test('restore rejects inconsistent completion/archive/restore chronology',()=>{
 const r={eventId:'event',state:'archived',completedAt:100,archivedAt:150}
 assert.equal(eventCanRestore(r),true)
 assert.equal(eventCanRestore({...r,completedAt:200}),false)
 assert.equal(eventCanRestore({...r,restoredAt:200}),false)
 assert.equal(eventCanRestore({...r,restoredAt:120}),true)
 assert.equal(eventIsReadOnly({...r,eventId:' '}),false)
})
test('current briefing confirmations must postdate publication',()=>{
 const v={id:'brief',eventId:'event',version:2,publishedAt:100,requiresReconfirmation:true}
 assert.equal(briefingNeedsConfirmation(v,{userId:'u',briefingVersion:2,confirmedAt:90}),true)
 assert.equal(briefingNeedsConfirmation(v,{userId:'u',briefingVersion:2,confirmedAt:100}),false)
 assert.equal(briefingNeedsConfirmation({...v,requiresReconfirmation:false},{userId:'u',briefingVersion:1,confirmedAt:50}),false)
})
