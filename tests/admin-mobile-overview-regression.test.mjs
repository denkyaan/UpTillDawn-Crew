import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('admin overview degrades per datasource instead of blanking the dashboard',async()=>{
 const source=await read('app/(app)/admin/page.tsx')
 assert.match(source,/failedOverviewSources/)
 assert.doesNotMatch(source,/results\.some\(x=>x\.error\).*Overzichtsgegevens konden niet volledig worden geladen/s)
 assert.match(source,/De beschikbare onderdelen blijven bruikbaar/)
})
test('mobile admin AI sits above bottom navigation and chat stacks above it',async()=>{
 const [layout,chat]=await Promise.all([read('components/layout/app-layout.tsx'),read('components/layout/floating-chat-button.tsx')])
 assert.match(layout,/fixed bottom-20 right-4/)
 assert.match(layout,/stackedAboveAdminAi=\{Boolean\(isAdmin\)\}/)
 assert.match(chat,/stackedAboveAdminAi \? "9\.5rem" : "5rem"/)
})

test('admin action center excludes operational alerts for non-running events',async()=>{
 const source=await read('app/(app)/admin/page.tsx')
 assert.match(source,/activeEventIds=new Set\(activeEvents\.map\(event=>event\.id\)\)/)
 assert.match(source,/operationalAlertRows=alertRows\.filter\(alert=>activeEventIds\.has\(alert\.event_id\)\)/)
 assert.match(source,/\.\.\.operationalAlertRows\.map\(alert=>/)
})

test('normal admin overview does not expose God Mode automation management',async()=>{
 const source=await read('app/(app)/admin/page.tsx')
 assert.doesNotMatch(source,/automation_rules|Actieve automatiseringen|#automatiseringen/)
})

test('admin overview uses one authoritative break-session dataset',async()=>{
 const source=await read('app/(app)/admin/page.tsx')
 const breakQueries=[...source.matchAll(/s\.from\('break_sessions'\)/g)]
 assert.equal(breakQueries.length,1)
 assert.match(source,/activeBreakRows=sessionBreakRows\.filter\(row=>!row\.ended_at\)/)
 assert.match(source,/sessionBreaks\.error\?1:0/)
})

test('admin overview keeps the established default navigation and excludes retired surfaces',async()=>{
 const source=await read('app/(app)/admin/page.tsx')
 for(const href of ['/admin/time-records','/events','/operations','/personnel','/incidents','/tasks','/crew'])assert.ok(source.includes(href),href)
 assert.doesNotMatch(source,/href=["']\/admin\/(?:health|release)/)
})
