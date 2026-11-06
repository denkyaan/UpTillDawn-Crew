import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync('app/(app)/portals/administration/promotion-tasks/page.tsx','utf8')
const layout=readFileSync('app/(app)/portals/administration/layout.tsx','utf8')

test('authorized administration personnel can open promotion tasks through portal layout',()=>{
 assert.match(layout,/canOpenPortal\("administration"/)
 assert.match(page,/getCurrentUser\(\)/)
 assert.doesNotMatch(page,/!actor\.isAdmin&&!actor\.isOwner/)
 assert.match(page,/href="\/portals\/administration\/promotion-discipline"/)
})

test('administration promotion tasks support filtered stable pagination',()=>{
 const page=readFileSync('app/(app)/portals/administration/promotion-tasks/page.tsx','utf8')
 assert.ok(page.includes('tasksQuery.ilike("title"'))
 assert.ok(page.includes('.order("created_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+pageSize)'))
 assert.ok(page.includes('name="q" defaultValue={q}'))
 assert.ok(page.includes('href={pageHref(page+1)}'))
 for(const label of ['Zoek promotietaken','Rechercher des tâches','Search promotion tasks','Promotionsaufgaben suchen'])assert.ok(page.includes(label))
})

test('promotion task overview exposes instructions and event scope in four languages',()=>{
 assert.ok(page.includes('.select("id,title,description,event_id,created_at")'))
 assert.ok(page.includes('task.description&&'))
 assert.ok(page.includes('task.event_id?'))
 for(const label of ['Algemene taak','Tâche générale','General task','Allgemeine Aufgabe'])assert.ok(page.includes(label))
})

test('promotion task scope filters are database-side and survive pagination',()=>{
 assert.ok(page.includes('tasksQuery.not("event_id","is",null)'))
 assert.ok(page.includes('tasksQuery.is("event_id",null)'))
 assert.ok(page.includes('name="scope" defaultValue={scope}'))
 assert.ok(page.includes('...(scope!=="all"?{scope}:{})'))
 for(const label of ['Alle taken','Toutes les tâches','All tasks','Alle Aufgaben'])assert.ok(page.includes(label))
})
