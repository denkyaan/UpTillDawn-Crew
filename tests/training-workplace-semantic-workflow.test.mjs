import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
import vm from 'node:vm'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('workplace demo covers actual assignments, Driver trips, price lists and staff role scope',async()=>{
 const [page,view,bot,catalog]=await Promise.all([
  read('app/(app)/workplaces/page.tsx'),read('components/training/sandbox-workplace-training.tsx'),
  read('scripts/15-bot-browser-test.mjs'),read('lib/training-exercise-catalog.ts')
 ])
 assert.match(page,/<SandboxWorkplaceTraining role=\{current\.role\}\/>/)
 assert.match(view,/getTrainingOperations\(trainingRole,"workplaces"\)/)
 assert.match(view,/data-training-preview-op=\{id\}/)
 assert.match(view,/data-training-practical-op=\{id\}/)
 assert.match(view,/detail:\{role:trainingRole,chapter:"workplaces",id,kind:current\.kind,value\}/)
 assert.match(bot,/const workplaceReal=chapter==='workplaces'/)
 assert.match(bot,/snapshot\.audit\?\.length!==total-delegated/)
 assert.match(view,/next\.staff=\[\.\.\.new Set/)
 assert.match(view,/next\.pickup=begin/)
 assert.match(view,/next\.files\.push\(file\)/)
 assert.match(view,/next\.favorite=selection/)
 assert.doesNotMatch(view,/createClient\(|supabase\.from\(|\.rpc\(|fetch\(/)
 const js=ts.transpileModule(catalog,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const context={exports:{},require(){throw Error('Catalog has no runtime deps')}}
 vm.runInNewContext(js,context)
 const expected={
  admin:['workplaces:admin:1','workplaces:admin:2','workplaces:admin:4','workplaces:admin:5','workplaces:admin:8'],
  responsible_lead:['workplaces:responsible_lead:1'],
  employee:['workplaces:employee:1']
 }
 for(const [role,ids] of Object.entries(expected)){
  const ops=context.exports.getTrainingOperations(role,'workplaces')
  assert.ok(ops.length>9)
  for(const id of ids){assert.equal(ops.find(x=>x.id===id)?.kind,'select');assert.ok(bot.includes("'"+id+"':"))}
  for(const op of ops)for(const lang of ['nl','fr','en','de'])assert.ok(op.title[lang])
 }
})

test('original Admin save-shift and price entry buttons stay real, not replaced by generic exercises',async()=>{
 const app=await read('components/training/sandbox-admin-manager.tsx')
 const view=await read('components/training/sandbox-workplace-training.tsx')
 for(const id of ['workplaces:admin:0','workplaces:admin:17']){
  assert.ok(app.includes('data-training-practical-op="'+id+'"'))
  assert.ok(view.includes('"'+id+'"'))
 }
})
