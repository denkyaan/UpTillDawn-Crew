import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('every Admin, lead and Staff briefing step is backed by the demo or the existing genuine button',async()=>{
 const [page,view,bot,catalog]=await Promise.all([
  read('app/(app)/briefings/page.tsx'),read('components/training/sandbox-briefing-management-training.tsx'),
  read('scripts/15-bot-browser-test.mjs'),read('lib/training-exercise-catalog.ts')
 ])
 assert.match(page,/<SandboxBriefingManagementTraining role=\{user\.role\}\/>/)
 assert.match(view,/getTrainingOperations\(trainingRole,"briefings"\)/)
 assert.match(view,/data-training-preview-op=\{id\}/)
 assert.match(view,/data-training-practical-op=\{id\}/)
 assert.match(view,/detail:\{role:trainingRole,chapter:"briefings",id,kind:step\.kind,value:result\}/)
 assert.match(bot,/const briefingReal=chapter==='briefings'/)
 assert.match(bot,/snapshot\.audit\?\.length!==total-delegated/)
 assert.match(view,/next\.safety=result/)
 assert.match(view,/next\.checklist=result/)
 assert.match(view,/next\.attachments\.push\(file\)/)
 assert.match(view,/next\.notices\.push\(result\)/)
 assert.doesNotMatch(view,/createClient\(|supabase\.from\(|\.rpc\(|fetch\(/)
 const js=ts.transpileModule(catalog,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const context={exports:{},require(){throw Error('Catalog requires no imports')}}
 vm.runInNewContext(js,context)
 for(const role of ['admin','employee','responsible_lead']){
  const steps=context.exports.getTrainingOperations(role,'briefings')
  assert.ok(steps.length>=10)
  for(const step of steps)for(const lang of ['nl','fr','en','de'])assert.ok(step.title[lang])
 }
})

test('Admin acknowledgments have a full five-section prerequisite and scope is restricted to the assigned workplace',async()=>{
 const src=await read('components/training/sandbox-briefing-management-training.tsx')
 assert.match(src,/sections=\[0,1,2,3,4\]/)
 assert.match(src,/sections\.every\(x=>next\.reviewed\.includes\("briefings:shared:"\+x\)\)/)
 assert.match(src,/if\(!sections\.every/)
 assert.match(src,/next\.teamConfirmed=true/)
 assert.match(src,/next\.workplaceTitle=result/)
 assert.match(src,/sessionStorage\.setItem\(key\(trainingRole\),JSON\.stringify\(next\)\)/)
})
