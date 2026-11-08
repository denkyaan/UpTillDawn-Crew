import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const events=readFileSync(new URL('../app/(app)/events/page.tsx',import.meta.url),'utf8')
const timesheets=readFileSync(new URL('../app/(app)/timesheets/page.tsx',import.meta.url),'utf8')
const controls=readFileSync(new URL('../components/crew/timesheet-controls.tsx',import.meta.url),'utf8')
test('event cards preserve selected event when opening timesheet workflow',()=>{
 assert.match(events,/<ContextLink href="\/timesheets" context=\{\{eventId:event\.id\}\}/)
})
test('timesheets list admin events independently of own event membership',()=>{
 assert.match(timesheets,/current\.realIsAdmin\|\|current\.isOwner/)
 assert.match(timesheets,/isAdmin\?await s\.from\('events'\)/)
 assert.match(timesheets,/await s\.from\('event_members'\)/)
 assert.match(timesheets,/eventOptions\.map\(event=>/)
 assert.match(timesheets,/encodeURIComponent\(event\.id\)/)
 assert.match(timesheets,/aria-current=\{event\.id===eventId/)
})
test('invalid event identifiers are not passed to database queries',()=>{
 assert.match(timesheets,/if\(eventId&&!\/\^\[0-9a-f\]/)
 assert.match(timesheets,/eventId=undefined/)
})
test('event selection retains server-side review and lock RPC authorization',()=>{
 assert.match(controls,/upt_submit_timesheet/)
 assert.match(controls,/upt_review_timesheet/)
 assert.match(controls,/upt_lock_timesheet/)
})
