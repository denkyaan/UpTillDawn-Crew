// Explicit opt-in Main-QA acceptance for the second wave of 11 original actions.
// Public Worker writes remain OFF. In-process requests use only fresh missing
// UUIDs; no positive mutation is ever sent to the real cloud application.
// In particular NEVER execute targetless setFeatureRollout or snapshot as
// an approved head-admin through the in-process write-enabled handler.
import assert from "node:assert/strict"
import {randomUUID} from "node:crypto"
import {chromium} from "playwright"
import app from "../src/api/worker.ts"
import {sourceReadSession,hasOriginalAuthCookie} from "../src/api/native-main-reads.ts"
import {nativeWaveTwoActionIds,nativePlatformAdminActionIds,nativeMemberActionIds}
 from "../src/api/native-platform-actions.ts"
import {encode} from "../../lib/migration/wire.ts"

const candidate="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const database="https://npbjrtiolqperdgljnhi.supabase.co"
const key="sb_publishable_zStTw3n8wZ271PehDRDvGg_rs0JOy84"
const password=process.env.E2E_MAIN_QA_PASSWORD||""
if(process.env.E2E_MAIN_QA_BASE_URL!==database+"/"||
 process.env.E2E_MAIN_MODERN_QA_ORIGIN!==candidate||
 process.env.VITE_MIGRATION_ALLOW_WRITES!=="false"||password.length<24)
 throw Error("MAIN_QA_ONLY_WAVE_TWO_SIGNED_ACCEPTANCE_REQUIRED")

const bots=[
 {id:"head_admin",portal:"admin",email:"e2e-head-admin@uptilldawn.test",admin:true},
 {id:"staff",portal:"staff",email:"e2e-staff@uptilldawn.test",admin:false}
]
const cases=[
 ["platform.ts#setFeatureRollout",_=>({feature_key:"qa_wave_two_readonly",enabled:"on",audience:"staff",rollout_percentage:"2"}),true],
 ["platform.ts#snapshotPlatformConfiguration",_=>({note:"qa-wave-two-readonly"}),true],
 ["platform.ts#captureEventTemplate",id=>({event_id:id,name:"QA nonexistent event",section:["workplaces"]})],
 ["platform.ts#applyEventTemplate",id=>({template_id:id,name:"QA nonexistent template",start_at:"2026-11-25T16:00:00+01:00",end_at:"2026-11-25T19:00:00+01:00"})],
 ["platform.ts#restorePlatformConfiguration",id=>({version_id:id})],
 ["platform.ts#saveAutomationRule",_=>({automation_key:"qa_missing_rule",enabled:"on",delay_minutes:"1",channel:["in_app"]})],
 ["workplace-catalog.ts#syncCatalogToEvent",id=>({event_id:id})],
 ["onboarding.ts#completeEventOnboardingStep",id=>({event_id:id,step:"briefing"})],
 ["uptilldawn.ts#markNotificationRead",id=>({notification_id:id})],
 ["uptilldawn.ts#acknowledgeBriefing",id=>({id})],
 ["uptilldawn.ts#acknowledgeInstruction",id=>({id})]
]
function formBody(id,fields){
 const fd=new FormData()
 for(const [name,value] of Object.entries(fields)){
  if(Array.isArray(value))for(const v of value)fd.append(name,v)
  else fd.set(name,value)
 }
 const outer=new FormData()
 outer.set("_id",id)
 outer.set("_args",JSON.stringify(encode([fd],outer)))
 return outer
}
function nativeRequest(cookie,id,fields,{origin=candidate,actualId=id}={}){
 const body=formBody(id,fields)
 body.set("_id",actualId)
 return new Request(candidate+"/api/migration/actions",{
  method:"POST",
  headers:{Origin:origin,"Sec-Fetch-Site":"same-origin",
   Cookie:cookie,"X-UpTillDawn-Action-Hint":id},
  body
 })
}
const names=cases.map(x=>"lib/actions/"+x[0])
assert.equal(cases.length,11)
assert.deepEqual([...nativeWaveTwoActionIds].sort(),[...names].sort())
assert.equal(nativePlatformAdminActionIds.length,7)
assert.equal(nativeMemberActionIds.length,4)
let browser,logins=0,liveWriteDenials=0,signedInProcessDenials=0
let intentionallySkippedMutations=0,spoofDenials=0,sourceForwarding=0
try{
 browser=await chromium.launch({headless:true})
 const missing=randomUUID()
 for(const bot of bots){
  const context=await browser.newContext({locale:"nl-BE",viewport:{width:1280,height:800}})
  try{
   const page=await context.newPage()
   await page.goto(candidate+"/login/"+bot.portal,{waitUntil:"domcontentloaded",timeout:30000})
   await page.locator('input[name="email"]').fill(bot.email)
   await page.locator('input[name="password"]').fill(password)
   await page.locator('form button[type="submit"]').click()
   await page.locator('[data-app-shell-ready="true"]').waitFor({timeout:30000})
   assert.equal(await page.locator('[data-app-error="true"]').count(),0)
   logins++
   const cookie=(await context.cookies(candidate)).map(c=>c.name+"="+c.value).join("; ")
   assert.ok(hasOriginalAuthCookie(cookie),"SIGNED_QA_COOKIE_MISSING")
   const env={SUPABASE_URL:database,SUPABASE_ANON_KEY:key,
    UPT_MIGRATION_ALLOW_WRITES:"true",
    MAIN_AUTH:{fetch:async()=>{sourceForwarding++;throw Error("MAIN_FORWARD_FORBIDDEN")}}}
   const verified=await sourceReadSession(new Request(candidate+"/api/push/config",{
    headers:{Cookie:cookie}
   }),env)
   assert.equal(verified.ok,true,"MAIN_QA_SIGNED_SESSION_NOT_VERIFIED")
   const {data:{user},error:userError}=await verified.db.auth.getUser()
   assert.equal(userError,null)
   assert.ok(user?.id)
   const {data:approved,error:approvalError}=await verified.db.rpc("upt_is_approved")
   assert.equal(approvalError,null)
   assert.equal(approved,true)
   const {data:admin,error:adminError}=await verified.db.rpc("upt_is_admin",{uid:user.id})
   assert.equal(adminError,null)
   assert.equal(admin,bot.admin,"MAIN_QA_ROLE_DRIFT")

   // Validate actual deployed public Worker with both signed roles and all
   // 11 original action IDs. The public flag must reject BEFORE DB writes.
   for(const [shortName,fields] of cases){
    const id="lib/actions/"+shortName
    const response=await context.request.post(candidate+"/api/migration/actions",{
     multipart:Object.fromEntries(formBody(id,fields(missing))),
     headers:{Origin:candidate,"X-UpTillDawn-Action-Hint":id},
     timeout:18000,maxRedirects:0
    })
    assert.equal(response.status(),503,"PUBLIC_WRITE_GATE_OPEN_"+shortName)
    assert.deepEqual(await response.json(),{error:"migration_writes_disabled"})
    liveWriteDenials++
   }
   // Local Hono + real signed Supabase RLS. A nonexistent UUID causes a
   // post-authorization target rejection, not a successful transaction.
   for(const [shortName,fields,targetlessMutation] of cases){
    const id="lib/actions/"+shortName
    // These two RPCs CREATE data with no resource ID. Unit + rollback-only
    // SQL covered them; never issue a positive in-process admin request.
    if(bot.admin&&targetlessMutation){
     intentionallySkippedMutations++
     continue
    }
    const response=await app.request(nativeRequest(cookie,id,fields(missing)),{},env)
    assert.equal(response.status,422,"SIGNED_RLS_EXPECTED_DENIAL_"+bot.id+"_"+shortName)
    assert.deepEqual(await response.json(),{
     error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",
     code:"action_failed"
    })
    assert.equal(response.headers.get("cache-control"),"private, no-store")
    signedInProcessDenials++
   }
   // The browser's action hint never confers authority. Even with a
   // legitimate signed admin cookie, reject cross-origin and mismatched IDs.
   const [first,fields]=cases[2],id="lib/actions/"+first
   const rejectedOrigin=await app.request(nativeRequest(cookie,id,fields(missing),{
    origin:"https://attacker.invalid"
   }),{},env)
   assert.equal(rejectedOrigin.status,403)
   const rejectedId=await app.request(nativeRequest(cookie,id,fields(missing),{
    actualId:"lib/actions/platform.ts#restorePlatformConfiguration"
   }),{},env)
   assert.equal(rejectedId.status,404)
   spoofDenials+=2
   assert.equal(sourceForwarding,0)
   console.log("PASS signed wave-two Main-QA: "+bot.id+
    " / 11 deployed writes disabled / role-appropriate safe RPC failures")
  }finally{await context.close()}
 }
 assert.equal(logins,2)
 assert.equal(liveWriteDenials,22)
 assert.equal(signedInProcessDenials,20)
 assert.equal(intentionallySkippedMutations,2)
 assert.equal(spoofDenials,4)
 assert.equal(sourceForwarding,0)
 console.log(JSON.stringify({
  qaOnly:true,originalMainUnchanged:true,productionUnchanged:true,
  publicWritesEnabled:false,signedBrowserLogins:logins,
  publicWorkerBlockedWrites:liveWriteDenials,
  signedInProcessRlsFailClosedChecks:signedInProcessDenials,
  dangerousPositiveMutationsIntentionallySkipped:intentionallySkippedMutations,
  spoofedOriginAndActionIdDenied:spoofDenials,
  unintendedOriginalMainForwards:sourceForwarding,
  databaseRollbackPositiveCoverage:"2 head-admin actions independently tested and rolled back",
  fullProductionOrVisualParityVerified:false
 }))
}finally{if(browser)await browser.close()}
