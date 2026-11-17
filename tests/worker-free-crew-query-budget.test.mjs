import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const tasks=readFileSync('app/(app)/tasks/page.tsx','utf8')
const events=readFileSync('app/(app)/events/page.tsx','utf8')

test('Tasks requests are RLS-scoped and bounded without altering manager permissions',()=>{
 assert.match(tasks,/await boundedQueries\(\[/)
 assert.match(tasks,/\],3\)/)
 assert.match(tasks,/isAdmin\|\|isResponsible\?taskAssignmentQuery:taskAssignmentQuery\.eq\('user_id',user\.id\)/)
 assert.match(tasks,/const manager = isAdmin \|\| isResponsible/)
 assert.match(tasks,/const hasActiveShift/)
 assert.match(tasks,/const activeEvents=\(events\|\|\[\]\)\.filter/)
 assert.match(tasks,/const openEvents=\(events\|\|\[\]\)\.filter/)
 assert.match(tasks,/manager\s*\? s\.from\('event_availability'\)/)
 assert.match(tasks,/Promise\.resolve\(\{data:\[\] as \{event_id:string;user_id:string\}\[\]\}\)/)
 const primaryReads=tasks.slice(tasks.indexOf('const ['),tasks.indexOf('],3)')+4)
 assert.equal((primaryReads.match(/s\.from\('events'\)/g)||[]).length,1,
   'Tasks must not fetch the same event listing three times per request')
 assert.match(tasks,/if \(!manager && !hasOpenAssignedEvent\) redirect\('\/events'\)/)
 assert.match(tasks,/ManagerOnly/)
 assert.match(tasks,/StaffAvailability/)
 assert.match(tasks,/action=\{createTask\}/)
 assert.match(tasks,/action=\{removeTaskAssignment\}/)
})

test('Private work-media attachments use bounded signing batches under existing storage RLS',()=>{
 assert.match(tasks,/const attachmentPaths=\[\.\.\.new Set\(/)
 assert.match(tasks,/attachmentPaths\.length;offset\+=100/)
 assert.match(tasks,/\.createSignedUrls\(attachmentPaths\.slice\(offset,offset\+100\),300\)/)
 assert.match(tasks,/item\.path&&item\.signedUrl&&allowedPaths\.has\(item\.path\)/)
 assert.doesNotMatch(tasks,/\.createSignedUrl\(attachment\.storage_path, 300\)/)
 assert.match(tasks,/s\.from\('work_attachments'\)\.select\('\*'\)\.in\('task_id', taskIds\)/)
})

test('Events retains admin-wide availability, scoped staff response and all original workflow actions',()=>{
 assert.match(events,/user\.isAdmin\?availabilityQuery:availabilityQuery\.eq\('user_id',user\.id\)/)
 assert.match(events,/scopedAvailability,/)
 assert.match(events,/new Set\(events\.filter\(event=>Date\.parse\(event\.start_at\)<=nowMs\)/)
 assert.doesNotMatch(events,/\.select\('id'\)\.lte\('start_at','now'\)/)
 for(const action of ['createEvent','updateEvent','duplicateEvent','setEventAvailability','assignAvailableCrewShift']){
  assert.ok(events.includes('action={'+action+'}'),action)
 }
 assert.match(events,/EmergencyInformationPanel/)
 assert.match(events,/EventDocumentsPanel/)
 assert.match(events,/AdminOnly/)
 assert.match(events,/confirmedCounts/)
})
