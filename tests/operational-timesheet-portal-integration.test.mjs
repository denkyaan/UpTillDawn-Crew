import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const administration=readFileSync(new URL('../app/(app)/portals/administration/timesheets/page.tsx',import.meta.url),'utf8')
const timesheets=readFileSync(new URL('../app/(app)/timesheets/page.tsx',import.meta.url),'utf8')
const controls=readFileSync(new URL('../components/crew/timesheet-controls.tsx',import.meta.url),'utf8')
const migration=readFileSync(new URL('../supabase/migrations/20261001102000_timesheet_approval_workflow.sql',import.meta.url),'utf8')
test('administration timesheets resolve event and crew identities without exposing privileged actions',()=>{
 assert.match(administration,/administrationAccess\(\)/)
 assert.match(administration,/eventFilter/)
 assert.match(administration,/event_id,user_id,status/)
 assert.match(administration,/eventNames\.get\(row\.event_id\)/)
 assert.match(administration,/profileNames\.get\(row\.user_id\)/)
 assert.match(administration,/statusCounts/)
 assert.doesNotMatch(administration,/upt_review_timesheet|upt_lock_timesheet/)
})
test('operational timesheets retain live RPCs and translated state for staff and reviewers',()=>{
 assert.match(timesheets,/TimesheetControls/)
 assert.match(controls,/upt_submit_timesheet/)
 assert.match(controls,/upt_review_timesheet/)
 assert.match(controls,/upt_lock_timesheet/)
 assert.match(controls,/copy\.statuses\[r\.status\]/)
})
test('database remains authority for event membership, self-review and admin locking',()=>{
 assert.match(migration,/event_members where event_id=p_event and user_id=auth\.uid\(\)/)
 assert.match(migration,/v\.user_id=auth\.uid\(\)/)
 assert.match(migration,/upt_is_admin\(auth\.uid\(\)\)/)
 assert.match(migration,/for update/)
 assert.match(migration,/upt_audit_logs/)
})
