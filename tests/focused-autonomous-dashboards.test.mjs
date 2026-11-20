import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {dashboardNextAction,dashboardActionCopy} from '../lib/dashboard-next-action.ts'

const now=Date.parse('2026-11-10T12:00:00Z')
const shift=(start,end,id='a')=>({id,event_id:'00000000-0000-4000-8000-000000000001',workplace_id:'00000000-0000-4000-8000-000000000002',scheduled_start:start,scheduled_end:end})

test('next action prioritizes active shift over future shifts and retains navigation context',()=>{
 const action=dashboardNextAction([
  shift('2026-11-11T12:00:00Z','2026-11-11T20:00:00Z','later'),
  shift('2026-11-10T10:00:00Z','2026-11-10T18:00:00Z','now')
 ],now,true)
 assert.equal(action.kind,'active')
 assert.equal(action.href,'/operations?event=00000000-0000-4000-8000-000000000001&workplace=00000000-0000-4000-8000-000000000002')
})

test('briefing is the next action within 48 hours, but distant shift opens planning',()=>{
 assert.equal(dashboardNextAction([shift('2026-11-11T12:00:00Z','2026-11-11T20:00:00Z')],now,true).kind,'prepare')
 const distant=dashboardNextAction([shift('2026-11-16T12:00:00Z','2026-11-16T20:00:00Z')],now,true)
 assert.equal(distant.kind,'scheduled')
 assert.match(distant.href,/^\/workplaces\?event=/)
})
test('past and invalid shifts are ignored; no fabricated assignment is asserted',()=>{
 assert.equal(dashboardNextAction([shift('2026-11-09T12:00:00Z','2026-11-09T20:00:00Z'),shift('invalid','invalid')],now,true).kind,'assigned')
 assert.equal(dashboardNextAction([],now,false).kind,'discover')
})
test('action copy is complete in four languages',()=>{
 for(const locale of ['nl','fr','en','de']){
  assert.ok(dashboardActionCopy[locale].heading)
  for(const kind of ['active','prepare','scheduled','assigned','discover']){
   for(const field of ['title','description','button'])assert.ok(dashboardActionCopy[locale][kind][field],locale+' '+kind+' '+field)
  }
 }
})
test('daily dashboards prioritize actionable work and never hide extras',()=>{
 const page=readFileSync('app/(app)/page.tsx','utf8')
 const admin=readFileSync('app/(app)/admin/page.tsx','utf8')
 const queue=readFileSync('components/admin/action-center.tsx','utf8')
 assert.match(page,/data-next-action=\{action\.kind\}/)
 assert.match(page,/\.gte\('scheduled_end',nowDate\.toISOString\(\)\)/)
 assert.match(page,/upcomingEvents\.slice\(0, 3\)/)
 assert.match(page,/!shiftsResult\.error.*!eventsResult\.error/)
 assert.match(admin,/return href\?<Link href=\{href\}/)
 assert.ok(admin.indexOf('<AdminActionCenter items={actionQueue}/>')<admin.indexOf('Event command centers'))
 assert.match(queue,/expanded\?sorted:sorted\.slice\(0,12\)/)
 assert.match(queue,/aria-expanded=\{expanded\}/)
})
