import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
import vm from 'node:vm'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('task training covers actual staff/lead/Admin CRUD and every catalog action',async()=>{
 const [page,view,bot,catalog]=await Promise.all([
  read('app/(app)/tasks/page.tsx'),read('components/training/sandbox-task-training.tsx'),
  read('scripts/15-bot-browser-test.mjs'),read('lib/training-exercise-catalog.ts')
 ])
 assert.match(page,/if\(params\.tour==='1'\)return <SandboxTaskTraining role=\{current\.role\}\/>/)
 assert.match(view,/getTrainingOperations\(trainingRole,"tasks"\)/)
 assert.match(view,/data-training-preview-op=\{currentId\}/)
 assert.match(view,/data-training-practical-op=\{currentId\}/)
 assert.match(view,/detail:\{role:trainingRole,chapter:"tasks",id:currentId,kind:current\.kind,value\}/)
 assert.match(bot,/const tasksReal=chapter==='tasks'/)
 assert.match(bot,/data-demo-task-input/)
 assert.match(bot,/snapshot\.audit\?\.length!==total/)
 assert.doesNotMatch(view,/createClient\(|supabase\.from\(|\.rpc\(|fetch\(/)
 const compiled=ts.transpileModule(catalog,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const sandbox={exports:{},require(){throw new Error('No catalog dependencies')}}
 vm.runInNewContext(compiled,sandbox)
 const required={admin:{'tasks:admin:2':'select','tasks:admin:3':'select','tasks:admin:5':'select'},responsible_lead:{'tasks:responsible_lead:2':'select','tasks:responsible_lead:3':'select'},employee:{}}
 for(const role of Object.keys(required)){
  const ops=sandbox.exports.getTrainingOperations(role,'tasks')
  assert.ok(ops.length>=9)
  for(const [id,kind] of Object.entries(required[role])){
   assert.equal(ops.find(x=>x.id===id)?.kind,kind)
   assert.ok(bot.includes("'"+id+"':"))
  }
  for(const op of ops)for(const lang of ['nl','en','fr','de'])assert.ok(op.title[lang])
 }
})

test('task sandbox stores meaningful task changes and never grants cross-workplace permissions',async()=>{
 const src=await read('components/training/sandbox-task-training.tsx')
 assert.match(src,/task\.title=input\.trim\(\)/)
 assert.match(src,/task\.description=input\.trim\(\)/)
 assert.match(src,/task\.comments\.push\(input\.trim\(\)\)/)
 assert.match(src,/task\.assignees=\[\.\.\.new Set\(\[\.\.\.task\.assignees,selected\]\)\]/)
 assert.match(src,/task\.priority=selected/)
 assert.match(src,/task\.secondaryStatus="in_progress"/)
 assert.match(src,/sessionStorage\.setItem\(storage\(trainingRole\),JSON\.stringify\(next\)\)/)
})
