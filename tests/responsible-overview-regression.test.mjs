import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('responsible overview keeps operational data scoped to active assigned workplaces',async()=>{
 const source=await read('app/(app)/page.tsx')
 assert.match(source,/activeResponsibleAssignments=responsibleAssignments/)
 assert.match(source,/activeEventIds\.has\(assignment\.event_id\)/)
 assert.match(source,/allowedPairs=new Set\(activeAssignments\.map/)
 assert.match(source,/allowedPairs\.has\(/)
 assert.match(source,/activeResponsibleWorkplaces\.has\(incident\.workplace_id\)/)
})

test('responsible overview excludes archived and expired events from primary queries',async()=>{
 const source=await read('app/(app)/page.tsx')
 assert.match(source,/select\('id,name,venue,start_at,end_at,status'\)\.neq\('status','archived'\)\.gte\('end_at',now\)/)
 assert.match(source,/select\('id'\)\.neq\('status','archived'\)\.lte\('start_at', now\)\.gte\('end_at', now\)/)
})

test('responsible overview degrades per datasource and preserves the usable dashboard',async()=>{
 const source=await read('app/(app)/page.tsx')
 assert.match(source,/failedOverviewSources/)
 assert.match(source,/De beschikbare onderdelen blijven bruikbaar/)
 assert.doesNotMatch(source,/if\s*\(hasLoadError\)\s*return/)
})

test('responsible overview preserves role-specific timer privacy',async()=>{
 const [page,live]=await Promise.all([read('app/(app)/page.tsx'),read('components/responsible/responsible-live-personnel.tsx')])
 assert.match(page,/current\.role==='responsible_lead'/)
 assert.match(page,/ResponsibleLivePersonnel/)
 assert.match(page,/current\.role==='staff'/)
 assert.match(page,/StaffWorkplacePersonnel/)
 assert.match(live,/Pauzetimer/)
 assert.match(live,/Werktimer/)
})

test('responsible overview keeps mobile bottom-navigation clearance and bounded desktop width',async()=>{
 const source=await read('app/(app)/page.tsx')
 assert.match(source,/max-w-7xl/)
 assert.match(source,/pb-28/)
 assert.match(source,/md:p-8/)
})

test('responsible overview adds operational shortcuts without removing baseline capabilities',async()=>{
 const source=await read('app/(app)/page.tsx')
 assert.match(source,/Mijn operationele werkplek/)
 for(const href of ['/events','/workplaces','/operations','/briefings','/inventory','/tasks','/incidents'])assert.ok(source.includes(href),href)
 assert.match(source,/activeResponsibleAssignments\.length>0/)
})
