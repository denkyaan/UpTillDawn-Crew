import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {getTourChapters} from '../lib/tour-training.ts'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('all role tours include core workflows and all four translations',()=>{
 const core=['overview','events','workplaces','briefings','operations','tasks','incidents','inventory','crew','chat','settings']
 for(const role of ['employee','responsible_lead','admin']){
  const chapters=getTourChapters(role,{scope:'general'})
  const keys=new Set(chapters.map(chapter=>chapter.key))
  for(const key of core)assert.ok(keys.has(key),role+' missing '+key)
  for(const chapter of chapters){
   assert.ok(chapter.route.startsWith('/'))
   for(const language of ['nl','fr','en','de']){
    assert.ok(chapter.title[language]?.trim(),role+' '+chapter.key+' title '+language)
    assert.ok(chapter.description[language]?.trim(),role+' '+chapter.key+' description '+language)
   }
  }
 }
})

test('admin has management chapters and crew cannot access admin-only chapters',()=>{
 const admin=new Set(getTourChapters('admin',{scope:'general'}).map(c=>c.key))
 for(const key of ['sales','personnel','exports','platform'])assert.ok(admin.has(key),'admin missing '+key)
 for(const role of ['employee','responsible_lead']){
  const keys=new Set(getTourChapters(role,{scope:'general'}).map(c=>c.key))
  for(const key of ['sales','personnel','exports','platform'])assert.ok(!keys.has(key),role+' exposes '+key)
 }
})

test('all training sandboxes have localized exercises without database writes',async()=>{
 const paths=['sandbox-events','sandbox-workplaces','sandbox-briefings','sandbox-operations','sandbox-feature-pages','sandbox-role-module']
 for(const name of paths){
  const source=await read('components/training/'+name+'.tsx')
  assert.match(source,/\b(?:tr|t)\(\s*(?:l|locale)\s*,/,name+' missing translations')
  assert.doesNotMatch(source,/createClient\(|\.from\(|\.rpc\(/,name+' must not access production')
 }
 const features=await read('components/training/sandbox-feature-pages.tsx')
 for(const kind of ['tasks','inventory','incidents','guestlist','sales','timesheet'])assert.ok(features.includes('kind="'+kind+'"'),'missing '+kind)
 const operations=await read('components/training/sandbox-operations.tsx')
 assert.match(operations,/driverChecks/)
 assert.match(operations,/!\["working","at_person","task","resumed"\]\.includes\(phase\)/)
})


test('each role receives its own functional tour instead of one identical workflow',()=>{
 const keys=role=>new Set(getTourChapters(role,{scope:'general'}).map(chapter=>chapter.key))
 const admin=keys('admin')
 const responsible=keys('responsible_lead')
 const employee=keys('employee')
 for(const key of ['sales','personnel','exports','platform']){
  assert.ok(admin.has(key),'admin must cover '+key)
  assert.ok(!responsible.has(key),'responsible must not see '+key)
  assert.ok(!employee.has(key),'employee must not see '+key)
 }
 assert.notDeepEqual([...admin].sort(),[...employee].sort(),'admin and employee tours must differ')
 assert.notDeepEqual([...admin].sort(),[...responsible].sort(),'admin and responsible tours must differ')
})


test('granular training exercise contracts preserve separate role permissions',async()=>{
 const {ROLE_EXERCISES}=await import('../lib/training/role-exercise-plan.ts')
 for(const role of ['admin','responsible_lead','employee']){
  const modules=ROLE_EXERCISES[role]
  assert.ok(Object.keys(modules).length>=9,role+' needs broad functional training')
  for(const [module,actions] of Object.entries(modules)){
   assert.ok(actions.length>=2,role+' '+module+' needs multiple real actions')
   assert.equal(new Set(actions).size,actions.length,role+' '+module+' has duplicate exercises')
  }
 }
 for(const restricted of ['personnel','sales','platform','exports']) {
  assert.ok(ROLE_EXERCISES.admin[restricted])
  assert.equal(ROLE_EXERCISES.employee[restricted],undefined)
  assert.equal(ROLE_EXERCISES.responsible_lead[restricted],undefined)
 }
 assert.ok(ROLE_EXERCISES.admin.operations.includes('approve-timesheet'))
 assert.ok(ROLE_EXERCISES.responsible_lead.operations.includes('confirm-crew-arrival'))
 assert.ok(ROLE_EXERCISES.employee.operations.includes('submit-timesheet'))
})
