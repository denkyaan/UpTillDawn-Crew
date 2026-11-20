import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('historical production guards remain represented by repository migrations', async () => {
  const [geo,attendance,tasks]=await Promise.all([
    readFile(new URL('../supabase/migrations/20260926180000_geoapify_distributed_rate_limit.sql',import.meta.url),'utf8'),
    readFile(new URL('../supabase/migrations/20260926211500_attendance_request_concurrency_guard.sql',import.meta.url),'utf8'),
    readFile(new URL('../supabase/migrations/20260926233000_task_status_revocation_guard.sql',import.meta.url),'utf8'),
  ])

  assert.match(geo,/upt_private\.geoapify_rate_limits/)
  assert.match(geo,/request_count >= 60/)
  assert.match(geo,/revoke all on function public\.upt_geoapify_rate_limit\(\) from public, anon/)

  assert.match(attendance,/pg_advisory_xact_lock/)
  assert.match(attendance,/check_ins_pending_concurrency_guard/)
  assert.match(attendance,/check_outs_pending_concurrency_guard/)

  assert.match(tasks,/User is not a member of this event/)
  assert.match(tasks,/No valid shift for task workplace/)
  assert.match(tasks,/upt_feature_allowed\('tasks'/)
})

test('private Geoapify quota state has an explicit deny-all RLS policy', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927105319_geoapify_rate_limit_rls_policy.sql',import.meta.url),'utf8')
  assert.match(source,/geoapify_rate_limits_no_direct_access/)
  assert.match(source,/as restrictive/)
  assert.match(source,/for all/)
  assert.match(source,/using \(false\)/)
  assert.match(source,/with check \(false\)/)
})
