import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')
const catalog=await read('lib/training-exercise-catalog.ts')
const compiled=ts.transpileModule(catalog,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const context={exports:{},require(){throw new Error('Training catalog cannot access production services')}}
vm.runInNewContext(compiled,context)
const ops=context.exports.getTrainingOperations

test('Sales page presents a stateful nine-step Admin simulation with real operation buttons',async()=>{
 const [page,view,bot]=await Promise.all([
  read('app/(app)/sales/page.tsx'),
  read('components/training/sandbox-sales-training.tsx'),
  read('scripts/15-bot-browser-test.mjs')
 ])
 const sales=ops('admin','sales')
 assert.equal(sales.length,9)
 assert.deepEqual(sales.map(x=>x.id).join('|'),Array.from({length:9},(_,i)=>'sales:admin:'+i).join('|'))
 assert.equal(sales[4].kind,'number')
 assert.equal(sales[5].kind,'number')
 assert.ok(page.includes("if(params.tour==='1'){if(current.isAdmin!==true)redirect('/');return <SandboxSalesTraining/>}"),'Sales demo must enforce Admin access before rendering')
 assert.doesNotMatch(page,/import \{ SandboxSales \}/)
 assert.match(view,/data-demo-sales-operation=\{step\.id\}/)
 assert.match(view,/data-training-practical-op=\{step\.id\}/)
 assert.match(view,/state\.merchCents\+state\.tillCents\+state\.tokenCents/)
 assert.match(view,/next\.merchCents\+=count\*1200/)
 assert.match(view,/next\.tokenCents\+=count\*800/)
 assert.match(view,/!next\.merchSold\|\|!next\.tokensSold/)
 assert.match(view,/next\.exportReady=true/)
 assert.match(view,/sessionStorage\.setItem\(KEY,JSON\.stringify\(next\)\)/)
 assert.match(bot,/const revenueReal=chapter==='sales'/)
 assert.match(bot,/await sales\.locator\('\[data-demo-sales-amount\]'\)\.fill\('3'\)/)
 assert.match(bot,/sales\.audit\?\.length!==total/)
 assert.match(bot,/sales\.discrepancyCents!==0/)
 for(const l of ['nl','fr','en','de'])for(const row of sales)assert.ok(row.title[l]?.trim())
 assert.doesNotMatch(view,/supabase\.from\(|createClient\(|fetch\(|\.rpc\(/)
})

test('Incident page runs nine shared steps plus role-specific close/escalation controls',async()=>{
 const [page,view,bot]=await Promise.all([
  read('app/(app)/incidents/page.tsx'),
  read('components/training/sandbox-incident-training.tsx'),
  read('scripts/15-bot-browser-test.mjs')
 ])
 assert.match(page,/<SandboxIncidentTraining role=\{current\.role\}\/>/)
 assert.doesNotMatch(page,/import \{ SandboxIncidents \}/)
 assert.equal(ops('employee','incidents').length,9)
 assert.equal(ops('admin','incidents').length,13)
 assert.equal(ops('responsible_lead','incidents').length,13)
 const expected={
  'incidents:shared:1':'select','incidents:shared:2':'message','incidents:shared:3':'select',
  'incidents:shared:5':'toggle','incidents:admin:1':'select','incidents:admin:2':'message',
  'incidents:admin:3':'toggle','incidents:responsible_lead:1':'message',
  'incidents:responsible_lead:2':'select','incidents:responsible_lead:3':'toggle'
 }
 for(const [id,kind] of Object.entries(expected)){
  const role=id.includes(':admin:')?'admin':id.includes(':responsible_lead:')?'responsible_lead':'employee'
  assert.equal(ops(role,'incidents').find(x=>x.id===id)?.kind,kind)
 }
 assert.match(view,/getTrainingOperations\(trainingRole,"incidents"\)/)
 assert.match(view,/data-demo-incident-operation=\{current\.id\}/)
 assert.match(view,/data-training-practical-op=\{current\.id\}/)
 assert.match(view,/!next\.category\|\|!next\.urgency\|\|!next\.description\|\|!next\.gpsReviewed/)
 assert.match(view,/!next\.sent\|\|!next\.assignee\|\|!next\.response/)
 assert.match(view,/!next\.sent\|\|!next\.response\|\|!next\.escalation/)
 assert.match(view,/next\.updates\.push\(value\)/)
 assert.match(view,/sessionStorage\.setItem\(evidenceKey\(trainingRole\),JSON\.stringify\(next\)\)/)
 assert.ok(view.includes('sessionStorage.setItem("uptilldawn-training-workflow-v3"'),'incident reporting must update the fictional operational state')
 assert.ok(view.includes('incidentDone:true,helpTourCompleted:true'))
 assert.ok(!view.includes('uptilldawn-training-nav-target'),'incident must not force the trainee to another tab')
 assert.match(bot,/const incidentReal=chapter==='incidents'/)
 assert.match(bot,/await incident\.locator\('\[data-demo-incident-select\]'\)\.selectOption\(choice\)/)
 assert.match(bot,/saved\.audit\?\.length!==total/)
 assert.doesNotMatch(view,/supabase\.from\(|createClient\(|fetch\(|\.rpc\(/)
})
