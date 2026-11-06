import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/admin/management/event-tasks/page.tsx','utf8')
const hub=readFileSync('app/(app)/admin/management/page.tsx','utf8')
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
 assert.ok(hub.includes('href:"/admin/management/event-tasks"'))
 assert.ok(page.includes('href="/admin/management"'))
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
