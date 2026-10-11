import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')
const catalog=await read('lib/training-exercise-catalog.ts')
const out=ts.transpileModule(catalog,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const ctx={exports:{},require(){throw Error('Training catalog must be isolated')}}
vm.runInNewContext(out,ctx)
test('all nondelegated worktime actions use domain controls and are browser-verified',async()=>{
 const [drill,page,ops,bots]=await Promise.all([
  read('components/training/sandbox-operational-drill.tsx'),read('app/(app)/operations/page.tsx'),
  read('components/training/sandbox-operations.tsx'),read('scripts/15-bot-browser-test.mjs'),
 ])
 const delegated=['operations:admin:6','operations:admin:7','operations:employee:0','operations:employee:2','operations:responsible_lead:0','operations:responsible_lead:1']
 for(const role of ['admin','responsible_lead','employee']){
  const operations=ctx.exports.getTrainingOperations(role,'operations')
  assert.ok(operations.length>=14)
  const owned=operations.filter(op=>!delegated.includes(op.id))
  assert.ok(owned.length>=12,role+' lacks functional worktime operations')
  for(const op of owned)assert.ok(drill.includes('data-training-practical-op={id}'),'role '+role+' missing functional worktime button')
 }
 assert.match(page,/SandboxOperationalDrill role=\{current\.role\}/)
 assert.match(drill,/data-demo-operations-operation=\{id\}/)
 assert.match(drill,/uptilldawn-worktime-drill-v1:/)
 assert.match(drill,/hours<=0\|\|hours>max/)
 assert.match(drill,/hours<=next\.daily/)
 assert.match(drill,/if\(!x\.locked\|\|x\.rejected/)
 assert.match(drill,/breakPhase!=="break"/)
 assert.match(ops,/uptilldawn-training-demo-phase-change/)
 assert.match(bots,/operationsReal=chapter==='operations'/)
 assert.match(bots,/Missing real worktime operations/)
 assert.match(bots,/Invalid hours advanced the tour/)
 for(const source of [drill,ops])assert.doesNotMatch(source,/supabase\.from\(|createClient\(|\.rpc\(/)
})
