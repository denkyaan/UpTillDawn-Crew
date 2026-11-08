import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {productionUpgrade} from '../scripts/build-production-upgrade.mjs'

const plan=JSON.parse(readFileSync('supabase/upgrades/production-platform-plan.json','utf8'))
test('upgrade accounts for all post-baseline sources and preserves the reviewed SQL order',()=>{
 const result=productionUpgrade()
 assert.equal(result.plan.migrations.length,97)
 assert.equal(result.plan.excluded.length,10)
 assert.equal(result.sha256.length,64)
 let previous=-1
 for(const migration of plan.migrations){const offset=result.sql.indexOf('-- '+migration.file);assert.ok(offset>previous);previous=offset}
})
test('retired training, recovery fallbacks and QA deletion are not executed',()=>{
 const {sql}=productionUpgrade()
 for(const entry of plan.excluded)assert.ok(!sql.includes('-- '+entry.file))
 assert.ok(!sql.includes('f6fe51db22'))
 assert.ok(!sql.includes('CREATE INDEX IF NOT EXISTS training_progress'))
 assert.ok(!sql.includes('create table if not exists public.training_'))
})
test('unreviewed content and incomplete migration accounting fail closed',()=>{
 for(const change of [p=>{p.migrations[0].sha256='0'.repeat(64)},p=>{p.migrations.pop()},p=>{p.migrations.push(p.migrations[0])},p=>{p.alignment.sha256='0'.repeat(64)},p=>{p.migrations.reverse()},p=>{p.baselineVersion='not-a-version'}]){
  const modified=structuredClone(plan);change(modified)
  assert.throws(()=>productionUpgrade({plan:modified}))
 }
})
test('upgrade detects existing and partial platforms before changing their records',()=>{
 const {sql}=productionUpgrade()
 assert.ok(sql.indexOf('Platform schema already present')<sql.indexOf('-- '+plan.migrations[0].file))
 assert.ok(sql.indexOf('Partial platform installation')<sql.indexOf('-- '+plan.migrations[0].file))
 assert.ok(sql.includes('Production column contract changed'))
 assert.ok(sql.includes('pg_advisory_xact_lock'))
 assert.ok(sql.includes("set_config('lock_timeout','5s',true)"))
})
