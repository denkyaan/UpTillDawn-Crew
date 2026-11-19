import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {csvCell,encodeCsv} from '../modern/src/lib/export-csv.ts'

const read=path=>readFileSync(path,'utf8')

test('one role-aware navigation, eight lazy operational screens and no fake God Mode',()=>{
 const app=read('modern/src/main.tsx')
 for(const page of ['crew','briefings','operations','responsible','administration','promotion','notifications','profile']){
  assert.ok(app.includes('import("./screens/'+page+'")'),page+' must be lazy')
 }
 for(const path of ['/crew','/briefings','/operations','/notifications','/profile','/responsible']){
  assert.ok(app.includes('path="'+path+'"'),path+' must be routed')
 }
 assert.ok(app.includes('function ResponsibleGuard('))
 assert.ok(app.includes('identity.role==="responsible_lead"||identity.role==="admin"||identity.is_owner'))
 assert.ok(app.includes('<PortalGuard portal="administration">'))
 assert.ok(app.includes('<PortalGuard portal="promotion">'))
 assert.ok(app.includes('path="/god/*" element={<Missing/>}'))
 assert.ok(app.includes('path="*" element={<Missing/>}'))
 assert.ok(!app.includes('statefulResponsibleRoute('))
})
test('all four languages expose the same new navigation categories',()=>{
 const translations=read('modern/src/shared/i18n.ts')
 for(const key of ['crew','briefings','operations','responsible','promotion','administration','notifications','profile'])
  assert.equal((translations.match(new RegExp(key+':','g'))||[]).length,4,key)
})
test('15 direct Supabase read boundaries use RLS, selected fields, limits and cancellation',()=>{
 const reads=read('modern/src/lib/operational-reads.ts')
 for(const t of ['shifts','check_ins','work_sessions','profiles','crew_notifications','workplaces','inventory_items','incidents','briefings','briefing_acknowledgements','responsible_assignments','admin_financial_documents','admin_financial_payments','tasks']){
  assert.ok(reads.includes('.from("'+t+'")'),'missing '+t)
 }
 assert.ok((reads.match(/\.limit\(\d+\)/g)||[]).length>=14)
 assert.ok((reads.match(/\.abortSignal\(signal\)/g)||[]).length>=14)
 assert.ok(!reads.includes('.select("*")'))
 for(const method of ['.insert(','.update(','.upsert(','.delete('])
  assert.ok(!reads.includes(method),'read-only source may not write via '+method)
 assert.ok(reads.includes('.eq("user_id",uid)'))
 assert.ok(reads.includes('.eq("reporter_id",uid)'))
 assert.ok(reads.includes('.eq("id",uid).abortSignal(signal).maybeSingle()'))
})
test('private and financial data are ephemeral, scoped to user, and never offline cached',()=>{
 const hook=read('modern/src/lib/use-private-query.ts')
 const profile=read('modern/src/screens/profile.tsx')
 const finance=read('modern/src/screens/administration.tsx')
 assert.ok(hook.includes('const scope=userId+":"+key'))
 assert.ok(hook.includes('state.scope===scope?state'))
 assert.ok(hook.includes('controller.abort()'))
 assert.ok(hook.includes('setTimeout(()=>controller.abort(),12000)'))
 for(const unsafe of ['readSnapshot','writeSnapshot','indexedDB','localStorage','caches.open'])
  assert.ok(!hook.includes(unsafe),'private hook must not use '+unsafe)
 assert.ok(profile.includes('ownProfile(uid,signal)'))
 assert.ok(finance.includes('administrationDocuments'))
 assert.ok(finance.includes('administrationPayments'))
 assert.ok(finance.includes('without')===false)
})
test('briefings and sensitive task actions use the audited self-scoped RPCs behind disabled writes',()=>{
 const mutations=read('modern/src/lib/operational-mutations.ts')
 const briefings=read('modern/src/screens/briefings.tsx')
 const crew=read('modern/src/screens/crew.tsx')
 assert.ok(mutations.includes('verifyOwnSession()'))
 for(const rpc of ['upt_acknowledge_briefing','upt_confirm_shift','upt_acknowledge_incident'])
  assert.ok(mutations.includes('.rpc("'+rpc+'"'))
 assert.ok(briefings.includes('const briefings=await allowedBriefings(signal)'))
 assert.ok(briefings.includes('const acknowledgements=await ownAcknowledgements(uid,signal)'))
 assert.ok(briefings.includes('versions.get(brief.id)===brief.version'))
 assert.ok(briefings.includes('writesAvailable()?'))
 assert.ok(crew.includes('writesAvailable()&&'))
 assert.ok(read('modern/.env.example').includes('VITE_MIGRATION_ALLOW_WRITES=false'))
})
test('large data surfaces load only after a selected tab mounts, not concurrently at app startup',()=>{
 const crew=read('modern/src/screens/crew.tsx')
 const ops=read('modern/src/screens/operations.tsx')
 const admin=read('modern/src/screens/administration.tsx')
 assert.ok(crew.includes('view==="shifts"?<Shifts'))
 assert.ok(ops.includes('view==="workplaces"?<Workplaces'))
 assert.ok(admin.includes('section==="documents"?<><Documents'))
 for(const screen of [crew,ops,admin]){
  assert.ok(screen.includes('usePrivateQuery'))
  assert.ok(screen.includes('<WhenLoading'))
 }
})
test('local CSV neutralizes Excel formulas, preserves quotes and refuses row overflow',()=>{
 assert.equal(csvCell('=1+2'),"\"'=1+2\"")
 assert.equal(csvCell(' +SUM(A1)'),"\"' +SUM(A1)\"")
 assert.equal(csvCell('-1'),"\"'-1\"")
 assert.equal(csvCell('a\"b'),'"a""b"')
 assert.equal(encodeCsv(['Name','Quantity'],[['a;b',4]]),'"Name";"Quantity"\r\n"a;b";"4"\r\n')
 assert.throws(()=>encodeCsv(['A'],[['a','b']]),/csv_column_mismatch/)
 assert.throws(()=>encodeCsv([],[]),/invalid_csv_headers/)
 const app=read('modern/src/main.tsx')
 assert.ok(!app.includes('export-csv'))
 for(const file of ['modern/src/screens/crew.tsx','modern/src/screens/operations.tsx','modern/src/screens/administration.tsx'])
  assert.ok(read(file).includes('import("../lib/export-csv")'))
})
test('candidate remains incomplete, has no production deployment or privileged permission bypass',()=>{
 const inventory=read('modern/scripts/inventory.mjs')
 const worker=read('modern/src/api/worker.ts')
 assert.ok(inventory.includes('migrationReady:false'))
 assert.ok(inventory.includes('productionCutoverAllowed:false'))
 assert.ok(inventory.includes('verifiedPages:0'))
 assert.ok(worker.includes('auth.getClaims(match[1])'))
 assert.ok(!worker.includes('SERVICE_ROLE'))
})
