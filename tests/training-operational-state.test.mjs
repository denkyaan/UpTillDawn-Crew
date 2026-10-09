import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
import {readFile} from 'node:fs/promises'
import {getTourChapters} from '../lib/tour-training.ts'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')
const runtime=await read('lib/training-operational-state.ts')
const catalog=await read('lib/training-exercise-catalog.ts')
const lab=await read('components/training/role-training-lab.tsx')
const fields=await read('lib/training-operation-ui.ts')
function load(source){
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const sandbox={exports:{},require(){throw new Error('Pure training model must not use runtime imports')}}
 vm.runInNewContext(js,sandbox)
 return sandbox.exports
}
const {trainingOperationalState,trainingOperationError}=load(runtime)
const {getTrainingOperations,isChapterPractised}=load(catalog)
const evidence=(value='confirmed',kind='toggle')=>({value,at:'2026-10-09T12:00:00Z',kind})
const idStep=(role,chapter,id)=>{
 const found=getTrainingOperations(role,chapter).find(step=>step.id===id)
 assert.ok(found,'Missing required operation '+role+'/'+chapter+'/'+id)
 return found
}
const byDomain=(role,ledger,domain)=>trainingOperationalState(role,ledger).find(row=>row.domain===domain)

test('training status is derived from actions, not visiting demo tabs',()=>{
 const empty=trainingOperationalState('employee',{})
 assert.equal(isChapterPractised('no-evidence','employee','briefings'),false)
 assert.ok(empty.length>=9)
 assert.equal(byDomain('employee',{},'briefing').status,'pending')
 assert.equal(byDomain('employee',{},'timesheet').status,'pending')
 assert.equal(byDomain('employee',{'operations:employee:0':evidence()},'attendance').status,'active')
 assert.equal(byDomain('employee',{'operations:employee:0':evidence(),'operations:employee:2':evidence()},'attendance').status,'completed')
 assert.equal(byDomain('employee',{'driver:shared:6':evidence()},'driver').status,'active')
 assert.equal(byDomain('employee',{'driver:shared:6':evidence(),'driver:shared:9':evidence()},'driver').status,'completed')
 for(const row of empty)for(const locale of ['nl','en','fr','de']){
  assert.ok(row.title[locale]?.length>0,row.domain+' missing '+locale+' title')
  assert.ok(row.detail[locale]?.length>0,row.domain+' missing '+locale+' detail')
 }
})

test('briefing is opened and read before it can be acknowledged',()=>{
 const step=idStep('employee','briefings','briefings:shared:5')
 assert.ok(trainingOperationError('employee',step,{}))
 const read=Object.fromEntries(Array.from({length:5},(_,i)=>['briefings:shared:'+i,evidence('reviewed','inspect')]))
 assert.equal(trainingOperationError('employee',step,read),null)
 assert.equal(byDomain('employee',read,'briefing').status,'active')
 assert.equal(byDomain('employee',{...read,'briefings:shared:5':evidence(),'briefings:employee:1':evidence()},'briefing').status,'completed')
})

test('work clock, break and driving enforce the actual order',()=>{
 const start=idStep('employee','operations','operations:employee:2')
 const pause=idStep('employee','operations','operations:employee:3')
 const endPause=idStep('employee','operations','operations:employee:5')
 assert.ok(trainingOperationError('employee',start,{}))
 assert.equal(trainingOperationError('employee',start,{'operations:employee:0':evidence()}),null)
 assert.ok(trainingOperationError('employee',pause,{}))
 assert.equal(trainingOperationError('employee',pause,{'operations:employee:2':evidence()}),null)
 assert.ok(trainingOperationError('employee',endPause,{}))
 const driverStart=idStep('employee','driver','driver:shared:6')
 const driverStop=idStep('employee','driver','driver:shared:9')
 assert.ok(trainingOperationError('employee',driverStart,{}))
 assert.ok(trainingOperationError('employee',driverStop,{}))
 assert.equal(trainingOperationError('employee',driverStart,{'driver:shared:5':evidence()}),null)
 assert.equal(trainingOperationError('employee',driverStop,{'driver:shared:6':evidence()}),null)
})

test('Stop Work occurs only after other chapters and before timesheet submission',()=>{
 for(const role of ['employee','responsible_lead']){
  const chapters=getTourChapters(role,{scope:'general'})
  assert.equal(chapters.at(-1).key,'timesheet')
  assert.ok(chapters.findIndex(x=>x.key==='timesheet')>chapters.findIndex(x=>x.key==='tasks'))
  const operations=getTrainingOperations(role,'operations')
  assert.ok(operations.filter(x=>x.title.en.includes('Stop work')||x.title.en.includes('Stop your work timer')).every(x=>x.kind==='inspect'))
  const sheet=getTrainingOperations(role,'timesheet')
  assert.equal(sheet.at(-4).kind,'toggle')
  assert.match(sheet.at(-4).title.en,/Stop work/)
  assert.match(sheet.at(-1).title.en,/Submit/)
  const stop=sheet.at(-4).id,submit=sheet.at(-1).id
  assert.ok(trainingOperationError(role,idStep(role,'timesheet',submit),{}))
  assert.equal(trainingOperationError(role,idStep(role,'timesheet',submit),{[stop]:evidence()}),null)
  assert.equal(byDomain(role,{[stop]:evidence()},'timesheet').status,'active')
  assert.equal(byDomain(role,{[stop]:evidence(),[submit]:evidence()},'timesheet').status,'completed')
 }
})

test('hands-on UI uses real simulated entities, instructions and domain state',()=>{
 for(const fragment of ['data-training-live-workflow','data-training-domain','data-training-status','trainingOperationError(role,current,ledger)','data-training-full-instructions','FULL_INSTRUCTIONS.briefings','FULL_INSTRUCTIONS.tasks','trainingField(current)','timesheet']){
  assert.ok(lab.includes(fragment),'missing feature '+fragment)
 }
 for(const value of ['Lina Peeters','Noah Jacobs','damaged','artist','events:admin:0','tasks','inventory','guestlist','Driver'])assert.ok(fields.includes(value),'missing semantic input '+value)
 assert.doesNotMatch(fields,/createClient\(|fetch\(|supabase\.from\(|\.rpc\(/)
 assert.doesNotMatch(runtime,/createClient\(|fetch\(|supabase\.from\(|\.rpc\(/)
 assert.doesNotMatch(lab,/supabase\.from\(|createClient\(|fetch\(['"]\/api/)
})
