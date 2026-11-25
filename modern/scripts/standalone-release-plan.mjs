// Non-deploying topology rehearsal. Never read credentials from production
// or publish a Worker. The existing full acceptance gate still blocks cutover.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs"
import {resolve} from "node:path"
import {fileURLToPath} from "node:url"
import {MAIN_ORIGIN,MAIN_QA_DATABASE,PRODUCTION_ORIGIN,PRODUCTION_DATABASE,nativeRuntimeScope} from "../src/api/runtime-scope.ts"
const modern=resolve(import.meta.dirname,"..")
const config=JSON.parse(readFileSync(resolve(modern,"wrangler.main-qa.jsonc"),"utf8"))
export function assertRehearsalBuildScope(profile,env){
 if(env.VITE_SUPABASE_URL!==profile.vars.SUPABASE_URL||env.VITE_SUPABASE_ANON_KEY!==profile.vars.SUPABASE_ANON_KEY||
    env.VITE_MIGRATION_ALLOW_WRITES!=="false"||env.VITE_MIGRATION_SCANNING_ENABLED!=="false")throw Error("REHEARSAL_BUILD_SCOPE_MISMATCH")
}
export function releaseTopology(candidate=config){
 const permitted=new Set(["$schema","name","main","compatibility_date","compatibility_flags","workers_dev","preview_urls","assets","vars","observability","services","ai"])
 if(Object.keys(candidate).some(key=>!permitted.has(key))||candidate.vars?.SUPABASE_URL!==MAIN_QA_DATABASE||
    !candidate.vars?.SUPABASE_ANON_KEY?.startsWith("sb_publishable_")||candidate.vars.UPT_MIGRATION_ALLOW_WRITES!=="false"||
    candidate.vars.UPT_MIGRATION_SCANNING_ENABLED!=="false"||candidate.vars.UPT_MIGRATION_OAUTH_ENABLED!=="false"||
    candidate.vars.UPT_MIGRATION_NATIVE_AUTH_ENABLED!=="false"||candidate.vars.UPT_MIGRATION_RUNTIME_TARGET!=="main-qa")
  throw Error("UNSAFE_CANDIDATE_PROFILE")
 const {$schema,main:entry,compatibility_date,compatibility_flags,assets,observability,ai}=candidate
 const shared={$schema,main:entry,compatibility_date,compatibility_flags,assets,observability,ai,workers_dev:false,preview_urls:false,
  vars:{SUPABASE_ANON_KEY:candidate.vars.SUPABASE_ANON_KEY,UPT_MIGRATION_NATIVE_AUTH_ENABLED:"true",UPT_MIGRATION_ALLOW_WRITES:"false",
   UPT_MIGRATION_SCANNING_ENABLED:"false",UPT_MIGRATION_OAUTH_ENABLED:"false",UPT_MIGRATION_EMAIL_CALLBACK_READY:"false"}}
 const main={...shared,name:"uptilldawn-main-standalone-rehearsal",vars:{...shared.vars,
  SUPABASE_URL:MAIN_QA_DATABASE,UPT_MIGRATION_RUNTIME_TARGET:"main-standalone"}}
 const production={...shared,name:"uptilldawn-production-standalone-rehearsal",vars:{...shared.vars,
  SUPABASE_URL:PRODUCTION_DATABASE,SUPABASE_ANON_KEY:"sb_publishable_fixture_dry_run_only",
  UPT_MIGRATION_RUNTIME_TARGET:"production-standalone"}}
 for(const [profile,expected] of [[main,MAIN_ORIGIN],[production,PRODUCTION_ORIGIN]]){
  if(profile.services||profile.workers_dev||nativeRuntimeScope(profile.vars)?.requestOrigin!==expected)
   throw Error("UNSAFE_STANDALONE_PROFILE")
 }
 return {main,production,mainExistingName:"uptilldawn-main",productionExistingName:"uptilldawn-crew",
  productionAlias:"crew",mainOrigin:MAIN_ORIGIN,productionOrigin:PRODUCTION_ORIGIN,
  requiredPrivateConfig:["RESEND_API_KEY","SECURITY_ALERT_EMAIL","SECURITY_FROM_EMAIL","GEOAPIFY_API_KEY"],
  releaseBlockers:["complete signed functional parity","verified email callbacks and security notices",
   "positive Maker access","provider and offline acceptance","production DB/schema compatibility",
   "exact Vite build and Worker DB match","validated prior Worker rollback version","explicit release authorization"],
  rollback:{main:{worker:"uptilldawn-main",origin:MAIN_ORIGIN,project:MAIN_QA_DATABASE},production:{worker:"uptilldawn-crew",origin:PRODUCTION_ORIGIN,project:PRODUCTION_DATABASE},versionRequired:true,versionVerified:false,deploy:false},
  deploymentAllowed:false,productionReady:false}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const plan=releaseTopology()
 const out=resolve(modern,"../test-results/modern-standalone-preflight")
 mkdirSync(out,{recursive:true})
 // The production profile is a dry-run specification, NOT a deployable
 // production bundle: its key is deliberately a nonworking fixture.
 const report={...plan,main:{name:plan.main.name,vars:plan.main.vars},
  production:{name:plan.production.name,vars:plan.production.vars}}
 writeFileSync(resolve(out,"topology.json"),JSON.stringify(report,null,2)+"\n")
 if(process.argv.includes("--prepare-main-dry-run")){
  assertRehearsalBuildScope(plan.main,process.env)
  writeFileSync(resolve(modern,".wrangler-standalone-main-preflight.jsonc"),JSON.stringify(plan.main,null,2)+"\n")
 }
 console.log(JSON.stringify({mainRuntimeScope:true,productionTopologyDraft:true,legacyServiceBindings:0,productionReady:false,deploy:false}))
}
