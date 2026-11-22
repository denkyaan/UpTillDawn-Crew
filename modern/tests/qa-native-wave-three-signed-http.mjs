// Explicit, one-commit Main-QA signed acceptance for original event/shift
// wave three. No live business mutations or source forwarding, ever.
// Real public Worker flag must stay OFF; synthetic UUID targets only.
import assert from "node:assert/strict"
import {randomUUID} from "node:crypto"
import {chromium} from "playwright"
import app from "../src/api/worker.ts"
import {sourceReadSession,hasOriginalAuthCookie} from "../src/api/native-main-reads.ts"
import {encode} from "../../lib/migration/wire.ts"
import {
 nativeWaveThreeActionIds,nativeEventAdminActionIds,nativeShiftMemberActionIds
} from "../src/api/native-event-shift-actions.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const key="sb_publishable_zStTw3n8wZ271PehDRDvGg_rs0JOy84"
const password=process.env.E2E_MAIN_QA_PASSWORD||""
if(process.env.E2E_MAIN_QA_BASE_URL!==qa+"/"||
 process.env.E2E_MAIN_MODERN_QA_ORIGIN!==origin||
 process.env.VITE_MIGRATION_ALLOW_WRITES!=="false"||password.length<24)
 throw Error("WAVE_THREE_MAIN_QA_ONLY_SIGNED_ACCEPTANCE_REQUIRED")

const bots=[
 {id:"head-admin",portal:"admin",email:"e2e-head-admin@uptilldawn.test",admin:true},
 {id:"staff",portal:"staff",email:"e2e-staff@uptilldawn.test",admin:false}
]
const cases=[
 ["events.ts#closeEvent",id=>({event_id:id,force:"",reason:"QA event close"})],
 ["events.ts#archiveEvent",id=>({event_id:id})],
 ["events.ts#restoreEvent",id=>({event_id:id})],
 ["uptilldawn.ts#decideShiftChange",id=>({request_id:id,decision:"approved"})],
 ["uptilldawn.ts#cancelShift",id=>({shift_id:id})],
 ["uptilldawn.ts#reassignShift",id=>({shift_id:id,user_id:randomUUID(),reason:"QA reassignment"})],
 ["uptilldawn.ts#confirmShift",id=>({shift_id:id})],
 ["uptilldawn.ts#requestShiftReplacement",id=>({shift_id:id,replacement_user_id:randomUUID(),reason:"QA replacement"})],
 ["uptilldawn.ts#requestShiftSwap",id=>({shift_id:id,replacement_user_id:randomUUID(),target_shift_id:randomUUID(),reason:"QA swap"})],
 ["uptilldawn.ts#claimOpenShift",id=>({shift_id:id,reason:"QA open shift"})],
 ["uptilldawn.ts#respondShiftChange",id=>({request_id:id,response:"accepted"})],
 ["uptilldawn.ts#cancelShiftChange",id=>({request_id:id})]
]
function actionForm(id,fields){
 const body=new FormData()
 for(const [name,value]of Object.entries(fields))body.set(name,value)
 const encoded=new FormData()
 encoded.set("_id",id)
 encoded.set("_args",JSON.stringify(encode([body],encoded)))
 return encoded
}
function localRequest(cookie,id,fields,options={}){
 const body=actionForm(id,fields)
 body.set("_id",options.actualId??id)
 return new Request(origin+"/api/migration/actions",{
  method:"POST",
  headers:{Origin:options.origin??origin,"Sec-Fetch-Site":"same-origin",
   "X-UpTillDawn-Action-Hint":id,Cookie:cookie},body
 })
}
assert.deepEqual(nativeWaveThreeActionIds.toSorted(),
 cases.map(x=>"lib/actions/"+x[0]).toSorted())
assert.equal(nativeEventAdminActionIds.length,6)
assert.equal(nativeShiftMemberActionIds.length,6)
const missing=randomUUID()
let browser,signins=0,publicDenials=0,signedDbDenials=0,spoofDenials=0,forwards=0
try{
 browser=await chromium.launch({headless:true})
 for(const bot of bots){
  const context=await browser.newContext({locale:"nl-BE",viewport:{width:1280,height:800}})
  try{
   const page=await context.newPage()
   await page.goto(origin+"/login/"+bot.portal,{waitUntil:"domcontentloaded",timeout:30000})
   await page.locator('input[name="email"]').fill(bot.email)
   await page.locator('input[name="password"]').fill(password)
   await page.locator('form button[type="submit"]').click()
   await page.locator('[data-app-shell-ready="true"]').waitFor({timeout:30000})
   assert.equal(await page.locator('[data-app-error="true"]').count(),0)
   const cookie=(await context.cookies(origin)).map(c=>c.name+"="+c.value).join("; ")
   assert.ok(hasOriginalAuthCookie(cookie))
   const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:key,
    UPT_MIGRATION_ALLOW_WRITES:"true",
    MAIN_AUTH:{fetch:async()=>{forwards++;throw Error("SOURCE_FORWARD_NOT_ALLOWED")}}}
   const verified=await sourceReadSession(new Request(origin+"/api/push/config",{
    headers:{Cookie:cookie}
   }),env)
   assert.equal(verified.ok,true)
   const {data:{user},error:authError}=await verified.db.auth.getUser()
   assert.equal(authError,null);assert.ok(user?.id)
   const {data:approved,error:approvalError}=await verified.db.rpc("upt_is_approved")
   assert.equal(approvalError,null);assert.equal(approved,true)
   const {data:admin,error:adminError}=await verified.db.rpc("upt_is_admin",{uid:user.id})
   assert.equal(adminError,null);assert.equal(admin,bot.admin,"QA_ROLE_DRIFT")
   signins++
   for(const [name,fields]of cases){
    const action="lib/actions/"+name
    const live=await context.request.post(origin+"/api/migration/actions",{
     multipart:Object.fromEntries(actionForm(action,fields(missing))),
     headers:{Origin:origin,"X-UpTillDawn-Action-Hint":action},
     timeout:18000,maxRedirects:0
    })
    assert.equal(live.status(),503,"PUBLIC_WAVE_THREE_WRITE_OPEN: "+name)
    assert.deepEqual(await live.json(),{error:"migration_writes_disabled"})
    publicDenials++
   }
   for(const [name,fields]of cases){
    const action="lib/actions/"+name
    // Both identities use ONLY missing resource UUIDs. Database guard must
    // reject each attempted write, no real object ID is ever passed.
    const response=await app.request(localRequest(cookie,action,fields(missing)),{},env)
    assert.equal(response.status,422,"SIGNED_WAVE_THREE_ERROR_EXPECTED: "+bot.id+" "+name)
    assert.deepEqual(await response.json(),{
     error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",code:"action_failed"
    })
    assert.equal(response.headers.get("cache-control"),"private, no-store")
    signedDbDenials++
   }
   const keyId="lib/actions/events.ts#closeEvent",fields=cases[0][1](missing)
   const evil=await app.request(localRequest(cookie,keyId,fields,{
    origin:"https://attacker.invalid"
   }),{},env)
   assert.equal(evil.status,403)
   const spoof=await app.request(localRequest(cookie,keyId,fields,{
    actualId:"lib/actions/events.ts#restoreEvent"
   }),{},env)
   assert.equal(spoof.status,404)
   spoofDenials+=2
   assert.equal(forwards,0)
   console.log("PASS wave-three signed Main-QA "+bot.id+
    " / 12 public write denials / 12 signed missing-resource RLS checks")
  }finally{await context.close()}
 }
 assert.equal(signins,2)
 assert.equal(publicDenials,24)
 assert.equal(signedDbDenials,24)
 assert.equal(spoofDenials,4)
 assert.equal(forwards,0)
 console.log(JSON.stringify({
  qaOnly:true,originalMainUnchanged:true,productionUnchanged:true,
  publishedWorkerWriteEnabled:false,signedBrowserSessions:signins,
  publishedWorkerWriteDenials:publicDenials,
  inProcessSignedMissingTargetDenials:signedDbDenials,
  spoofedOriginOrActionDenied:spoofDenials,legacySourceForwards:forwards,
  positiveMutationCoverage:"separate SQL rollback only",fullProductionOrVisualParityVerified:false
 }))
}finally{if(browser)await browser.close()}
