import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('every overview training step uses the actual role-scoped visible interactive panel',async()=>{
 const [demo,view,bots,catalog]=await Promise.all([
  read('components/tour-active-event-demo.tsx'),
  read('components/training/sandbox-overview-training.tsx'),
  read('scripts/15-bot-browser-test.mjs'),
  read('lib/training-exercise-catalog.ts')
 ])
 assert.match(demo,/pathname==="\/"\|\|pathname==="\/admin"/)
 assert.match(demo,/<SandboxOverviewTraining role=\{role\}\/>/)
 assert.match(view,/getTrainingOperations\(role,"overview"\)/)
 assert.match(view,/data-training-preview-op=\{id\}/)
 assert.match(view,/data-training-practical-op=\{id\}/)
 assert.match(view,/disabled=\{!ready\|\|\(current\.kind==="inspect"&&!opened\)\}/)
 assert.match(view,/detail:\{role,chapter:"overview",id,kind:current\.kind,value\}/)
 assert.match(view,/sessionStorage\.setItem\(key\(role\),JSON\.stringify\(next\)\)/)
 assert.doesNotMatch(view,/supabase\.from\(|createClient\(|\.rpc\(|fetch\(/)
 assert.match(bots,/if\(firstChapter==='overview'\)/)
 assert.match(bots,/data-demo-overview-preference/)
 assert.match(bots,/state\.visited\?\.length!==total/)
 const transpiled=ts.transpileModule(catalog,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const box={exports:{},require(){throw new Error('no catalog dependencies')}}
 vm.runInNewContext(transpiled,box)
 for(const role of ['admin','employee','responsible_lead']){
  const steps=box.exports.getTrainingOperations(role,'overview')
  assert.ok(steps.length>=13)
  assert.equal(steps[6].id,'overview:shared:6')
  assert.equal(steps[6].kind,'write')
  assert.equal(steps[7].id,'overview:shared:7')
  assert.equal(steps[7].kind,'select')
  for(const step of steps)for(const lang of ['nl','en','fr','de'])assert.ok(step.title[lang]?.length>4)
 }
})

test('overview preference requires fictional verification and mandatory profile completion',async()=>{
 const source=await read('components/training/sandbox-overview-training.tsx')
 assert.match(source,/next\.registrationVerified=true/)
 assert.match(source,/if\(!next\.registrationVerified\|\|draft\.trim\(\)\.length<5\)/)
 assert.match(source,/if\(!next\.profile\|\|!selected\)/)
 assert.match(source,/next\.preferred=selected/)
 assert.match(source,/sessionStorage\.setItem\("uptilldawn-training-preferred-workplace",selected\)/)
 assert.match(source,/data-demo-overview-detail=\{id\}/)
})
