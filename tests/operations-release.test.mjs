import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function source(path){return readFile(new URL(`../${path}`,import.meta.url),'utf8')}

test('admin command center is realtime without polling',async()=>{
 const [admin,realtime]=await Promise.all([source('app/(app)/admin/page.tsx'),source('components/realtime-refresh.tsx')])
 assert.match(admin,/Operationeel command center/)
 assert.match(admin,/<RealtimeRefresh\/>/)
 assert.match(admin,/\/admin\/health/)
 assert.match(realtime,/postgres_changes/)
 assert.doesNotMatch(realtime,/setInterval/)
})

test('planning keeps availability, duplication and overlap controls',async()=>{
 const [events,actions]=await Promise.all([source('app/(app)/events/page.tsx'),source('lib/actions/uptilldawn.ts')])
 assert.match(events,/Beschikbaarheid bevestigen/)
 assert.match(events,/Evenement dupliceren/)
 assert.match(events,/overlap_allowed/)
 assert.match(actions,/upt_set_event_availability_extended/)
 assert.match(actions,/duplicateEvent/)
 assert.match(actions,/upt_create_shift/)
})

test('god mode publish and restore remain CI gated',async()=>{
 const route=await source('app/api/god/source/route.ts')
 assert.match(route,/action: z\.enum\(\['save','restore','publish'\]\)/)
 assert.match(route,/latest\.conclusion !== 'success'/)
 assert.match(route,/behind_by > 0/)
 assert.match(route,/merge_method: 'squash'/)
})

test('recovery and leaked-password gates are documented',async()=>{
 const recovery=await source('docs/RECOVERY_AND_RELEASE_GATE.md')
 assert.match(recovery,/leaked-password protection must be enabled/i)
 assert.match(recovery,/empty isolated Supabase project/i)
 assert.match(recovery,/QR start request/)
})
