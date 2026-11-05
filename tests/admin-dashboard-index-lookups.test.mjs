import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('app/(app)/admin/page.tsx','utf8')
test('admin dashboard indexes approved check-ins instead of scanning per shift',()=>{
 assert.match(source,/const approvedCheckKeys=new Set\(/)
 assert.match(source,/approvedCheckKeys\.has\(/)
 assert.doesNotMatch(source,/checkRows\.some\(/)
})
test('admin dashboard indexes breaks per session',()=>{
 assert.match(source,/const breaksBySession=new Map/)
 assert.match(source,/breaksBySession\.get\(ws\.id\)/)
 assert.match(source,/breaksBySession\.get\(session\.id\)/)
 assert.doesNotMatch(source,/sessionBreakRows\.filter\(row=>row\.work_session_id/)
})
