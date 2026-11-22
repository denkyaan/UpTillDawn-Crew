// Explicit, focused LIVE Main-QA login + signed action HTTP acceptance.
// No credentials/session screenshots/logging. Production and normal Main
// deployments must never invoke this script automatically.
// Real public Worker writes stay OFF. In-process native handler uses ONLY
// fresh missing v4 IDs, so there is no valid target to mutate.
import assert from "node:assert/strict"
import {randomUUID} from "node:crypto"
import {chromium} from "playwright"
import app from "../src/api/worker.ts"
import {sourceReadSession,hasOriginalAuthCookie} from "../src/api/native-main-reads.ts"
import {nativeAdminActionIds} from "../src/api/native-admin-actions.ts"
import {encode} from "../../lib/migration/wire.ts"

const candidate="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const source="https://uptilldawn-main.uptilldawn.workers.dev"
const database="https://npbjrtiolqperdgljnhi.supabase.co"
const key="sb_publishable_zStTw3n8wZ271PehDRDvGg_rs0JOy84"
const password=process.env.E2E_MAIN_QA_PASSWORD||""
if(process.env.E2E_MAIN_QA_BASE_URL!==database+"/"||
 process.env.E2E_MAIN_MODERN_QA_ORIGIN!==candidate||
 process.env.VITE_MIGRATION_ALLOW_WRITES!=="false"||
 password.length<24)throw Error("MAIN_QA_ONLY_SIGNED_ACCEPTANCE_CONFIGURATION_REQUIRED")

const bots=[
 {id:"head_admin",portal:"admin",email:"e2e-head-admin@uptilldawn.test",admin:true},
 {id:"staff",portal:"staff",email:"e2e-staff@uptilldawn.test",admin:false}
]
const cases=[
 ["guestlist.ts#addGuestlistEntry",id=>({event_id:id,name:"QA missing event",entry_type:"guest",spots:"1"})],
 ["guestlist.ts#updateGuestlistEntry",id=>({entry_id:id,name:"QA missing entry",entry_type:"guest",spots:"1"})],
 ["guestlist.ts#removeGuestlistEntry",id=>({entry_id:id})],
 ["guestlist.ts#setBackstageWorkplace",id=>({event_id:id,workplace_id:id})],
 ["guestlist.ts#setArtistHospitality",id=>({entry_id:id,drinks:"Water"})],
 ["sales.ts#configureSaleItem",id=>({item_id:id,enabled:"on",sale_category:"merch",price:"1.00"})],
 ["sales.ts#setOpeningCash",id=>({event_id:id,workplace_id:id,opening_cash:"0.00"})],
 ["sales.ts#refundSale",id=>({sale_id:id,quantity:"1"})],
 ["platform.ts#generatePlanningRecommendations",id=>({event_id:id})],
 ["platform.ts#applyPlanningRecommendation",id=>({recommendation_id:id})],
 ["platform.ts#dismissPlanningRecommendation",id=>({recommendation_id:id})],
 ["platform.ts#generateEventReport",id=>({event_id:id})]
]
function actionBody(id,fields){
 const inner=new FormData()
 for(const [name,value] of Object.entries(fields))inner.set(name,value)
 const outer=new FormData()
 outer.set("_id",id)
 outer.set("_args",JSON.stringify(encode([inner],outer)))
 return outer
}
function redact(requestStatus,error){
 if(error)throw Error("QA_SIGNED_HTTP "+requestStatus+" "+(error instanceof Error?error.name:"unknown"))
}
let browser
let browserSignins=0,verifiedLiveWriteDenials=0,localSignedNativeDenials=0
let legacyParityChecks=0,forwards=0,menuChecks=0,concurrentDenials=0
try{
 browser=await chromium.launch({headless:true})
 const fakeId=randomUUID()
 assert.equal(cases.length,12)
 assert.deepEqual([...nativeAdminActionIds].sort(),
  cases.map(([name])=>"lib/actions/"+name).sort())
 for(const bot of bots){
  const context=await browser.newContext({locale:"nl-BE",viewport:{width:1280,height:800}})
  try{
   const page=await context.newPage()
   await page.goto(candidate+"/login/"+bot.portal,{waitUntil:"domcontentloaded",timeout:30000})
   await page.locator('input[name="email"]').fill(bot.email)
   await page.locator('input[name="password"]').fill(password)
   await page.locator('form button[type="submit"]').click()
   await page.locator('[data-app-shell-ready="true"]').waitFor({timeout:30000})
   await page.locator('main').waitFor({timeout:10000})
   assert.equal(await page.locator('[data-app-error="true"]').count(),0)
   browserSignins++
   const menus=page.locator('button[aria-expanded]:visible')
   if(await menus.count()>0){
    const toggle=menus.first()
    const initial=await toggle.getAttribute("aria-expanded")
    await toggle.click()
    assert.notEqual(await toggle.getAttribute("aria-expanded"),initial)
    await toggle.click()
    assert.equal(await toggle.getAttribute("aria-expanded"),initial)
    menuChecks++
   }
   // The original cookie name and full signed value are intentionally never
   // printed or persisted, nor sent to any domain outside these QA hosts.
   const all=await context.cookies(candidate)
   const cookie=all.map(x=>x.name+"="+x.value).join("; ")
   assert.ok(hasOriginalAuthCookie(cookie),"QA_SIGNED_COOKIE_NOT_SET")
   const env={
    SUPABASE_URL:database,SUPABASE_ANON_KEY:key,
    // This is a fresh Hono in-memory invocation only. The deployed Worker's
    // real flag stays false, independently checked on every request below.
    UPT_MIGRATION_ALLOW_WRITES:"true",
    MAIN_AUTH:{fetch:async()=>{forwards++;throw Error("QA_LEGACY_FORWARD_DENIED")}}
   }
   const read=await sourceReadSession(new Request(candidate+"/api/push/config",{
    headers:{Cookie:cookie}
   }),env)
   assert.equal(read.ok,true,"QA_SESSION_NOT_VERIFIED")
   const {data:{user},error}=await read.db.auth.getUser()
   assert.equal(error,null)
   assert.ok(user?.id)
   const {data:approved,error:approvalError}=await read.db.rpc("upt_is_approved")
   assert.equal(approvalError,null)
   assert.equal(approved,true)
   const {data:admin,error:adminError}=await read.db.rpc("upt_is_admin",{uid:user.id})
   assert.equal(adminError,null)
   assert.equal(admin,bot.admin,"QA_ROLE_DRIFT")

   // Verify the actually deployed Cloudflare Hono endpoint is read-only with
   // real signed browser sessions, for all 12 mutations and both roles.
   for(const [name,fields] of cases){
    const id="lib/actions/"+name
    const multipart=actionBody(id,fields(fakeId))
    const body=Object.fromEntries([...multipart])
    const response=await context.request.post(candidate+"/api/migration/actions",{
     multipart:body,headers:{Origin:candidate,"X-UpTillDawn-Action-Hint":id},
     timeout:18000,maxRedirects:0
    })
    assert.equal(response.status(),503,"LIVE_QA_WRITES_ENABLED_"+name)
    assert.deepEqual(await response.json(),{error:"migration_writes_disabled"})
    verifiedLiveWriteDenials++
   }

   // This is an isolated HTTP Request->Hono->signed Supabase RPC integration
   // against fresh nonexistent IDs. No live Worker configuration is changed.
   for(const [name,fields] of cases){
    const id="lib/actions/"+name
    const req=new Request(candidate+"/api/migration/actions",{
     method:"POST",headers:{Origin:candidate,"Sec-Fetch-Site":"same-origin",
      Cookie:cookie,"X-UpTillDawn-Action-Hint":id},
     body:actionBody(id,fields(fakeId))
    })
    const response=await app.request(req,{},env)
    assert.equal(response.status,422,"NATIVE_SIGNED_HTTP_"+bot.id+"_"+name)
    assert.deepEqual(await response.json(),{
     error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",code:"action_failed"
    })
    assert.equal(response.headers.get("cache-control"),"private, no-store")
    localSignedNativeDenials++
   }
   if(bot.admin){
    // The original Next action endpoint is still the source of truth. Cap
    // legacy comparisons at one operation in each of the three domains
    // rather than hammering Workers Free with 24 SSR/DB requests.
    for(const index of [0,5,9]){
     const [name,fields]=cases[index]
     const id="lib/actions/"+name
     const result=await context.request.post(source+"/api/migration/actions",{
      multipart:Object.fromEntries(actionBody(id,fields(fakeId))),
      headers:{Origin:source,Cookie:cookie},timeout:25000,maxRedirects:0
     })
     assert.equal(result.status(),422,"LEGACY_SOURCE_ERROR_PARITY_"+name)
     assert.deepEqual(await result.json(),{
      error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",code:"action_failed"
     })
     legacyParityChecks++
     // Do not hammer the original Next Worker on Cloudflare Free.
     await new Promise(resolve=>setTimeout(resolve,600))
    }
   }
   // Requests with a signed session but spoofed origin or mismatched _id
   // must be rejected before a business RPC can run.
   const [first]=cases
   const id="lib/actions/"+first[0]
   const wrongOrigin=await app.request(new Request(candidate+"/api/migration/actions",{
    method:"POST",headers:{Origin:"https://attacker.invalid",
     Cookie:cookie,"X-UpTillDawn-Action-Hint":id},
    body:actionBody(id,first[1](fakeId))
   }),{},env)
   assert.equal(wrongOrigin.status,403)
   const wrongId=await app.request(new Request(candidate+"/api/migration/actions",{
    method:"POST",headers:{Origin:candidate,Cookie:cookie,
     "Sec-Fetch-Site":"same-origin","X-UpTillDawn-Action-Hint":id},
    body:actionBody(nativeAdminActionIds[1],first[1](fakeId))
   }),{},env)
   assert.equal(wrongId.status,404)
   const foreignCookie=await app.request(new Request(candidate+"/api/migration/actions",{
    method:"POST",headers:{Origin:candidate,
     "X-UpTillDawn-Action-Hint":id,Cookie:"sb-npbjrtiolqperdgljnhi-auth-token=fake"},
    body:actionBody(id,first[1](fakeId))
   }),{},env)
   assert.equal(foreignCookie.status,401)
   // Three concurrent *denied* browser requests check that no denied attempt
   // becomes a successful transaction under simultaneous clicks.
   const denied=await Promise.all(Array.from({length:3},()=>context.request.post(
    candidate+"/api/migration/actions",{
     multipart:Object.fromEntries(actionBody(id,first[1](fakeId))),
     headers:{Origin:candidate,"X-UpTillDawn-Action-Hint":id},
     timeout:18000
    })))
   for(const response of denied){
    assert.equal(response.status(),503)
    concurrentDenials++
   }
   assert.equal(forwards,0,"Unexpected original Main forwarding")
   console.log("PASS signed native action QA: "+bot.id+" / 12 native denied missing-resource requests / 12 public disabled writes")
  }finally{await context.close()}
 }
 assert.equal(browserSignins,2)
 assert.equal(localSignedNativeDenials,24)
 assert.equal(verifiedLiveWriteDenials,24)
 assert.equal(legacyParityChecks,3)
 assert.equal(concurrentDenials,6)
 assert.equal(forwards,0)
 console.log(JSON.stringify({
  qaOnly:true,sourceMainUnmodified:true,productionUnmodified:true,
  publicWritesEnabled:false,signedBrowserLogins:browserSignins,
  liveWorkerDisabledWriteChecks:verifiedLiveWriteDenials,
  inProcessSignedHonoMissingTargetChecks:localSignedNativeDenials,
  originalMainFailClosedParitySamples:legacyParityChecks,
  concurrentDisabledRequestChecks:concurrentDenials,menuOpenCloseChecks:menuChecks,
  positiveDatabaseWriteCoverage:"12 rollback-only SQL actions validated separately",
  authenticatedHttpSuccessOnPublishedWorker:false,
  fullVisualOrProductionParityVerified:false
 }))
}finally{if(browser)await browser.close()}
