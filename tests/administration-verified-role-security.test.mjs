import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const finance=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
const modules=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')
const layout=readFileSync('app/(app)/portals/administration/layout.tsx','utf8')
const access=readFileSync('lib/portal-access-server.ts','utf8')

test('financial approval role is derived from verified administrator identity',()=>{
 assert.ok(finance.includes('isAdmin:current.realIsAdmin || current.isOwner'))
 assert.ok(finance.includes('const allowed = isAdmin ?'))
 assert.ok(finance.includes("if(!isAdmin||!['approved','cancelled'].includes(status)"))
})
test('finance and module guards enforce the same verified role as layout',()=>{
 for(const source of [finance,modules,layout]){
  assert.ok(source.includes('.realIsAdmin'))
  assert.ok(source.includes('canOpenPortal('))
 }
 for(const source of [finance,layout])assert.ok(source.includes('currentPortalAssignments'))
 assert.ok(modules.includes('upt_my_portal_assignments'))
 assert.match(access,/cache\(async\(\)=>/)
 assert.match(access,/supabase\.rpc\('upt_my_portal_assignments'\)/)
 assert.ok(!finance.includes('current.isAdmin'))
 assert.ok(!modules.includes('current.isAdmin'))
})
