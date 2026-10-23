import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('all three roles learn real submit and audit steps and driver users operate 12 actual trip actions',async()=>{
 const [page,view,bot,catalog]=await Promise.all([
  read('app/(app)/operations/page.tsx'),read('components/training/sandbox-lifecycle-training.tsx'),
  read('scripts/15-bot-browser-test.mjs'),read('lib/training-exercise-catalog.ts')
 ])
 const compiled=ts.transpileModule(catalog,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const sandbox={exports:{},require(){throw new Error('Unexpected catalog dependency')}}
 vm.runInNewContext(compiled,sandbox)
 for(const role of ['employee','responsible_lead','admin']){
  const steps=sandbox.exports.getTrainingOperations(role,'timesheet')
  assert.ok(steps.length>=10)
  assert.equal(steps.at(-1).id,'timesheet:'+role+':'+(role==='admin'?6:3))
  for(const step of steps)for(const lang of ['nl','fr','en','de'])assert.ok(step.title[lang])
 }
 assert.equal(sandbox.exports.getTrainingOperations('employee','driver').length,12)
 assert.match(page,/<SandboxLifecycleTraining role=\{current\.role\}\/>/)
 assert.match(view,/getTrainingOperations\(trainingRole,chapter\)/)
 assert.match(view,/data-training-lifecycle=\{chapter\}/)
 assert.match(view,/data-training-practical-op=\{current\.id\}/)
 assert.match(view,/detail:\{role:trainingRole,chapter,id:current\.id,kind:current\.kind,value\}/)
 assert.match(bot,/const lifecycleReal=\['driver','timesheet'\]/)
 assert.match(bot,/!state\.backstage/)
 assert.match(bot,/!state\.locked/)
 assert.match(bot,/!state\.submitted/)
})

test('driver only resumes event time after simulated return, with fictional km and backstage proof',async()=>{
 const view=await read('components/training/sandbox-lifecycle-training.tsx')
 assert.match(view,/if\(idx===6\)/)
 assert.match(view,/next\.phase="driving"/)
 assert.match(view,/next\.phase="return-driving"/)
 assert.match(view,/if\(next\.phase!=="return-driving"\)return/)
 assert.match(view,/next\.phase="event-time-resumed";next\.kilometers=22\.4/)
 assert.match(view,/next\.backstage=true/)
 assert.match(view,/data-demo-driver-backstage/)
 assert.match(view,/sessionStorage\.setItem\(store\(trainingRole,chapter\),JSON\.stringify\(next\)\)/)
 assert.doesNotMatch(view,/supabase\.from\(|createClient\(|\.rpc\(|fetch\(/)
})

test('admin reviews two fictional timesheets, rejects with reason and locks only the approved sheet',async()=>{
 const view=await read('components/training/sandbox-lifecycle-training.tsx')
 assert.match(view,/if\(idx===2\)\{next\.approved=true/)
 assert.match(view,/if\(idx===4\)\{if\(next\.reason\.length<5\)return;next\.rejected=true\}/)
 assert.match(view,/if\(idx===5\)\{if\(!next\.approved\|\|!next\.rejected\)return;next\.locked=true\}/)
 assert.match(view,/data-demo-lifecycle-reason/)
 assert.match(view,/data-demo-lifecycle-select/)
 assert.match(view,/data-demo-timesheet-submitted/)
})
