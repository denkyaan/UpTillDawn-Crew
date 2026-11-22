import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

// Offline contract only. SQL is run deliberately against the isolated QA
// project using a privileged SQL executor; CI MUST NEVER execute mutations.
const read=path=>readFileSync(path,"utf8")
const source=read("modern/src/api/native-admin-actions.ts")
const worker=read("modern/src/api/worker.ts")
const config=JSON.parse(read("modern/wrangler.main-qa.jsonc"))
const original=read("lib/migration/original-action-registry.ts")
const denied=read("supabase/tests/main_qa_native_admin_actions_rollback.sql")
const positive=read("supabase/tests/main_qa_native_admin_actions_positive_rollback.sql")
const rpcNames=[...source.matchAll(/\brpc:"(upt_[a-z_]+)"/g)].map(match=>match[1])
const actionIds=[...source.matchAll(/"lib\/actions\/(?:guestlist|sales|platform)\.ts#[A-Za-z]+"/g)].map(x=>x[0].slice(1,-1))
const uniqueValues=xs=>[...new Set(xs)].sort()
const calls=sql=>[...sql.matchAll(/(?:SELECT|PERFORM)\s+public\.(upt_[a-z_]+)\(/g)]
 .map(x=>x[1])

test("all 12 portable admin actions retain original registry and have real SQL authorization tests",()=>{
 assert.equal(rpcNames.length,12)
 assert.equal(actionIds.length,12)
 assert.equal(uniqueValues(actionIds).length,12)
 assert.equal(uniqueValues(rpcNames).length,12)
 for(const id of actionIds)assert.ok(original.includes('"'+id+'"'),"Original action removed: "+id)
 const deniedCalls=uniqueValues(calls(denied)),successCalls=uniqueValues(calls(positive))
 for(const name of rpcNames){
  assert.ok(deniedCalls.includes(name),"Non-admin rollback deny test missing "+name)
  assert.ok(successCalls.includes(name),"Authorized positive rollback test missing "+name)
 }
 assert.ok(source.includes('db.rpc("upt_is_admin",{uid:user.id})'))
 assert.ok(source.includes('db.rpc("upt_is_approved")'))
 assert.ok(source.includes("originalAdminCommand(selected,args[0])"))
})

test("rollback SQL is QA-only, scoped to real QA roles and never commits data",()=>{
 for(const sql of [denied,positive]){
  assert.match(sql,/Main-QA/i)
  assert.match(sql,/e2e-head-admin@uptilldawn\.test/)
  assert.match(sql,/e2e-staff@uptilldawn\.test/)
  assert.match(sql,/SET LOCAL ROLE authenticated;/)
  assert.match(sql,/request\.jwt\.claim\.sub/)
  assert.match(sql,/upt_is_admin\(auth\.uid\(\)\)/)
  assert.match(sql,/upt_is_approved\(\)/)
  assert.match(sql,/^BEGIN;$/m)
  assert.match(sql,/^ROLLBACK;$/m)
  assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1)
  assert.equal((sql.match(/^ROLLBACK;$/gm)||[]).length,1)
  assert.ok(!/^\s*(?:COMMIT|END TRANSACTION|CREATE ROLE|ALTER ROLE|DROP|TRUNCATE)\b/im.test(sql))
  assert.ok(!/\b(?:service_role|SUPABASE_SECRET_KEY|UPT_INTEGRATION_ENCRYPTION_KEY)\b/.test(sql))
 }
 assert.match(denied,/twelve|12/i)
 assert.match(denied,/Unauthorized staff action unexpectedly succeeded/)
 assert.match(denied,/Only seven Main QA bots|seven fixed QA accounts/i)
 assert.match(positive,/QA-ROLLBACK-ONLY/)
 assert.match(positive,/gen_random_uuid\(\)/)
 assert.match(positive,/Only seven Main QA bots may be used/)
 assert.match(positive,/Refund did not create auditable reversal/)
 assert.match(positive,/Guest removal failed/)
})

test("real QA writes remain disabled after the SQL-only rollback acceptance",()=>{
 assert.equal(config.name,"uptilldawn-modern-main")
 assert.equal(config.vars.UPT_MIGRATION_ALLOW_WRITES,"false")
 assert.ok(worker.includes('c.env.UPT_MIGRATION_ALLOW_WRITES!=="true"'))
 assert.ok(worker.includes('nativeAdminActionAllowed(hint)'))
 assert.ok(worker.includes('sourceReadSession(c.req.raw,c.env)'))
 assert.ok(!worker.includes('UPT_MIGRATION_ALLOW_WRITES="true"'))
 const workflow=read(".github/workflows/deploy-main.yml")
 assert.ok(workflow.includes("VITE_MIGRATION_ALLOW_WRITES: 'false'"))
 assert.ok(!workflow.includes("VITE_MIGRATION_ALLOW_WRITES: 'true'"))
})
