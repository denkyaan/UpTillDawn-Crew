import test from 'node:test'
import assert from 'node:assert/strict'
import {validateProviderEventMappings,resolveProviderEvent} from '../lib/administration/provider-event-mapping.ts'
const eventId='12345678-1234-1234-1234-123456789abc'
const entry=(override={})=>({provider:'eventix',externalEventId:'event-123',eventId,enabled:true,...override})
test('valid mappings resolve Eventix and SumUp independently',()=>{
 const mappings=[entry(),entry({provider:'sumup'})]
 assert.equal(validateProviderEventMappings(mappings).errors.length,0)
 assert.equal(resolveProviderEvent('sumup','event-123',mappings),eventId)
 assert.equal(resolveProviderEvent('eventix','event-123',mappings),eventId)
})
test('unknown or disabled events cannot be imported',()=>{
 assert.equal(resolveProviderEvent('eventix','unknown',[entry()]),null)
 assert.equal(resolveProviderEvent('eventix','event-123',[entry({enabled:false})]),null)
})
test('rejects duplicate provider mappings atomically',()=>{
 const r=validateProviderEventMappings([entry(),entry({eventId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'})])
 assert.equal(r.mappings.length,0);assert.equal(r.errors.length,1)
})
test('rejects invalid external IDs, internal IDs and provider names',()=>{
 for(const bad of [entry({externalEventId:'../../etc'}),entry({eventId:'wrong'}),entry({provider:'other'}),entry({enabled:'yes'})])
  assert.ok(validateProviderEventMappings([bad]).errors.length)
})
test('ambiguous mappings never resolve an event',()=>{
 assert.equal(resolveProviderEvent('eventix','event-123',[entry(),entry()]),null)
})
