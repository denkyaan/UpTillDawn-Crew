import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const paths=[
 'app/(app)/portals/administration/modules/[slug]/page.tsx',
 'app/(app)/portals/administration/finance/page.tsx',
 'app/(app)/portals/administration/rosters/page.tsx'
]
for(const path of paths){
 test(path+' uses verified admin access',()=>{
  const source=readFileSync(path,'utf8')
  assert.match(source,/\.realIsAdmin/)
  assert.doesNotMatch(source,/\b(?:current|user)\.isAdmin\b/)
  assert.match(source,/upt_my_portal_assignments/)
  assert.match(source,/canOpenPortal\(["']administration["']/)
 })
}
