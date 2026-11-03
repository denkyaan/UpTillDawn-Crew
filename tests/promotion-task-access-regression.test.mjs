import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('app/(app)/portals/promotion/tasks/page.tsx','utf8')
test('promotion page and both server actions validate portal membership',()=>{
 assert.match(source,/async function requirePromotionAccess\(\)/)
 assert.match(source,/canOpenPortal\("promotion"/)
 assert.match(source,/user\.account_blocked/)
 assert.equal((source.match(/await requirePromotionAccess\(\)/g)||[]).length,3)
})
test('promotion task and evidence inputs reject malformed identifiers',()=>{
 assert.match(source,/const validAssignmentId=/)
 assert.match(source,/Invalid promotion task transition/)
 assert.match(source,/Invalid promotion evidence submission/)
 assert.match(source,/\.eq\("user_id",user\.id\)\.maybeSingle\(\)/)
})

test('starting promotion work requires ownership and the not-started state',()=>{
 assert.match(source,/\.eq\("id",id\)\.eq\("user_id",user\.id\)\.maybeSingle\(\)/)
 assert.match(source,/assigned\.status!=="NOT STARTED"/)
 assert.match(source,/Only your not-started assignment can be started/)
 assert.match(source,/upt_update_task_status/)
})
