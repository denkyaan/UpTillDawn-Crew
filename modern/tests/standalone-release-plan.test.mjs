import test from "node:test"
import assert from "node:assert/strict"
import {releaseTopology} from "../scripts/standalone-release-plan.mjs"
import {MAIN_QA_DATABASE,PRODUCTION_DATABASE,nativeRuntimeScope} from "../src/api/runtime-scope.ts"
test("both non-public standalone rehearsal profiles are independent and strictly database-separated",()=>{
 const plan=releaseTopology()
 for(const profile of [plan.main,plan.production]){
  assert.equal(profile.services,undefined)
  assert.equal(profile.workers_dev,false)
  assert.equal(profile.vars.UPT_MIGRATION_ALLOW_WRITES,"false")
  assert.equal(profile.vars.UPT_MIGRATION_OAUTH_ENABLED,"false")
  assert.equal(profile.vars.UPT_MIGRATION_SCANNING_ENABLED,"false")
  assert.equal(profile.vars.UPT_MIGRATION_NATIVE_AUTH_ENABLED,"true")
  assert.equal(nativeRuntimeScope(profile.vars).standalone,true)
 }
 assert.equal(plan.main.vars.SUPABASE_URL,MAIN_QA_DATABASE)
 assert.equal(plan.production.vars.SUPABASE_URL,PRODUCTION_DATABASE)
 assert.match(plan.production.vars.SUPABASE_ANON_KEY,/fixture/)
 assert.notEqual(plan.main.name,plan.mainExistingName)
 assert.notEqual(plan.production.name,plan.productionExistingName)
 assert.equal(plan.deploymentAllowed,false)
 assert.equal(plan.productionReady,false)
})
