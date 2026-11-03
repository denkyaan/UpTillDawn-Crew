import test from 'node:test'
import assert from 'node:assert/strict'
import {proposeProviderEventMappings} from '../lib/administration/provider-mapping-proposals.ts'
const id='123e4567-e89b-42d3-a456-426614174000'
const base={provider:'eventix',externalEventId:'ext-1',internalEventId:id,source:'verified-provider-id',evidenceId:'provider:event:1'}
const run=(candidates,existing=[],known=new Set([id]))=>proposeProviderEventMappings(candidates,existing,known)
test('verified evidence yields disabled proposal without side effects',()=>{
 const r=run([base]);assert.equal(r.proposals.length,1);assert.equal(r.proposals[0].enabled,false);assert.deepEqual(r.review,[])
})
test('ambiguous and name-only matches are always sent to review',()=>{
 assert.equal(run([base,{...base,evidenceId:'second'}]).proposals.length,0)
 assert.equal(run([{...base,source:'name-match'}]).review.length,1)
 assert.equal(run([{...base,source:'manual'}]).review.length,1)
})
test('unknown events, invalid ids and missing evidence cannot be proposed',()=>{
 assert.equal(run([base],[],new Set()).proposals.length,0)
 assert.equal(run([{...base,externalEventId:'bad id'}]).proposals.length,0)
 assert.equal(run([{...base,evidenceId:' '}]).proposals.length,0)
})
test('existing mappings are never overwritten or silently activated',()=>{
 const existing=[{provider:'eventix',externalEventId:'ext-1',eventId:id,enabled:false}]
 const r=run([base],existing);assert.equal(r.proposals.length,0);assert.equal(r.review.length,1)
})
test('separate providers may have the same external identifier',()=>{
 const r=run([base,{...base,provider:'sumup'}]);assert.equal(r.proposals.length,2)
})
