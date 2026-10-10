import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {getTrainingOperations} from '../lib/training-exercise-catalog.ts'
const read=path=>readFileSync(path,'utf8')

test('registration and crew tours mount real local-only people sandbox',()=>{
 const personnel=read('app/(app)/personnel/page.tsx')
 const crew=read('app/(app)/crew/page.tsx')
 const sandbox=read('components/training/sandbox-people-training.tsx')
 assert.match(personnel,/if\(params\.tour==='1'\)return <SandboxPeopleTraining role="admin" module="personnel"\/>/)
 assert.match(crew,/if\(params\.tour==='1'\)return <SandboxPeopleTraining role=\{current\.role\} module="crew"\/>/)
 assert.match(sandbox,/data-training-people=\{module\}/)
 assert.match(sandbox,/data-training-practical-op=\{current\.id\}/)
 assert.match(sandbox,/sessionStorage\.setItem\(key,JSON\.stringify\(next\)\)/)
 assert.match(sandbox,/detail:\{role:trainingRole,chapter:module,id:current\.id,kind:current\.kind,value\}/)
 assert.doesNotMatch(sandbox,/supabase\.|createClient\(|fetch\(/)
})
test('account and permissions role curriculum counts have real controls',()=>{
 const sandbox=read('components/training/sandbox-people-training.tsx')
 assert.equal(getTrainingOperations('admin','personnel').length,10)
 assert.equal(getTrainingOperations('admin','crew').length,12)
 assert.equal(getTrainingOperations('responsible_lead','crew').length,7)
 assert.equal(getTrainingOperations('employee','crew').length,6)
 assert.match(sandbox,/if\(idx===3&&lina\)\{lina\.status="approved"/)
 assert.match(sandbox,/if\(idx===6&&mila\)\{mila\.status="rejected"/)
 assert.match(sandbox,/if\(idx===8\)\{next\.verifiedResent=true/)
 assert.match(sandbox,/if\(idx===9\)\{next\.portalDenied=true/)
 assert.match(sandbox,/if\(idx===1&&lina\)\{lina\.blocked=true/)
 assert.match(sandbox,/if\(idx===2&&lina\)\{lina\.blocked=false/)
 assert.match(sandbox,/if\(confirm!=="DEMO"\)/)
 assert.match(sandbox,/next\.members=next\.members\.filter\(p=>p\.id!=="mila"\)/)
 assert.match(sandbox,/Maker account protected/)
})
test('people bot performs the real role-specific UI and verifies its audit trail',()=>{
 const bot=read('scripts/15-bot-browser-test.mjs')
 assert.match(bot,/const peopleReal=\['crew','personnel'\]\.includes\(chapter\)/)
 assert.match(bot,/const requiredReal=chatReal\|\|peopleReal\|\|systemReal\|\|helpReal\|\|commonReal\.has\(operationId\)/)
 for(const marker of ['data-demo-people-search','data-demo-people-select','data-demo-people-message','data-demo-people-confirm']){
  assert.ok(bot.includes(marker),'bot must interact with '+marker)
 }
 assert.match(bot,/Admin registration and approval sequence failed/)
 assert.match(bot,/Admin staff permissions \/ demo deletion failed/)
})
