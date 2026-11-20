import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const source=readFileSync('app/(app)/portals/administration/rosters/page.tsx','utf8')

test('roster actions reject invalid identifiers and unauthorized review',()=>{
 assert.match(source,/Invalid roster identifier/)
 assert.match(source,/Invalid shift identifier/)
 assert.match(source,/action!=="submit"&&!user\.realIsAdmin&&!user\.isOwner/)
 assert.match(source,/Admin required for roster review/)
 assert.doesNotMatch(source,/user\.realIsAdmin&&\["approve","reject"\]\.includes\(action\).*:null/)
})
test('roster owner permissions and review errors remain explicit',()=>{
 assert.match(source,/!user\.realIsAdmin&&!user\.isOwner/)
 assert.match(source,/if\(result\.error\)throw new Error\("Roster transition failed"\)/)
 assert.match(source,/p\.created_by!==user\.id/)
})

test('roster review enforces separation of duties server-side',()=>{
 assert.match(source,/\.from\("admin_roster_proposals"\)\.select\("created_by,status"\)\.eq\("id",id\)\.maybeSingle\(\)/)
 assert.match(source,/proposal\.status!=="submitted"/)
 assert.match(source,/proposal\.created_by===user\.id/)
 assert.match(source,/Roster creator cannot review their own proposal/)
 assert.match(source,/Invalid roster proposal/)
})
