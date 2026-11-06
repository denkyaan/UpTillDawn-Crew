import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'

const navigation=readFileSync('lib/administration/navigation.ts','utf8')
const tabs=readFileSync('components/administration/administration-navigation.tsx','utf8')

test('relations navigation exposes implemented administration destinations',()=>{
 for(const slug of ['counterparties','promotion-tasks']){
  assert.match(navigation,new RegExp('"'+slug+'"'))
  assert.ok(existsSync('app/(app)/portals/administration/'+slug+'/page.tsx'))
  assert.match(tabs,new RegExp('slug==="'+slug+'"'))
 }
 assert.match(navigation,/if\(slug==="counterparties"\|\|slug==="promotion-tasks"\)/)
})

test('navigation closes expanded subtabs on pathname changes',()=>{
 assert.match(tabs,/selectedCategory\?\.pathname===pathname/)
 assert.match(tabs,/onClick=\{\(\)=>setSelectedCategory\(null\)\}/)
})

test('notification action stays inside the notifications module',()=>{
 const page=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')
 assert.match(page,/id="administration-notifications"/)
 assert.match(page,/href="#administration-notifications"[^\n]*Open meldingen/)
})

test('notification read action is restricted to the current user and approved administration access',()=>{
 const source=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')
 assert.ok(source.includes('async function markAdministrationNotificationRead(formData:FormData)'))
 assert.ok(source.includes(".eq('user_id',current.id).is('read_at',null)"))
 assert.ok(source.includes("canOpenPortal('administration'"))
 assert.ok(source.includes('action={markAdministrationNotificationRead}'))
})
