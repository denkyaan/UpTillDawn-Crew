import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('staff overview preserves baseline and adds assignment shortcuts',async()=>{
 const source=await read('app/(app)/page.tsx')
 assert.match(source,/current\.role==='staff'&&hasEventAssignment/)
 for(const value of ['Mijn evenement','Mijn werkuren','Briefing','Werkplaats & shift','Inventaris','Personeel van mijn werkplek']) assert.ok(source.includes(value))
 assert.doesNotMatch(source,/upt_staff_workplace_live_status/)
 assert.match(source,/StaffWorkplacePersonnel/)
})

test('staff mobile navigation preserves assigned and active-shift workflow',async()=>{
 const source=await read('components/layout/mobile-nav.tsx')
 assert.match(source,/ASSIGNED_EVENT_KEYS=\["events","briefings","workplaces"\]/)
 assert.match(source,/STAFF_ACTIVE_SHIFT_KEYS=\["operations","workplaces","briefings","tasks"\]/)
})

test('staff automation is self-scoped and God Mode configured',async()=>{
 const sql=await read('supabase/migrations/20260930224500_staff_operational_automations.sql')
 assert.match(sql,/"configuration":"god_mode_only"/)
 assert.match(sql,/ta\.user_id/)
 assert.match(sql,/s\.user_id=ta\.user_id/)
 assert.match(sql,/ba\.user_id=s\.user_id/)
 assert.match(sql,/automation_deliveries|emit_automation_notification/)
 assert.match(sql,/uptilldawn-staff-ops/)
})

test('staff defaults keep management surfaces inaccessible',async()=>{
 const source=await read('lib/role-ui.ts')
 const block=source.split('staff: [')[1].split('],\n}')[0]
 for(const key of ['overview','operations','events','briefings','workplaces','tasks','inventory','chat','crew','incidents']) assert.ok(block.includes(`"staff","${key}"`))
 assert.doesNotMatch(block,/"staff","(?:platform|personnel|exports|automations|god)"/)
})

test('staff workplace context excludes declined shifts while preserving teardown assignments',async()=>{
 const source=await read('app/(app)/workplaces/page.tsx')
 assert.match(source,/scheduled_start,scheduled_end/)
 assert.match(source,/futureShiftEventIds/)
 assert.match(source,/Date\.parse\(shift\.scheduled_end\)>=nowMs/)
 assert.doesNotMatch(source,/neq\('status','archived'\)\.gte\('end_at','now'\)/)
})
