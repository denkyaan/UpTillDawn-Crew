import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('Excel, Platform and Settings use their real, role-scoped sandbox instead of the old shallow module',async()=>{
 const [exportsPage,platformPage,settingsPage,view]=await Promise.all([
  read('app/(app)/exports/page.tsx'),read('app/(app)/admin/platform/page.tsx'),
  read('app/(app)/settings/page.tsx'),read('components/training/sandbox-system-training.tsx')
 ])
 for(const [page,module] of [[exportsPage,'exports'],[platformPage,'platform'],[settingsPage,'settings']]){
  assert.match(page,new RegExp('<SandboxSystemTraining role=\\{?[^>]*module="'+module+'"'))
  assert.doesNotMatch(page,/SandboxRoleModule/,'old shallow training view is no longer a route')
 }
 assert.match(view,/getTrainingOperations\(trainingRole,module\)/)
 assert.match(view,/data-training-system=\{module\}/)
 assert.match(view,/data-demo-system-operation=\{current\.id\}/)
 assert.match(view,/data-training-practical-op=\{current\.id\}/)
 assert.match(view,/detail:\{role:trainingRole,chapter:module,id:current\.id,kind:current\.kind,value\}/)
 assert.doesNotMatch(view,/createClient\(|supabase\.from\(|\.rpc\(|fetch\(/)
})

test('Excel sandbox validates approved locked timesheets, date ranges and export readiness',async()=>{
 const view=await read('components/training/sandbox-system-training.tsx')
 assert.match(view,/approvedReviewed:true|approvedReviewed=true/)
 assert.match(view,/lockedReviewed:true|lockedReviewed=true/)
 assert.match(view,/next\.approvedReviewed=true/)
 assert.match(view,/next\.lockedReviewed=true/)
 assert.match(view,/!next\.event\|\|!next\.approvedReviewed\|\|!next\.lockedReviewed/)
 assert.match(view,/next\.ready=true/)
 assert.match(view,/state\.ready&&<p data-demo-system-ready/)
 assert.match(view,/rows\.filter\(row=>row\.approved&&row\.locked\)/)
})

test('Platform sandbox requires automation, trigger and template before demo-only rollout',async()=>{
 const view=await read('components/training/sandbox-system-training.tsx')
 assert.match(view,/next\.automation=name\.trim\(\)/)
 assert.match(view,/next\.template=name\.trim\(\)/)
 assert.match(view,/next\.trigger=selection/)
 assert.match(view,/!next\.automation\|\|!next\.template\|\|!next\.trigger/)
 assert.match(view,/next\.rollout=true/)
 assert.match(view,/Foutieve CI blokkeert productie/)
})

test('Settings sandbox persists profile language notifications and fictional AI response',async()=>{
 const view=await read('components/training/sandbox-system-training.tsx')
 assert.match(view,/next\.profile=value/)
 assert.match(view,/next\.language=selection/)
 assert.match(view,/next\.push=!next\.push/)
 assert.match(view,/next\.answer=T\(l,/)
 assert.match(view,/state\.answer&&<p data-demo-system-ai-answer/)
})

test('15 authenticated bots use all required real system controls and assert persistence',async()=>{
 const bot=await read('scripts/15-bot-browser-test.mjs')
 assert.match(bot,/const systemReal=\['exports','platform','settings'\]/)
 assert.match(bot,/const requiredReal=chatReal\|\|peopleReal\|\|systemReal/)
 for(const id of ['data-demo-system-select','data-demo-system-name','data-demo-system-category','data-demo-system-from','data-demo-system-to'])assert.ok(bot.includes(id),id)
 assert.match(bot,/snapshot\.audit!==total/)
 assert.match(bot,/chapter==='exports'&&\(!snapshot\.ready/)
 assert.match(bot,/chapter==='platform'&&\(!snapshot\.automation/)
 assert.match(bot,/chapter==='settings'&&\(!snapshot\.profile/)
})

test('export option visibility is tied to the semantic step id rather than a transient array index',async()=>{
 const view=await read('components/training/sandbox-system-training.tsx')
 const bot=await read('scripts/15-bot-browser-test.mjs')
 assert.match(view,/current\?\.id==="exports:shared:0"/)
 assert.match(view,/current\?\.id==="exports:shared:3"/)
 assert.match(view,/current\?\.id==="platform:shared:3"/)
 assert.match(view,/current\?\.id==="settings:shared:2"/)
 assert.match(bot,/'exports:shared:0':'training-event'/)
 assert.match(bot,/'exports:shared:3':'xlsx'/)
 assert.match(bot,/\.some\(option=>option\.value===chosen\)/)
 assert.match(bot,/Export\/platform\/settings selection mismatch/)
 assert.match(bot,/sameTargetInterrupted/)
 assert.match(bot,/await page\.waitForURL\(url,\{waitUntil:'domcontentloaded',timeout:15000\}\)/)
})
