import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {getTourChapters} from '../lib/tour-training.ts'

const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const scenario={exports:{},require(name){
 if(name==='./training-exercise-catalog')return {practiceDoneKey:key=>key+':actions-v1'}
 throw new Error('Scenario projection must not access external system '+name)
}}
vm.runInNewContext(compile('lib/training-demo-scenario.ts'),scenario)
const {demoScenarioFromLedger}=scenario.exports
const evidence=value=>({value,at:'2026-10-09T00:00:00Z',kind:'form'})

test('one fictional event flows into every subsequent training chapter',()=>{
 const ledger={
  'events:admin:0':evidence('Night Shift — Test Event · bar'),
  'events:admin:3':evidence('28'),
  'workplaces:admin:0':evidence('Second Bar · bar'),
  'workplaces:admin:3':evidence('2026-10-10T21:00 → 2026-10-11T05:00'),
  'briefings:admin:0':evidence('Second Bar briefing · bar'),
  'tasks:admin:0':evidence('Check till · bar'),
  'personnel:admin:3':evidence('confirmed'),
  'incidents:shared:5':evidence('confirmed'),
  'guestlist:shared:4':evidence('confirmed'),
 }
 const actual=demoScenarioFromLedger(ledger)
 assert.equal(actual.eventName,'Night Shift — Test Event')
 assert.equal(actual.workplaceName,'Second Bar')
 assert.equal(actual.crewLimit,28)
 assert.equal(actual.briefingName,'Second Bar briefing')
 assert.equal(actual.taskName,'Check till')
 assert.equal(actual.approved,true)
 assert.equal(actual.incidentReported,true)
 assert.equal(actual.artistArrived,true)
 assert.match(actual.shiftTime,/2026-10-10/)
})
test('no shared training state ever depends on an active production database',()=>{
 const source=readFileSync('lib/training-demo-scenario.ts','utf8')
 assert.doesNotMatch(source,/fetch\(|createClient\(|\.rpc\(|\.from\(/)
 const blank=demoScenarioFromLedger({})
 assert.equal(blank.crewLimit,20)
 assert.equal(blank.approved,false)
 assert.equal(blank.artistArrived,false)
})
test('all visible application navigation items have role-appropriate guided chapters',()=>{
 const source=readFileSync('components/layout/navigation-items.ts','utf8')
 const items=[...source.matchAll(/\{ key:"([^"]+)", href:"([^"]+)", label:"([^"]+)", icon:[^,]+, roles:\[([^\]]+)\] \}/g)]
 assert.ok(items.length>=18,'navigation registry changed; update this coverage gate')
 for(const role of ['employee','responsible_lead','admin']){
  const chapters=getTourChapters(role,{scope:'general'})
  const mapped=new Set(chapters.map(x=>x.key))
  for(const [,key,href,,roles] of items){
   if(!roles.includes('"'+role+'"'))continue
   if(key==='shifts'){
    assert.ok(mapped.has('workplaces'),'shifts must be integrated into workplaces')
    continue
   }
   if(key==='sales'&&role!=='admin')continue
   assert.ok(mapped.has(key),role+' missing curriculum for '+key+' ('+href+')')
  }
 }
})
