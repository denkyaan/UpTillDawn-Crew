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
