import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/administration/promotion-discipline/page.tsx','utf8')
test('promotion moderation actions require approved, unblocked admin',()=>{
 assert.equal(page.split('actor.account_blocked&&!actor.isOwner').length-1,4)
 assert.ok(page.includes('actor.realIsAdmin'))
 assert.ok(page.includes('actor.approved'))
})
test('promotion moderation rejects malformed UUIDs and preserves admin navigation',()=>{
 assert.equal(page.split('(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}').length-1,3)
 assert.ok(page.includes('href={actor.realIsAdmin||actor.isOwner?"/admin/management":"/portals/administration"}'))
})
