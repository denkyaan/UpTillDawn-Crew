import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  aggregateDependencyHealth,
  dependencyIsSlow,
} from '../lib/health-checks.ts'
import {
  DEFAULT_SERVICE_LEVELS,
  serviceLevelMet,
} from '../lib/service-levels.ts'

test('health foundations classify dependency and sync service levels', () => {
  assert.equal(aggregateDependencyHealth([
    {name:'db',health:'healthy',checkedAt:1},
    {name:'sync',health:'degraded',checkedAt:1},
  ]),'degraded')
  assert.equal(dependencyIsSlow({name:'db',health:'healthy',latencyMs:1001,checkedAt:1}),true)
  const sync=DEFAULT_SERVICE_LEVELS.find(item=>item.metric==='sync-success')
  assert.ok(sync)
  assert.equal(serviceLevelMet(sync,0.995),true)
  assert.equal(serviceLevelMet(sync,0.99),false)
})

test('admin health RPC exposes aggregate metrics only and is browser-admin gated', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927122752_admin_system_health_snapshot.sql',import.meta.url),'utf8')
  assert.match(source,/create or replace function public\.upt_admin_system_health\(\)/)
  assert.match(source,/not public\.upt_is_admin\(v_actor\)/)
  assert.match(source,/revoke all on function public\.upt_admin_system_health\(\)/)
  assert.match(source,/grant execute on function public\.upt_admin_system_health\(\)[\s\S]*?to authenticated/)
  assert.doesNotMatch(source,/endpoint/)
  assert.doesNotMatch(source,/p256dh/)
  assert.doesNotMatch(source,/auth_key/)
  assert.doesNotMatch(source,/full_name/)
  assert.match(source,/offline_stale/)
  assert.match(source,/enabled_push_subscriptions/)
})

test('system health route exists behind immutable admin access and uses SLO helpers', async () => {
  const [page,probe]=await Promise.all([
    readFile(new URL('../app/(app)/admin/health/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../components/admin/health-latency-probe.tsx',import.meta.url),'utf8'),
  ])
  assert.match(page,/if\(!current\?\.isAdmin\)redirect\('\/'\)/)
  assert.match(page,/upt_admin_system_health/)
  assert.match(page,/aggregateDependencyHealth/)
  assert.match(page,/serviceLevelMet/)
  assert.match(page,/HealthLatencyProbe/)
  assert.match(page,/Systeemgezondheid/)
  assert.match(page,/Push subscriptions/)
  assert.match(page,/Synchronisatie vraagt aandacht/)
  assert.match(page,/push-delivery zelf wordt niet als succesvol verondersteld/i)
  assert.match(probe,/performance\.now\(\)/)
  assert.match(probe,/upt_admin_system_health/)
  assert.match(probe,/1000 ms SLO-grens/)
})

test('admin command center links to the restored health route', async () => {
  const admin=await readFile(new URL('../app/(app)/admin/page.tsx',import.meta.url),'utf8')
  assert.match(admin,/href="\/admin\/health"/)
  assert.match(admin,/Systeemgezondheid/)
})

test('health route realtime refresh watches operational health inputs', async () => {
  const page=await readFile(new URL('../app/(app)/admin/health/page.tsx',import.meta.url),'utf8')
  for(const table of ['work_sessions','break_sessions','check_ins','check_outs','incidents','offline_operation_records','crew_notifications']){
    assert.ok(page.includes("'"+table+"'"),table)
  }
})
