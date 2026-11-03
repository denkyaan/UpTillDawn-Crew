import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const administration=readFileSync('app/(app)/portals/administration/layout.tsx','utf8')
const promotion=readFileSync('app/(app)/portals/promotion/layout.tsx','utf8')
for(const [name,source] of [['administration',administration],['promotion',promotion]]){
 test(name+' portal layout rejects blocked accounts and checks assigned access',()=>{
  assert.match(source,/if\(!\w+\)redirect\("\/login"\)/)
  assert.match(source,/\.approved\|\|\w+\.account_blocked/)
  assert.match(source,/\.realIsAdmin/)
  assert.match(source,/upt_my_portal_assignments/)
  assert.match(source,new RegExp('canOpenPortal\\("'+name+'"'))
  assert.match(source,/redirect\("\/portals"\)/)
 })
}
