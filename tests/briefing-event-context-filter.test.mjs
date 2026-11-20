import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../app/(app)/briefings/page.tsx',import.meta.url),'utf8')
test('briefing event context filters general and personal instructions',()=>{
 assert.match(source,/visibleBriefs=visibleBriefs\.filter\(b=>\(!params\.event\|\|b\.event_id===params\.event\)/)
 assert.match(source,/visiblePersonal=visiblePersonal\.filter\(i=>\(!params\.event\|\|i\.event_id===params\.event\)/)
})
test('workplace and personal briefing context narrows visible records',()=>{
 assert.match(source,/!params\.workplace\|\|b\.workplace_id===params\.workplace/)
 assert.match(source,/!params\.workplace\|\|i\.workplace_id===params\.workplace/)
 assert.match(source,/!params\.user\|\|i\.user_id===params\.user/)
})
test('event and role authorization precede context filtering',()=>{
 assert.ok(source.indexOf('const staffCanReadBriefing')<source.indexOf('visibleBriefs=visibleBriefs.filter'))
 assert.match(source,/assignedEventIds\.has\(b\.event_id\)/)
})
