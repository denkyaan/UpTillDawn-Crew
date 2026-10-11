import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
import vm from 'node:vm'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('events tutorial executes real role-scoped availability, waitlist and Admin event lifecycle actions',async()=>{
 const [page,view,bot,catalog]=await Promise.all([
  read('app/(app)/events/page.tsx'),read('components/training/sandbox-event-training.tsx'),
  read('scripts/15-bot-browser-test.mjs'),read('lib/training-exercise-catalog.ts')
 ])
 assert.match(page,/<SandboxEventTraining role=\{user\.role\}\/>/)
 assert.match(view,/getTrainingOperations\(trainingRole,"events"\)/)
 assert.match(view,/data-training-preview-op=\{id\}/)
 assert.match(view,/data-training-practical-op=\{id\}/)
 assert.match(view,/detail:\{role:trainingRole,chapter:"events",id,kind:current\.kind,value:result\}/)
 assert.match(bot,/const eventsReal=chapter==='events'/)
 assert.match(bot,/data-demo-event-operation/)
 assert.match(bot,/snapshot\.audit\?\.length!==total-delegated/)
 assert.match(view,/next\.assigned=selection/)
 assert.match(view,/next\.waitlist=true/)
 assert.match(view,/next\.setup=selection/)
 assert.match(view,/next\.breakdown=selection/)
 assert.doesNotMatch(view,/createClient\(|supabase\.from\(|\.rpc\(|fetch\(/)
 const js=ts.transpileModule(catalog,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const context={exports:{},require(){throw Error('Catalog has no runtime dependency')}}
 vm.runInNewContext(js,context)
 const choices={
  admin:{'events:admin:5':'select','events:admin:9':'select'},
  employee:{'events:employee:0':'select'},
  responsible_lead:{}
 }
 for(const [role,specific] of Object.entries(choices)){
  const ops=context.exports.getTrainingOperations(role,'events')
  const roleShared=role==='admin'?[]:['events:shared:3','events:shared:4','events:shared:5']
  for(const id of [...roleShared,...Object.keys(specific)]){
   assert.equal(ops.find(x=>x.id===id)?.kind,'select',id)
   assert.ok(bot.includes("'"+id+"':"),'real bot select for '+id)
  }
  assert.ok(ops.length>10)
 }
})

test('Admin event publish, archive and restore continue through genuine existing buttons',async()=>{
 const eventView=await read('components/training/sandbox-event-training.tsx')
 const manager=await read('components/training/sandbox-admin-manager.tsx')
 const bots=await read('scripts/15-bot-browser-test.mjs')
 for(const [id,data] of [['events:admin:6','publish-event'],['events:admin:12','archive-event'],['events:admin:14','restore-event']]){
  assert.ok(eventView.includes('"'+id+'"'),'delegated workflow ID '+id)
  assert.ok(manager.includes('data-training-practical-op="'+id+'"'),'existing real action '+id)
  assert.ok(manager.includes('data-training-admin-action="'+data+'"'))
  assert.ok(bots.includes("'"+id+"':'"+data+"'"))
 }
})
