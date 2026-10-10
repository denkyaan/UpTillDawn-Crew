import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
import vm from 'node:vm'
import {getTourChapters} from '../lib/tour-training.ts'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('Help routes expose one role-scoped interactive guide only in tour mode',async()=>{
 const [route,index,help]=await Promise.all([
  read('app/(app)/help/page.tsx'),
  read('components/training/tour-help-index.tsx'),
  read('components/training/sandbox-help-training.tsx')
 ])
 assert.match(route,/training=\{params\.tour==="1"\}/)
 assert.match(index,/training&&<SandboxHelpTraining role=\{role\}\/>/)
 assert.match(help,/getTrainingOperations\(role,"help"\)/)
 assert.match(help,/data-training-help="true"/)
 assert.match(help,/data-demo-help-open/)
 assert.match(help,/data-demo-help-search/)
 assert.match(help,/data-training-practical-op=\{id\}/)
 assert.match(help,/disabled=\{!hydrated\|\|\(current\.kind==="inspect"&&opened!==id\)\}/)
 assert.match(help,/detail:\{role,chapter:"help",id,kind:current\.kind,value\}/)
 assert.doesNotMatch(help,/createClient\(|supabase\.from\(|\.rpc\(|fetch\(/,'Help sandbox must not change production records')
})

test('all three roles complete every Help article in all four languages',async()=>{
 const catalog=await read('lib/training-exercise-catalog.ts')
 const compiled=ts.transpileModule(catalog,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const sandbox={exports:{},require(){throw new Error('Unexpected catalog dependency')}}
 vm.runInNewContext(compiled,sandbox)
 for(const role of ['admin','employee','responsible_lead']){
  assert.ok(getTourChapters(role,{scope:'general'}).some(ch=>ch.key==='help'))
  const steps=sandbox.exports.getTrainingOperations(role,'help')
  assert.equal(steps.length,9)
  for(const [index,step] of steps.entries()){
   assert.equal(step.id,'help:shared:'+index)
   assert.equal(step.kind,index===1?'write':'inspect')
   for(const language of ['nl','en','fr','de'])assert.ok(step.title[language]?.length>5)
  }
 }
})

test('authenticated browser curriculum actually opens Help articles and executes search',async()=>{
 const bot=await read('scripts/15-bot-browser-test.mjs')
 assert.match(bot,/const helpReal=chapter==='help'&&operationId\.startsWith\('help:shared:'\)/)
 assert.match(bot,/const requiredReal=chatReal\|\|peopleReal\|\|systemReal\|\|helpReal/)
 assert.match(bot,/if\(kind==='write'\)await help\.locator\('\[data-demo-help-search\]'\)\.fill\('briefing'\)/)
 assert.match(bot,/await help\.locator\('\[data-demo-help-open\]'\)\.click\(\)/)
 assert.match(bot,/reviewed\.read\?\.length!==total/)
 assert.match(bot,/reviewed\.search\?\.toLowerCase\(\)\.includes\('briefing'\)/)
})
