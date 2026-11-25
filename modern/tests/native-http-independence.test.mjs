import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import app from "../src/api/worker.ts"
import {nativeMainAuthResponse} from "../src/api/main-auth.ts"
import {resolveMainGeoapifyKey} from "../src/api/native-main-private-config.ts"
import {nativeGeoapifyAutocompleteResponse} from "../src/api/native-standalone-routes.ts"
import {mainGeoapifyRuntimeConfiguration,MAIN_QA_PROJECT} from "../../lib/migration/main-auth-runtime-config.ts"
import {actionEntries} from "../tooling/main-source.mjs"
import {report} from "../scripts/legacy-route-audit.mjs"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa=MAIN_QA_PROJECT
const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_fixture"}
const signed={rpc:async name=>({data:name==="upt_is_approved"?true:{allowed:true},error:null})}
const req=q=>new Request(origin+"/api/geocode/autocomplete?q="+encodeURIComponent(q))
function action(id){
 const body=new FormData();body.set("_id","synthetic-not-a-registered-action");body.set("_args","[]")
 return new Request(origin+"/api/migration/actions",{method:"POST",headers:{Origin:origin,"X-UpTillDawn-Action-Hint":id},body})
}
test("native deployed auth never accepts the historical MAIN_AUTH HTTP fetch binding",async()=>{
 let calls=0
 const old={...env,MAIN_AUTH:{async fetch(){calls++;throw Error("legacy forwarding forbidden")}}}
 const form=new FormData();form.set("portal","staff");form.set("email","");form.set("password","")
 const make=()=>new Request(origin+"/api/auth/portal-login",{method:"POST",headers:{Origin:origin},body:form})
 assert.equal((await nativeMainAuthResponse(make(),old)).status,503)
 assert.equal((await app.request(make(),{},old)).status,503)
 const runtime={...old,MAIN_AUTH_RUNTIME:{runtimeConfiguration:async()=>({protocol:"main-auth-native-v1",projectUrl:qa,values:{}})}}
 assert.equal((await app.request(make(),{},runtime)).status,200)
 assert.equal(calls,0)
 assert.equal((await app.request(req("Leuven"),{},old)).status,401)
 assert.equal(calls,0)
})
test("provider credential RPC is scoped, exact QA only, never falls back to HTTP or exposes mail values",async()=>{
 const result=mainGeoapifyRuntimeConfiguration({NEXT_PUBLIC_SUPABASE_URL:qa,GEOAPIFY_API_KEY:" fixture ",RESEND_API_KEY:"private",SUPABASE_SERVICE_ROLE_KEY:"never"})
 assert.deepEqual(result,{protocol:"main-geoapify-native-v1",projectUrl:qa,key:"fixture"})
 assert.deepEqual(mainGeoapifyRuntimeConfiguration({GEOAPIFY_API_KEY:"fixture"}),result)
 assert.throws(()=>mainGeoapifyRuntimeConfiguration({NEXT_PUBLIC_SUPABASE_URL:"https://production.invalid"}))
 let calls=0
 const binding={runtimeConfiguration:async()=>{throw Error("mail config must not be read")},
  geoapifyConfiguration:async()=>{calls++;return result}}
 const runtime={...env,MAIN_AUTH_RUNTIME:binding}
 assert.equal(await resolveMainGeoapifyKey(runtime),"fixture")
 assert.equal(await resolveMainGeoapifyKey({...runtime,GEOAPIFY_API_KEY:"local"}),"local")
 assert.equal(await resolveMainGeoapifyKey({...runtime,UPT_MIGRATION_NATIVE_AUTH_ENABLED:"true"}),"")
 await assert.rejects(resolveMainGeoapifyKey({...runtime,SUPABASE_URL:"https://production.invalid"}))
 assert.equal(calls,1)
 await assert.rejects(resolveMainGeoapifyKey({...runtime,MAIN_AUTH_RUNTIME:{...binding,geoapifyConfiguration:async()=>({...result,projectUrl:"https://production.invalid"})}}))
})
test("approval, throttle and query length are checked before accessing the private Geoapify key",async()=>{
 let calls=0
 const key=async()=>{calls++;throw Error("configuration unavailable")}
 const blocked={rpc:async()=>({data:false,error:null})}
 const limited={rpc:async name=>({data:name==="upt_is_approved"?true:{allowed:false,retry_after:5},error:null})}
 assert.equal((await nativeGeoapifyAutocompleteResponse(blocked,req("Leuven"),key)).status,403)
 assert.equal((await nativeGeoapifyAutocompleteResponse(limited,req("Leuven"),key)).status,429)
 assert.equal((await nativeGeoapifyAutocompleteResponse(signed,req("L"),key)).status,200)
 assert.equal((await nativeGeoapifyAutocompleteResponse(signed,req("x".repeat(201)),key)).status,400)
 assert.equal(calls,0)
 assert.equal((await nativeGeoapifyAutocompleteResponse(signed,req("Leuven"),key)).status,503)
 assert.equal(calls,1)
})
test("all 163 original action IDs reach a real guarded native dispatcher with no public or anonymous write",async()=>{
 const ids=actionEntries().map(a=>a.id)
 assert.equal(ids.length,163);assert.equal(new Set(ids).size,163)
 const poison={...env,MAIN_AUTH:{fetch:async()=>{throw Error("legacy HTTP reached")}}}
 for(const id of ids){
  const denied=await app.request(action(id),{},{...poison,UPT_MIGRATION_ALLOW_WRITES:"false"})
  assert.equal(denied.status,503,id)
  assert.deepEqual(await denied.json(),{error:"migration_writes_disabled"})
  const local=await app.request(action(id),{},{...poison,UPT_MIGRATION_ALLOW_WRITES:"true"})
  assert.equal(local.status,id==="lib/actions/god-mode.ts#godModeLogout"?403:401,id)
 }
})
test("every source route is implemented in Hono or intentionally denied; config-only dependency is explicit",()=>{
 assert.equal(report.originalMethodPairs,84)
 assert.equal(report.nativeHttpMethodPairs,83)
 assert.equal(report.legacyHttpMethodPairs,0)
 assert.equal(report.deniedBySecurity,1)
 assert.equal(report.configurationDependentMethodPairs,5)
 assert.equal(report.fullCutoverAllowed,false)
 const config=JSON.parse(readFileSync(new URL("../wrangler.main-qa.jsonc",import.meta.url),"utf8"))
 assert.ok(!config.services.some(s=>s.binding==="MAIN_AUTH"))
 const worker=readFileSync(new URL("../src/api/worker.ts",import.meta.url),"utf8")
 assert.doesNotMatch(worker,/forwardMain(?:Source|Auth)\(/)
})
