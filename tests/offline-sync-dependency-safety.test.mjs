import test from 'node:test'
import assert from 'node:assert/strict'
import {offlineMutationIsValid,mutationCanSync,planOfflineMutations,retryDelayMs,shouldRetryMutation} from '../lib/offline-sync-policy.ts'
const op=(id,patch={})=>({id,entity:'task',entityId:'task-1',operation:'update',createdAt:100,retryCount:0,status:'queued',...patch})
test('offline mutation validation rejects duplicates, self dependencies and malformed retries',()=>{
 assert.equal(offlineMutationIsValid(op('a',{dependsOn:['a']})),false)
 assert.equal(offlineMutationIsValid(op('a',{dependsOn:['b','b']})),false)
 assert.equal(offlineMutationIsValid(op('a',{retryCount:-1})),false)
 assert.equal(mutationCanSync(op('a',{dependsOn:['a']}),new Set(['a'])),false)
 assert.throws(()=>retryDelayMs(-1),/Invalid offline retry count/)
 assert.equal(shouldRetryMutation(op('a',{status:'failed',retryCount:5})),true)
 assert.equal(shouldRetryMutation(op('a',{status:'failed',retryCount:6})),false)
})
test('offline planner schedules only ready operations deterministically',()=>{
 const pending=[op('later',{createdAt:300,dependsOn:['first']}),op('first',{createdAt:200}),op('earliest',{createdAt:100})]
 assert.deepEqual(planOfflineMutations(pending,new Set()).map(x=>x.id),['earliest','first'])
 assert.deepEqual(planOfflineMutations(pending,new Set(['first'])).map(x=>x.id),['earliest','later'])
})
test('offline planner detects missing, cyclic and duplicate mutation ids',()=>{
 assert.throws(()=>planOfflineMutations([op('a',{dependsOn:['missing']})],new Set()),/Missing/)
 assert.throws(()=>planOfflineMutations([op('a',{dependsOn:['b']}),op('b',{dependsOn:['a']})],new Set()),/Circular/)
 assert.throws(()=>planOfflineMutations([op('a'),op('a')],new Set()),/duplicate/)
})
