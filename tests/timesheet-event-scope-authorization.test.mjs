import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../app/(app)/timesheets/page.tsx',import.meta.url),'utf8')
test('timesheets cannot query event IDs outside the role-scoped event directory',()=>{
 const guard=source.indexOf('if(eventId&&!eventOptions.some(event=>event.id===eventId))eventId=undefined')
 const query=source.indexOf("s.from('timesheets').select(")
 assert.ok(guard>0&&query>guard)
 assert.match(source,/if\(!eventId\)eventId=eventOptions\[0\]\?\.id/)
})
