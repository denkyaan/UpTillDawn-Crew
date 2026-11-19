import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {withReadBudget,readBudgetStatus} from '../modern/src/lib/request-budget.ts'

test('local-first read scheduler caps concurrent Supabase requests at three',async()=>{
 let active=0,peak=0
 const tasks=Array.from({length:12},(_,i)=>
  withReadBudget(new AbortController().signal,async()=>{
   active++
   peak=Math.max(peak,active)
   await new Promise(resolve=>setTimeout(resolve,5))
   active--
   return i
  })
 )
 const result=await Promise.all(tasks)
 assert.deepEqual(result,Array.from({length:12},(_,i)=>i))
 assert.ok(peak<=3,'Concurrent requests '+peak+' exceeded 3')
 assert.ok(peak>=2,'Scheduler should permit parallel reads')
 assert.deepEqual(readBudgetStatus(),{active:0,queued:0})
})
test('cancelled queued work never starts, leaks no user data and does not block later reads',async()=>{
 const completions=[]
 const blockers=Array.from({length:3},()=>
  withReadBudget(new AbortController().signal,()=>
   new Promise(resolve=>completions.push(resolve))
  )
 )
 await Promise.resolve()
 assert.equal(readBudgetStatus().active,3)
 const controller=new AbortController()
 let executed=false
 const cancelled=withReadBudget(controller.signal,async()=>{executed=true})
 controller.abort()
 await assert.rejects(cancelled,{name:'AbortError'})
 assert.equal(executed,false)
 assert.equal(readBudgetStatus().queued,0)
 for(const resolve of completions)resolve('ok')
 await Promise.all(blockers)
 assert.deepEqual(readBudgetStatus(),{active:0,queued:0})
 const next=await withReadBudget(new AbortController().signal,async()=>42)
 assert.equal(next,42)
})
test('all data-access hooks use one per-device read budget, not a Worker queue',()=>{
 const paths=[
 'modern/src/lib/use-read.ts',
 'modern/src/lib/use-private-query.ts',
 'modern/src/screens/chats.tsx',
 'modern/src/screens/finance.tsx',
 'modern/src/screens/events.tsx'
 ]
 for(const p of paths)assert.ok(readFileSync(p,'utf8').includes('withReadBudget('),p)
 const source=readFileSync('modern/src/lib/request-budget.ts','utf8')
 assert.ok(source.includes('MAX_ACTIVE=3'))
 assert.ok(source.includes('MAX_QUEUED=16'))
 assert.ok(!source.includes('localStorage'))
 assert.ok(!source.includes('setInterval'))
 assert.ok(!source.includes('fetch('))
})

test('briefing two-read bundle stays sequential inside one scheduler slot',()=>{
 const source=readFileSync('modern/src/screens/briefings.tsx','utf8')
 assert.ok(source.includes('const briefings=await allowedBriefings(signal)'))
 assert.ok(source.includes('const acknowledgements=await ownAcknowledgements(uid,signal)'))
 assert.ok(!source.includes('Promise.all(['))
})
