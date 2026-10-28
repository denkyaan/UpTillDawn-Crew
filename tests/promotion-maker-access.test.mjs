import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const portal=readFileSync('app/(app)/portals/[portal]/page.tsx','utf8')
const layout=readFileSync('app/(app)/portals/promotion/layout.tsx','utf8')
test('promotion landing permits server-verified permanent admins even in staff role mode',()=>{
 assert.match(portal,/!current\.realIsAdmin && !current\.isOwner && !canOpenPortal/)
 assert.match(portal,/error && !current\.realIsAdmin && !current\.isOwner/)
})
test('promotion layout uses permanent authorization for role-switched admins',()=>{
 assert.match(layout,/!current\.isOwner&&!current\.realIsAdmin/)
 assert.doesNotMatch(layout,/!current\.isOwner&&!current\.isAdmin/)
})
