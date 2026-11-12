import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const workflow=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8')
test('full Maker/role acceptance retries only transient deadlocks in disposable Supabase',()=>{
 const section=workflow.split('- name: Replay every migration from zero')[1]?.split('- name: Run SQL regression suites')[0]||''
 assert.ok(section,'full isolated migration step must exist')
 assert.match(section,/supabase@2\.117\.0 db reset --local --no-seed/)
 assert.match(section,/for attempt in 1 2 3/)
 assert.match(section,/deadlock detected\|SQLSTATE 40P01/)
 assert.match(section,/non-deadlock reason/)
 assert.match(section,/exit 1/)
 assert.doesNotMatch(section,/continue-on-error: true/)
})
test('production dependency security audit remains a blocking gate',()=>{
 const section=workflow.split('- name: Production dependency audit')[1]?.split('- name: Parallel lint')[0]||''
 assert.match(section,/npm audit --omit=dev --audit-level=high/)
 assert.match(section,/Development dependency audit/)
 assert.match(section,/continue-on-error: true/)
 assert.doesNotMatch(section,/Production dependency audit\n\s*continue-on-error:/)
})
