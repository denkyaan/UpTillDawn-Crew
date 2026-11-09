import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/admin/management/event-tasks/page.tsx','utf8')
const tasks=readFileSync('app/(app)/tasks/page.tsx','utf8')
test('admin event task overview enforces role and approval',()=>{
 assert.ok(page.includes('!actor?.isAdmin'))
 assert.ok(page.includes('actor.account_blocked'))
 assert.ok(page.includes('.not("event_id","is",null)'))
 assert.ok(page.includes('.range((page-1)*30,page*30)'))
 assert.ok(page.includes('requestedEvent&&!event'))
 assert.ok(page.includes('query=query.eq("event_id",event)'))
 assert.ok(page.includes('eventNames.get(task.event_id)'))
 assert.ok(page.includes('encodeURIComponent(event)'))
})
test('event task overview stays within admin and has all locales',()=>{
 assert.ok(tasks.includes('href="/admin/management/event-tasks"'))
 assert.ok(page.includes('href="/tasks"'))
 assert.ok(page.includes('href="/tasks"'))
 for(const locale of ['nl:','fr:','en:','de:'])assert.ok(page.includes(locale))
 assert.ok(!page.includes('href="/portals/administration'))
})

test('admin creates tasks through existing authorized server action with eligible event members',()=>{
 assert.ok(page.includes('form action={createTask}'))
 assert.ok(page.includes('name="event_id" value={selectedEvent}'))
 assert.ok(page.includes('name="user_id" required'))
 assert.ok(page.includes('.eq("response","can")'))
 assert.ok(page.includes('.eq("approved",true)'))
 assert.ok(page.includes('directoryIncomplete'))
})

test('multi-assignment uses repeated user_id fields and invalid event does not select another event',()=>{
 assert.ok(page.includes('name="user_id" required multiple'))
 assert.ok(page.includes('requestedEvent?(event??null)'))
 assert.ok(page.includes('!selectedEvent||!eligible.length'))
})

test('admin task assignment changes require authorization and audited RPCs',()=>{
 assert.ok(page.includes('actor.realIsAdmin'))
 assert.ok(page.includes('actor.account_blocked'))
 assert.ok(page.includes('upt_assign_task'))
 assert.ok(page.includes('upt_remove_task_assignment'))
 assert.ok(page.includes('revalidatePath("/admin/management/event-tasks")'))
 assert.ok(page.includes('assignmentOverflow'))
 assert.ok(page.includes('action={updateAssignment}'))
})

test('admin assignment lists show staff names and fail closed on incomplete directory',()=>{
 assert.ok(page.includes('assignedNames.get(item.user_id)'))
 assert.ok(page.includes('assignmentNamesIncomplete'))
 assert.ok(page.includes('!assignedProfilesError&&!assignmentNamesIncomplete'))
})

test('task editing uses authenticated audited RPC and bounded fields',()=>{
 assert.ok(page.includes('action={editEventTask}'))
 assert.ok(page.includes('upt_admin_update_event_task'))
 assert.ok(page.includes('title.length>200||description.length>4000'))
 assert.ok(page.includes('revalidatePath("/tasks")'))
})

test('task creation prioritizes next upcoming event and assignment statuses are visible',()=>{
 assert.ok(page.includes('.gte("start_at",new Date().toISOString())'))
 assert.ok(page.includes('upcomingEvent?.id'))
 assert.ok(page.includes('upcomingError?null'))
 assert.ok(page.includes('.select("id,task_id,user_id,status,confirmed_at")'))
 assert.ok(page.includes('{item.status}'))
})

test('task progress and completion confirmation are derived from persisted assignments',()=>{
 assert.ok(page.includes('.select("id,task_id,user_id,status,confirmed_at")'))
 assert.ok(page.includes('item.status==="COMPLETED"'))
 assert.ok(page.includes('item.confirmed_at'))
 assert.ok(page.includes('new Date(item.confirmed_at).toLocaleString(locale)'))
 assert.ok(page.includes('!assignmentError&&!assignmentOverflow'))
})
