import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
import {getTourChapters} from '../lib/tour-training.ts'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')
const raw=await read('lib/training-exercise-catalog.ts')
const compiled=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const sandbox={exports:{},require(){throw new Error('Training catalog must remain pure and dependency-free')}}
vm.runInNewContext(compiled,sandbox)
const {getTrainingOperations,countRoleOperations}=sandbox.exports

test('every role and chapter has complete four-language action inventory',()=>{
 for(const role of ['admin','responsible_lead','employee']){
  const chapters=getTourChapters(role,{scope:'general'})
  assert.ok(chapters.length>=13)
  for(const chapter of chapters){
   const actions=getTrainingOperations(role,chapter.key)
   assert.ok(actions.length>=3,role+' / '+chapter.key+' has no realistic practice sequence')
   const ids=new Set()
   for(const action of actions){
    assert.ok(!ids.has(action.id),'duplicate evidence key: '+action.id)
    ids.add(action.id)
    for(const locale of ['nl','en','fr','de']){
     assert.ok(action.title[locale]?.trim(),action.id+' missing title '+locale)
     assert.ok(action.help[locale]?.trim(),action.id+' missing explanation '+locale)
    }
    assert.ok(['inspect','write','select','toggle','message','number','schedule','upload','delete','form'].includes(action.kind))
   }
  }
  assert.ok(countRoleOperations(role,chapters)>70,'insufficient operational coverage: '+role)
 }
})

test('first-use training explicitly covers help, conditional driver and entrance',()=>{
 for(const role of ['employee','responsible_lead']){
  const keys=getTourChapters(role,{scope:'general'}).map(item=>item.key)
  for(const key of ['overview','events','workplaces','briefings','operations','driver','tasks','incidents','inventory','guestlist','crew','chat','settings','help','timesheet']){
   assert.ok(keys.includes(key),role+' has no training chapter for '+key)
  }
 }
 const admin=getTourChapters('admin',{scope:'general'}).map(item=>item.key)
 for(const key of ['personnel','events','workplaces','briefings','tasks','incidents','inventory','guestlist','sales','crew','chat','exports','platform','settings','help','timesheet']){
  assert.ok(admin.includes(key),'admin has no training chapter for '+key)
 }
 assert.ok(admin.indexOf('personnel')<admin.indexOf('events'),'admin must approve crew before creating an event')
 assert.ok(admin.indexOf('events')<admin.indexOf('workplaces'),'admin must set up the event before staff shifts')
})

test('the training lab records independently validated operations, without production writes',async()=>{
 const [ui,controller,css]=await Promise.all([
  read('components/training/role-training-lab.tsx'),
  read('components/training/tour-control-center.tsx'),
  read('app/globals.css'),
 ])
 for(const action of ['inspect','write','select','toggle','message','number','schedule','upload','delete','form']){
  assert.ok(ui.includes('case "'+action+'"')||ui.includes('current.kind==="'+action+'"'),action+' must have actual interactive controls')
 }
 assert.match(ui,/localStorage\.setItem\(practiceDoneKey\(progressKey\)/)
 assert.match(ui,/uptilldawn-training-lab-completed/)
 assert.match(ui,/data-training-active-action/)
 assert.match(controller,/isChapterPractised\(progressKey,role,current\.key\)/)
 assert.match(controller,/RoleTrainingLab/)
 assert.match(controller,/createPortal/)
 assert.match(css,/data-upt-training-next-tab/)
 assert.doesNotMatch(css,/box-shadow: 0 0 0 9999px/)
 for(const input of [raw,ui]){
  assert.doesNotMatch(input,/createClient\(|supabase\.from\(|\.rpc\(|fetch\(['"]\/api/)
 }
})

test('the chapter evidence cannot be forged by visiting a page',()=>{
 assert.match(raw,/required\.every\(step=>Boolean\(evidence\[step\.id\]/)
 assert.match(raw,/practiceDoneKey/)
 assert.match(raw,/function readPracticeLedger/)
})
