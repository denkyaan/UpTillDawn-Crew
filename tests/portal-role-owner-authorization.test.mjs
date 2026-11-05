import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../app/(app)/portals/roles/page.tsx',import.meta.url),'utf8')
const action=readFileSync(new URL('../lib/actions/portal-roles.ts',import.meta.url),'utf8')
const administrationLayout=readFileSync(new URL('../app/(app)/portals/administration/layout.tsx',import.meta.url),'utf8')
const promotionLayout=readFileSync(new URL('../app/(app)/portals/promotion/layout.tsx',import.meta.url),'utf8')

test('owner can access role management without a separate realIsAdmin flag',()=>{
 assert.match(page,/current\.isOwner \|\| \(current\.realIsAdmin && current\.approved && !current\.account_blocked\)/)
 assert.match(action,/!current\.isOwner && \(!current\.realIsAdmin \|\| !current\.approved \|\| current\.account_blocked\)/)
})

test('non-owner role management still requires active approved admin',()=>{
 assert.match(action,/if \(!current \|\|/)
 assert.match(action,/userId === current\.id/)
 assert.match(action,/upt_admin_set_portal_role/)
})

test('portal access is independently checked on server for both protected portals',()=>{
 for(const source of [administrationLayout,promotionLayout]){
  assert.match(source,/if\(!user\)redirect\("\/login"\)|if\(!current\)redirect\("\/login"\)/)
  assert.match(source,/upt_my_portal_assignments/)
  assert.match(source,/canOpenPortal\(/)
 }
})
