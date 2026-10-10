import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
import {readFile} from 'node:fs/promises'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')
const [catalogSrc,fieldSrc,manager]=await Promise.all([
 read('lib/training-exercise-catalog.ts'),read('lib/training-operation-ui.ts'),read('components/training/sandbox-admin-manager.tsx')
])
function load(source){
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const scope={exports:{},require(){throw new Error('Training field catalog must not use production runtime dependencies')}}
 vm.runInNewContext(js,scope)
 return scope.exports
}
const {getTrainingOperations}=load(catalogSrc)
const {trainingField}=load(fieldSrc)
const action=(role,chapter,fragment)=>{
 const found=getTrainingOperations(role,chapter).find(x=>x.title.en.toLowerCase().includes(fragment.toLowerCase()))
 assert.ok(found,role+'/'+chapter+'/'+fragment+' missing')
 return found
}
test('every selectable four-locale action offers a real feature-specific choice',()=>{
 for(const role of ['admin','responsible_lead','employee']){
  for(const chapter of ['overview','events','workplaces','briefings','operations','driver','tasks','incidents','inventory','guestlist','crew','chat','settings','help','timesheet','personnel','exports','platform']){
   for(const step of getTrainingOperations(role,chapter)){
    const f=trainingField(step)
    for(const locale of ['nl','fr','en','de']){
     assert.ok(f.label[locale],step.id+' missing label '+locale)
     assert.ok(f.secondary[locale],step.id+' missing secondary label '+locale)
     assert.ok(f.placeholder[locale],step.id+' missing placeholder '+locale)
    }
    if(step.kind==='select'||step.kind==='form'){
     assert.ok(f.options.length>0,step.id+' missing selectable data')
     assert.equal(new Set(f.options.map(x=>x.value)).size,f.options.length,step.id+' has duplicate values')
     for(const option of f.options)for(const locale of ['nl','fr','en','de'])
      assert.ok(option.label[locale],step.id+' lacks '+locale+' option')
    }
   }
  }
 }
})
test('event, onboarding and workplace forms no longer ask for unrelated generic workplaces',()=>{
 assert.deepEqual([...trainingField(action('admin','events','Create new fictional event')).options.map(x=>x.value)],['rave','festival','party'])
 assert.deepEqual([...trainingField(action('admin','personnel','initial role')).options.map(x=>x.value)],['employee','responsible_lead','admin'])
 assert.deepEqual([...trainingField(action('employee','events','Join an event')).options.map(x=>x.value)],['yes','no'])
 assert.deepEqual([...trainingField(action('admin','workplaces','Assign responsible lead')).options.map(x=>x.value)],['lina','noah','mila'])
 assert.deepEqual([...trainingField(action('admin','workplaces','price list item manually')).options.map(x=>x.value)],['bar','merch','tokens'])
 assert.deepEqual([...trainingField(action('employee','guestlist','Filter artists')).options.map(x=>x.value)],['guest','artist'])
 assert.deepEqual([...trainingField(action('employee','inventory','Report equipment condition')).options.map(x=>x.value)],['good','missing','damaged'])
 assert.deepEqual([...trainingField(action('responsible_lead','tasks','task priority')).options.map(x=>x.value)],['normal','high','urgent'])
 assert.deepEqual([...trainingField(action('admin','platform','automation trigger')).options.map(x=>x.value)],['availability','shift','incident'])
 assert.deepEqual([...trainingField(action('admin','events','available slot')).options.map(x=>x.value)],['lina','noah','mila'])
 assert.deepEqual([...trainingField(action('admin','incidents','Assign an incident')).options.map(x=>x.value)],['lina','noah','mila'])
 assert.deepEqual([...trainingField(action('responsible_lead','incidents','Escalate to Admin')).options.map(x=>x.value)],['admin'])
})
test('admin functional sandbox is isolated, supports required role modules and enforces meaningful steps',async()=>{
 for(const mod of ['events','workplaces','briefings','operations']){
  assert.ok(manager.includes('module==="'+mod+'"'),mod+' admin workflow omitted')
  const route=await read('app/(app)/'+mod+'/page.tsx')
  assert.ok(route.includes('SandboxAdminManager module="'+mod+'"'),mod+' admin route still shows staff demo')
 }
 for(const phrase of ['evenement aanmaken','Event management','Keur','start','deadline','priceItem','instructions','checklist','reason','locked','approved','rejected','acknowledged','file']){
  assert.ok(manager.toLowerCase().includes(phrase.toLowerCase()),'missing admin workflow '+phrase)
 }
 assert.match(manager,/disabled=\{!s\.approved\|\|s\.locked\}/,'locked timesheet requires approval')
 assert.match(manager,/disabled=\{!s\.confirmed\}/,'briefing cannot acknowledge without reading')
 assert.match(manager,/s\.reason\.trim\(\)\.length<5/,'rejection must have reason')
 assert.match(manager,/uptilldawn-training-practical-action/,'admin controls emit actual practice evidence')
 const trainingLab=await read('components/training/role-training-lab.tsx')
 assert.match(trainingLab,/uptilldawn-training-practical-action/,'trainer listens to real controls')
 assert.match(trainingLab,/detail\.id!==current\.id/,'out of order actions cannot count as completed')
  assert.doesNotMatch(manager,/fetch\(|supabase\.|createClient\(|\.rpc\(/,'training must not write to production')
})


test('functional sandbox controls take priority over generic duplicate exercises',async()=>{
 const [lab,bots]=await Promise.all([
  read('components/training/role-training-lab.tsx'),read('scripts/15-bot-browser-test.mjs')
 ])
 assert.match(lab,/data-training-functional-prompt/)
 assert.match(lab,/!functionalControl&&<>/,'generic practice controls must be suppressed when real UI is usable')
 assert.match(lab,/data-training-practical-op/)
 assert.match(lab,/node\.getClientRects\(\)\.length>0/)
 for(const id of ['events:admin:6','events:admin:12','events:admin:14','workplaces:admin:0','workplaces:admin:17','briefings:admin:0','operations:admin:6','operations:admin:7']){
  assert.ok(manager.includes('data-training-practical-op="'+id+'"'),'missing actual sandbox button: '+id)
  assert.ok(bots.includes("'"+id+"':"),'browser bot does not exercise real functional button: '+id)
 }
 assert.match(bots,/Real sandbox click did not persist the expected action/)
})

test('staff portal actions use employee training role so opening briefings and starting work receive credit',async()=>{
 const [briefings,operations,briefingPage,operationsPage,seed]=await Promise.all([
  read('components/training/sandbox-briefings.tsx'),
  read('components/training/sandbox-operations.tsx'),
  read('app/(app)/briefings/page.tsx'),
  read('app/(app)/operations/page.tsx'),
  read('scripts/seed-15-bot-users.mjs')
 ])
 assert.match(seed,/staff:\s*'staff'/,'fixture must preserve the real database role')
 assert.match(briefingPage,/SandboxBriefings role=\{user\.role\}/)
 assert.match(operationsPage,/SandboxOperations userName=/)
 for(const source of [briefings,operations]){
  assert.match(source,/role==="staff"\?"employee":role/,'staff role must normalize before emitting proof')
  assert.match(source,/detail:\{role:trainingRole,chapter:/,'training event must use canonical role')
 }
 assert.match(briefings,/credit\("briefings:shared:0","inspect"\)/)
 assert.match(operations,/credit\(role==="responsible_lead"\?"operations:responsible_lead:0":"operations:employee:0"\)/)
})
