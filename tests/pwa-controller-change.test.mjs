import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'

const source=readFileSync('components/pwa-register.tsx','utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText

function mount({controller=null,user=null,pending=false}={}){
 const events=new Map(),windowEvents=new Map()
 let reloads=0,queued=pending
 const registration={update:async()=>{},addEventListener:()=>{},waiting:null}
 const worker={controller,ready:Promise.resolve(registration),register:async()=>registration,
  addEventListener:(name,handler)=>events.set(name,handler),removeEventListener:name=>events.delete(name)}
 const modules={
  react:{useEffect:effect=>effect()},
  'next/navigation':{useRouter:()=>({refresh:()=>{}})},
  '@/lib/providers':{useAuth:()=>({user,profile:user?{approved:true}:null,loading:false})},
  '@/lib/push-client':{clearLocalPushSubscription:async()=>{},supportsWebPush:()=>false},
  '@/lib/crew-queue':{queued:async()=>queued?[{}]:[],queuedUploads:async()=>[],synchronize:async()=>{}},
 }
 const exports={}
 runInNewContext(compiled,{exports,require:name=>{
  assert.ok(modules[name],'Unexpected import: '+name)
  return modules[name]
 },navigator:{serviceWorker:worker,onLine:true},document:{visibilityState:'visible',addEventListener:()=>{},removeEventListener:()=>{}},
 window:{location:{reload:()=>reloads++},addEventListener:(name,handler)=>windowEvents.set(name,handler),removeEventListener:name=>windowEvents.delete(name),setInterval:()=>1,clearInterval:()=>{}},console})
 exports.PwaRegister()
 return {
  get reloads(){return reloads},
  setQueued:value=>{queued=value},
  change:async controller=>{worker.controller=controller;events.get('controllerchange')();await new Promise(setImmediate)},
  queueChanged:async()=>{windowEvents.get('crew-queue-change')();await new Promise(setImmediate)},
 }
}

test('first service worker activation leaves an open form on the current page',async()=>{
 const page=mount(),initialWorker={}
 await page.change(initialWorker)
 assert.equal(page.reloads,0,'First installation must not reload and interrupt a form submission')
 await page.change(initialWorker)
 assert.equal(page.reloads,0,'A duplicate controller event must not reload')
 await page.change({})
 assert.equal(page.reloads,1,'A later replacement must still load the updated application')
})

test('an existing controller reloads only when a different worker replaces it',async()=>{
 const initialWorker={},page=mount({controller:initialWorker})
 await page.change(initialWorker)
 assert.equal(page.reloads,0)
 await page.change(null)
 assert.equal(page.reloads,0)
 await page.change({})
 assert.equal(page.reloads,0,'Claiming an uncontrolled page is not a replacement')
 await page.change({})
 assert.equal(page.reloads,1)
})

test('a real update waits for unsynchronized crew data before reloading',async()=>{
 const page=mount({controller:{},user:{id:'qa-user'},pending:true})
 await page.change({})
 assert.equal(page.reloads,0)
 page.setQueued(false)
 await page.queueChanged()
 assert.equal(page.reloads,1)
})
