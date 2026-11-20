import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {aggregateDependencyHealth,dependencyIsSlow} from '../lib/health-checks.ts'
import {DEFAULT_SERVICE_LEVELS,serviceLevelMet} from '../lib/service-levels.ts'

test('health foundations remain available for internal observability',()=>{
 assert.equal(aggregateDependencyHealth([{name:'db',health:'healthy',checkedAt:1},{name:'sync',health:'degraded',checkedAt:1}]),'degraded')
 assert.equal(dependencyIsSlow({name:'db',health:'healthy',latencyMs:1001,checkedAt:1}),true)
 const sync=DEFAULT_SERVICE_LEVELS.find(item=>item.metric==='sync-success');assert.ok(sync);assert.equal(serviceLevelMet(sync,0.995),true)
})
test('health RPC remains privacy-safe admin-only backend infrastructure',async()=>{
 const source=await readFile(new URL('../supabase/migrations/20260927122752_admin_system_health_snapshot.sql',import.meta.url),'utf8')
 assert.match(source,/not public\.upt_is_admin\(v_actor\)/);assert.match(source,/offline_stale/);assert.match(source,/enabled_push_subscriptions/);assert.doesNotMatch(source,/endpoint|p256dh|auth_key|full_name/)
})
test('retired system-health UI cannot be opened or reached from admin',async()=>{
 const [page,admin]=await Promise.all([readFile(new URL('../app/(app)/admin/health/page.tsx',import.meta.url),'utf8'),readFile(new URL('../app/(app)/admin/page.tsx',import.meta.url),'utf8')])
 assert.match(page,/redirect\('\/admin'\)/);assert.doesNotMatch(page,/Systeemgezondheid|upt_admin_system_health|RealtimeRefresh/);assert.doesNotMatch(admin,/href="\/admin\/health"|Systeemgezondheid/)
})
