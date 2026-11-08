import test from 'node:test'
import assert from 'node:assert/strict'
import {planOfflineMutations} from '../lib/offline-sync-policy.ts'
import {reconnectDelayMs,shouldReconnect,realtimeConnectionIsStale} from '../lib/realtime-reconnect.ts'
import {requestTimeoutMs,requestTimedOut} from '../lib/request-timeout-policy.ts'
const op=(id,dependsOn=[])=>({id,entity:'task',entityId:'task',operation:'update',createdAt:1,retryCount:0,status:'queued',dependsOn})
test('completed offline operations are never replayed even if still queued',()=>{
 const mutations=[op('done'),op('ready',['done']),op('waiting',['ready'])]
 assert.deepEqual(planOfflineMutations(mutations,new Set(['done'])).map(x=>x.id),['ready'])
})
test('reconnect state rejects malformed attempts and clock values',()=>{
 assert.throws(()=>reconnectDelayMs(NaN),/Invalid reconnect attempt count/)
 assert.throws(()=>reconnectDelayMs(-1),/Invalid reconnect attempt count/)
 assert.equal(shouldReconnect({connected:false,attempts:-1}),false)
 assert.equal(shouldReconnect({connected:false,attempts:19}),true)
 assert.equal(shouldReconnect({connected:false,attempts:20}),false)
 assert.equal(realtimeConnectionIsStale({connected:true,lastConnectedAt:100},200,50),true)
 assert.equal(realtimeConnectionIsStale({connected:true,lastConnectedAt:100},50,10),false)
 assert.equal(realtimeConnectionIsStale({connected:true,lastConnectedAt:100},200,NaN),false)
})
test('request timeouts fail closed for unknown classes and invalid clocks',()=>{
 assert.throws(()=>requestTimeoutMs('invalid'),/Invalid request class/)
 assert.equal(requestTimedOut(1000,'interactive',9000),true)
 assert.equal(requestTimedOut(1000,'interactive',8999),false)
 assert.equal(requestTimedOut(-1,'interactive',9000),false)
 assert.equal(requestTimedOut(1000,'interactive',NaN),false)
 assert.equal(requestTimedOut(1000,'interactive',900),false)
})
