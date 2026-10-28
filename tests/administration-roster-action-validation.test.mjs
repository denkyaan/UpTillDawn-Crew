import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('app/(app)/portals/administration/rosters/page.tsx','utf8')
test('roster actions reject unknown commands instead of applying a shift',()=>{
 const action=source.slice(source.indexOf('async function shiftAction('),source.indexOf('async function changeStatus('))
 assert.match(action,/\["target","apply"\]\.includes\(action\)/)
 assert.match(action,/action==="target"\?"upt_admin_roster_target":"upt_admin_roster_apply"/)
})
test('roster review requires rejection reason and bounds notes',()=>{
 const action=source.slice(source.indexOf('async function changeStatus('),source.indexOf('export const dynamic='))
 assert.match(action,/\["submit","approve","reject"\]\.includes\(action\)/)
 assert.match(action,/note\.length>2000/)
 assert.match(action,/action==="reject"&&!note/)
 assert.match(action,/p_note:note/)
})
test('roster creation bounds title and details',()=>{
 const action=source.slice(source.indexOf('async function createProposal('),source.indexOf('async function shiftAction('))
 assert.match(action,/title\.length>180/)
 assert.match(action,/details\.length>2000/)
})
