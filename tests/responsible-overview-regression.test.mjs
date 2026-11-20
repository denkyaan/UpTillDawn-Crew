import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('responsible overview keeps operational data scoped to active assigned workplaces',async()=>{
 const source=await read('app/(app)/page.tsx')
 assert.match(source,/activeResponsibleAssignments=responsibleAssignments/)
 assert.match(source,/activeEventIds\.has\(assignment\.event_id\)/)
 assert.match(source,/upt_manager_live_sessions/)
 assert.match(source,/activeRows\.filter\(row=>activeResponsibleWorkplaces\.has\(row\.workplace_id\)\)/)
 assert.match(source,/activeResponsibleAssignments/)
 assert.match(source,/activeResponsibleWorkplaces\.has\(incident\.workplace_id\)/)
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

test('responsible overview keeps unresolved assigned-workplace incidents visible until resolved',async()=>{
 const source=await read('app/(app)/page.tsx')
 assert.match(source,/from\('incidents'\).*neq\('status', 'resolved'\)/)
 assert.doesNotMatch(source,/from\('incidents'\).*gte\('created_at'/)
 assert.match(source,/activeResponsibleWorkplaces\.has\(incident\.workplace_id\)/)
})

test('responsible mobile navigation preserves baseline and adds assigned inventory context',async()=>{
 const source=await read('components/layout/mobile-nav.tsx')
 assert.match(source,/RESPONSIBLE_ASSIGNED_EVENT_KEYS=\["events","briefings","workplaces","inventory"\]/)
 assert.match(source,/RESPONSIBLE_ACTIVE_SHIFT_KEYS=\["operations","workplaces","incidents"\]/)
 assert.match(source,/roleKey==="responsible_lead"/)
})

test('responsible defaults exclude admin and God Mode management surfaces',async()=>{
 const source=await read('lib/role-ui.ts')
 const block=source.split('responsible_lead: [')[1].split('],\\n  staff:')[0]
 for(const forbidden of ['platform','personnel','exports','automations','god'])assert.doesNotMatch(block,new RegExp('"'+forbidden+'"'))
 for(const allowed of ['overview','operations','events','tasks','briefings','workplaces','inventory','guestlist','chat','crew','incidents'])assert.match(block,new RegExp('"'+allowed+'"'))
})

test('responsible overview cleanup keeps queries minimal and ignores cancelled shifts',async()=>{
 const source=await read('app/(app)/page.tsx')
 assert.match(source,/current\.full_name/)
 assert.doesNotMatch(source,/from\('profiles'\)\.select\('full_name,approved'\)/)
 assert.match(source,/from\('profiles'\)\.select\('id,full_name'\)/)
 assert.match(source,/select\('id,name,venue,start_at,end_at,status'\)/)
 assert.match(source,/select\('id,workplace_id,event_id,scheduled_start,scheduled_end,response_status'\).*neq\('status','cancelled'\).*neq\('response_status','declined'\)/)
 assert.doesNotMatch(source,/select\('full_name,approved,role'\)/)
})
