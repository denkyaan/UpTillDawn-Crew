import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {releaseReadiness} from '../lib/release-readiness.ts'
import {EXPECTED_DB_MIGRATION_VERSION} from '../lib/release-baseline.ts'

test('release readiness foundations still block only failed required checks',()=>{
 const result=releaseReadiness([{name:'schema',required:true,passed:true},{name:'sync',required:true,passed:false},{name:'active shift',required:false,passed:false}])
 assert.equal(result.ready,false);assert.deepEqual(result.failedRequiredChecks,['sync']);assert.deepEqual(result.warnings,['active shift'])
})
test('expected migration baseline matches newest repository migration',async()=>{
 const files=await readdir(new URL('../supabase/migrations/',import.meta.url));const versions=files.map(n=>n.match(/^(\d+)_.*\.sql$/)?.[1]).filter(Boolean).sort()
 assert.equal(EXPECTED_DB_MIGRATION_VERSION,versions.at(-1))
})
test('release snapshot remains admin-only backend infrastructure',async()=>{
 const source=await readFile(new URL('../supabase/migrations/20260927124905_admin_release_readiness_snapshot.sql',import.meta.url),'utf8')
 assert.match(source,/not public\.upt_is_admin\(v_actor\)/);assert.match(source,/offline_failed/);assert.match(source,/offline_stale/);assert.doesNotMatch(source,/full_name|email|endpoint/)
})
test('retired release UI cannot be opened or reached from admin',async()=>{
 const [page,admin]=await Promise.all([readFile(new URL('../app/(app)/admin/release/page.tsx',import.meta.url),'utf8'),readFile(new URL('../app/(app)/admin/page.tsx',import.meta.url),'utf8')])
 assert.match(page,/redirect\('\/admin'\)/);assert.doesNotMatch(page,/Release readiness|upt_admin_release_readiness_snapshot/);assert.doesNotMatch(admin,/href="\/admin\/release"/)
})
