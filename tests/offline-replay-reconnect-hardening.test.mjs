import test from 'node:test'
import assert from 'node:assert/strict'
import {planOfflineMutations,ensureOfflineReplayOwner} from '../lib/offline-sync-policy.ts'
import {readFile} from 'node:fs/promises'
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

test('offline replay refuses signed-out, cross-user and blank identities',()=>{
 assert.doesNotThrow(()=>ensureOfflineReplayOwner('crew-a','crew-a','operations'))
 assert.doesNotThrow(()=>ensureOfflineReplayOwner('crew-a','crew-a','uploads'))
 for(const current of [null,undefined,'crew-b','']){
  assert.throws(()=>ensureOfflineReplayOwner('crew-a',current,'operations'),/SYNC_SESSION_MISMATCH/)
  assert.throws(()=>ensureOfflineReplayOwner('crew-a',current,'uploads'),/UPLOAD_SESSION_MISMATCH/)
 }
 assert.throws(()=>ensureOfflineReplayOwner('  ','  ','operations'),/SYNC_SESSION_MISMATCH/)
})
test('live queue guards both replay locks and rechecks identities for every operation and upload',async()=>{
 const source=await readFile(new URL('../lib/crew-queue.ts',import.meta.url),'utf8')
 assert.match(source,/let uploadRunning:Promise<void>\|null=null/)
 assert.match(source,/let uploadRunningUserId:string\|null=null/)
 assert.match(source,/let runningUserId:string\|null=null/)
 assert.match(source,/if\(uploadRunning\)[\s\S]*?ensureOfflineReplayOwner\(userId,uploadRunningUserId,'uploads'\)/)
 assert.match(source,/if\(running\)[\s\S]*?ensureOfflineReplayOwner\(userId,runningUserId,'operations'\)/)
 assert.match(source,/for\(const upload of await queuedUploads\(userId\)\)[\s\S]*?ensureOfflineReplayOwner\(userId,activeUser\?\.id,'uploads'\)/)
 assert.match(source,/for\(const op of await queued\(userId\)\)[\s\S]*?ensureOfflineReplayOwner\(userId,activeUser\?\.id,'operations'\)/)
 assert.match(source,/uploadRunning=null;uploadRunningUserId=null/)
 assert.match(source,/running=null;runningUserId=null/)
})
