import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const ci=readFileSync('.github/workflows/ci.yml','utf8')
const plan=JSON.parse(readFileSync('supabase/upgrades/production-platform-plan.json','utf8'))
const quarantine='20261109102345'
const historical=ci.indexOf('- name: Verify existing-data production platform upgrade')
const restore=ci.indexOf('- name: Restore latest isolated database after historical upgrade proof')
const lifecycle=ci.indexOf('- name: Full event lifecycle release gate')
const source=ci.slice(restore,lifecycle)

test('historical platform upgrade is validated separately from current security lifecycle',()=>{
 assert.ok(historical>=0&&restore>historical&&lifecycle>restore)
 assert.ok(plan.targetVersion<quarantine,'historical upgrade cannot contain November 9 quarantine')
 assert.match(source,/supabase@2\.117\.0 db reset --local --no-seed/)
 assert.doesNotMatch(source,/db reset[^\n]*(?:--remote|--linked|--db-url)/)
})
test('current isolated database tip and restrictive quarantine must be verified before lifecycle suites',()=>{
 assert.match(source,/expected_latest=/)
 assert.match(source,/actual_latest=/)
 assert.match(source,/supabase_migrations\.schema_migrations/)
 assert.match(source,/actual_latest.*expected_latest/)
 assert.match(source,/upt_all_operational_media_scans_required/)
 assert.match(source,/RESTRICTIVE/)
 assert.match(ci.slice(lifecycle),/tests\/sql\/storage-security\.sql/)
})
test('production deploy is not modified or made dependent on an unvalidated epoch',()=>{
 const deployment=readFileSync('.github/workflows/deploy-cloudflare.yml','utf8')
 assert.match(deployment,/Require successful full CI for exact release commit/)
 assert.match(deployment,/Production Supabase RPC contract/)
})
