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
 assert.match(tabs,/useEffect\(\(\)=>\{setSelectedCategory\(null\)\},\[pathname\]\)/)
 assert.match(tabs,/onClick=\{\(\)=>setSelectedCategory\(null\)\}/)
})
