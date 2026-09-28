import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { releaseReadiness } from '../lib/release-readiness.ts'
import { EXPECTED_DB_MIGRATION_VERSION } from '../lib/release-baseline.ts'

test('release readiness blocks only failed required checks', () => {
  const result=releaseReadiness([
    {name:'schema',required:true,passed:true},
    {name:'sync',required:true,passed:false},
    {name:'active shift',required:false,passed:false},
  ])
  assert.equal(result.ready,false)
  assert.deepEqual(result.failedRequiredChecks,['sync'])
  assert.deepEqual(result.warnings,['active shift'])
})

test('expected migration baseline matches the newest repository migration', async () => {
  const migrationDir=new URL('../supabase/migrations/',import.meta.url)
  const files=await readdir(migrationDir)
  const versions=files
    .map(name=>name.match(/^(\d+)_.*\.sql$/)?.[1])
    .filter(Boolean)
    .sort()
  assert.equal(EXPECTED_DB_MIGRATION_VERSION,versions.at(-1))
})

test('release snapshot is admin only and exposes aggregate blockers', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927124905_admin_release_readiness_snapshot.sql',import.meta.url),'utf8')
  assert.match(source,/not public\.upt_is_admin\(v_actor\)/)
  assert.match(source,/max\(version\)::text from supabase_migrations\.schema_migrations/)
  assert.match(source,/offline_failed/)
  assert.match(source,/offline_stale/)
  assert.match(source,/pending_checkins/)
  assert.match(source,/pending_checkouts/)
  assert.doesNotMatch(source,/full_name/)
  assert.doesNotMatch(source,/email/)
  assert.doesNotMatch(source,/endpoint/)
  assert.match(source,/revoke all on function public\.upt_admin_release_readiness_snapshot\(\)/)
})

test('admin release page separates hard blockers from operational warnings', async () => {
  const page=await readFile(new URL('../app/(app)/admin/release/page.tsx',import.meta.url),'utf8')
  assert.match(page,/if\(!current\?\.isAdmin\)redirect\('\/'\)/)
  assert.match(page,/upt_admin_release_readiness_snapshot/)
  assert.match(page,/EXPECTED_DB_MIGRATION_VERSION/)
  assert.match(page,/Database schema gelijk aan deze build/)
  assert.match(page,/Geen gefaalde offline synchronisaties/)
  assert.match(page,/Geen vastgelopen offline synchronisaties/)
  assert.match(page,/required:true/)
  assert.match(page,/Geen lopende werksessies/)
  assert.match(page,/required:false/)
  assert.match(page,/GitHub CI blijft daarnaast een afzonderlijke verplichte release-gate/)
})

test('release readiness is not exposed on admin command center', async () => {
  const [admin,health]=await Promise.all([
    readFile(new URL('../app/(app)/admin/page.tsx',import.meta.url),'utf8'),
    readFile(new URL('../app/(app)/admin/health/page.tsx',import.meta.url),'utf8'),
  ])
  assert.doesNotMatch(admin,/href="\/admin\/release"/)
  assert.match(health,/href="\/admin\/release"/)
})
