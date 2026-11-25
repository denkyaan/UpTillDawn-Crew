import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {releaseTopology,assertRehearsalBuildScope} from "../scripts/standalone-release-plan.mjs"
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

test("rehearsal profiles reject hidden deployment surfaces and never inherit private or QA-only variables",()=>{
 const candidate=JSON.parse(readFileSync(new URL("../wrangler.main-qa.jsonc",import.meta.url),"utf8"))
 for(const hidden of [{routes:[{pattern:"live.example.invalid"}]},{triggers:{crons:["* * * * *"]}},{kv_namespaces:[]}])
  assert.throws(()=>releaseTopology({...candidate,...hidden}),/UNSAFE_CANDIDATE_PROFILE/)
 for(const flag of ["UPT_MIGRATION_ALLOW_WRITES","UPT_MIGRATION_OAUTH_ENABLED","UPT_MIGRATION_SCANNING_ENABLED","UPT_MIGRATION_NATIVE_AUTH_ENABLED"])
  assert.throws(()=>releaseTopology({...candidate,vars:{...candidate.vars,[flag]:"true"}}),/UNSAFE_CANDIDATE_PROFILE/)
 const plan=releaseTopology({...candidate,vars:{...candidate.vars,RESEND_API_KEY:"synthetic",UPT_PROVIDER_OAUTH_ORIGIN:"https://qa.invalid"}})
 assert.equal(plan.production.vars.RESEND_API_KEY,undefined)
 assert.equal(plan.production.vars.UPT_PROVIDER_OAUTH_ORIGIN,undefined)
 assert.equal(plan.production.vars.UPT_MIGRATION_EMAIL_CALLBACK_READY,"false")
 assert.equal(plan.rollback.versionVerified,false)
 for(const p of [plan.main,plan.production]){
  const env={VITE_SUPABASE_URL:p.vars.SUPABASE_URL,VITE_SUPABASE_ANON_KEY:p.vars.SUPABASE_ANON_KEY,VITE_MIGRATION_ALLOW_WRITES:"false",VITE_MIGRATION_SCANNING_ENABLED:"false"}
  assert.doesNotThrow(()=>assertRehearsalBuildScope(p,env))
  for(const bad of [{VITE_SUPABASE_URL:"https://wrong.invalid"},{VITE_SUPABASE_ANON_KEY:"wrong"},{VITE_MIGRATION_ALLOW_WRITES:"true"},{VITE_MIGRATION_SCANNING_ENABLED:"true"}])
   assert.throws(()=>assertRehearsalBuildScope(p,{...env,...bad}),/REHEARSAL_BUILD_SCOPE_MISMATCH/)
 }
})
