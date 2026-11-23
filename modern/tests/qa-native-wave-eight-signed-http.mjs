// Signed, opt-in, isolated Main-QA browser security test for 15 original
// crew/event and Maker actions. Never invoke positive resource creation.
// Public Worker writes stay strictly disabled. Original Main is untouched.
import assert from "node:assert/strict"
import {randomUUID} from "node:crypto"
import {chromium} from "playwright"
import app from "../src/api/worker.ts"
import {sourceReadSession,hasOriginalAuthCookie} from "../src/api/native-main-reads.ts"
import {encode} from "../../lib/migration/wire.ts"
import {megaCrewEventActionIds} from "../src/api/native-mega-crew-event-actions.ts"
import {megaMakerActionIds} from "../src/api/native-mega-maker-actions.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const key="sb_publishable_zStTw3n8wZ271PehDRDvGg_rs0JOy84"
const password=process.env.E2E_MAIN_QA_PASSWORD||""
if(process.env.E2E_MAIN_QA_BASE_URL!==qa+"/"||
 process.env.E2E_MAIN_MODERN_QA_ORIGIN!==origin||
 process.env.VITE_MIGRATION_ALLOW_WRITES!=="false"||password.length<24)
 throw Error("WAVE_EIGHT_SIGNED_MAIN_QA_ONLY")

const bots=[
 {id:"head-admin",portal:"admin",email:"e2e-head-admin@uptilldawn.test",admin:true},
 {id:"staff",portal:"staff",email:"e2e-staff@uptilldawn.test",admin:false},
]
const early="2026-12-02T17:00:00+01:00",late="2026-12-03T05:00:00+01:00"
const cases=[
 ["events.ts#createEvent",id=>({name:"QA blocked event",start_at:early,end_at:late})],
 ["events.ts#archiveEventWithState",id=>({event_id:id})],
 ["events.ts#restoreEventWithState",id=>({event_id:id})],
 ["uptilldawn.ts#createEvent",id=>({name:"QA blocked event",start_at:early,end_at:late})],
 ["uptilldawn.ts#addWorkplace",id=>({event_id:id,name:"QA Lockers",default_shift_start:early,
  default_shift_end:late,target_staff:"1",sort_order:"1"})],
 ["uptilldawn.ts#updateWorkplace",id=>({workplace_id:id,name:"QA Lockers",default_shift_start:early,
  default_shift_end:late,target_staff:"1"})],
 ["uptilldawn.ts#addEventMember",id=>({event_id:id,user_id:randomUUID()})],
 ["uptilldawn.ts#addAvailableEventMembers",id=>({event_id:id,user_id:randomUUID()})],
 ["uptilldawn.ts#assignAvailableCrewShift",id=>({event_id:id,user_id:randomUUID(),
  workplace_id:randomUUID(),start:early,end:late,shift_kind:"event"})],
 ["uptilldawn.ts#assignResponsible",id=>({workplace_id:id,user_id:randomUUID()})],
 ["uptilldawn.ts#demoteResponsibleToStaff",id=>({workplace_id:id,user_id:randomUUID()})],
 ["auth.ts#enterNormalAppFromMakerSession",id=>({portal:"admin"})],
 ["god-mode.ts#enterGodModeFromMakerSession",id=>({})],
 ["god-mode.ts#godModeLogout",id=>({})],
 ["god-mode.ts#returnToNormalAppFromGodMode",id=>({})]
]
function actionForm(id,fields){
 const fd=new FormData()
 for(const [name,value]of Object.entries(fields))fd.set(name,value)
 const args=id.endsWith("WithState")?[{error:null},fd]:
  ["#enterGodModeFromMakerSession","#godModeLogout","#returnToNormalAppFromGodMode"]
   .some(end=>id.endsWith(end))?[]:[fd]
 const body=new FormData()
 body.set("_id",id)
 body.set("_args",JSON.stringify(encode(args,body)))
 return body
}
function localRequest(cookie,id,fields,options={}){
 const body=actionForm(id,fields)
 body.set("_id",options.actualId??id)
 return new Request(origin+"/api/migration/actions",{
  method:"POST",headers:{Origin:options.origin??origin,
   "Sec-Fetch-Site":"same-origin","X-UpTillDawn-Action-Hint":id,Cookie:cookie},body
 })
}
assert.deepEqual([...megaCrewEventActionIds,...megaMakerActionIds].toSorted(),
 cases.map(v=>"lib/actions/"+v[0]).toSorted())
assert.equal(megaCrewEventActionIds.length,11)
assert.equal(megaMakerActionIds.length,4)
const missing=randomUUID()
const safeNames=[
 "uptilldawn.ts#updateWorkplace",
 "uptilldawn.ts#addEventMember",
 "uptilldawn.ts#addAvailableEventMembers",
 "uptilldawn.ts#assignAvailableCrewShift",
 "uptilldawn.ts#assignResponsible",
 "uptilldawn.ts#demoteResponsibleToStaff"
]
let browser,signins=0,publicDenials=0,signedDenials=0,ownerDenials=0,spoofDenials=0,forwards=0
try{
 browser=await chromium.launch({headless:true})
 for(const bot of bots){
  const ctx=await browser.newContext({locale:"nl-BE",viewport:{width:1280,height:800}})
  try{
   const page=await ctx.newPage()
   await page.goto(origin+"/login/"+bot.portal,{waitUntil:"domcontentloaded",timeout:30000})
   await page.locator('input[name="email"]').fill(bot.email)
   await page.locator('input[name="password"]').fill(password)
   await page.locator('form button[type="submit"]').click()
   await page.locator('[data-app-shell-ready="true"]').waitFor({timeout:30000})
   assert.equal(await page.locator('[data-app-error="true"]').count(),0)
   const cookie=(await ctx.cookies(origin)).map(c=>c.name+"="+c.value).join("; ")
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
   const {data:admin,error:adminError}=await verified.db.rpc("upt_is_admin",{uid:user.id})
   assert.equal(adminError,null);assert.equal(admin,bot.admin)
   const {data:owner,error:ownerError}=await verified.db.rpc("upt_current_is_owner")
   assert.equal(ownerError,null);assert.equal(owner,false,"TEST_BOT_MUST_NOT_BE_MAKER")
   signins++
   for(const [name,fields]of cases){
    const action="lib/actions/"+name
    const response=await ctx.request.post(origin+"/api/migration/actions",{
     multipart:Object.fromEntries(actionForm(action,fields(missing))),
     headers:{Origin:origin,"X-UpTillDawn-Action-Hint":action},
     timeout:18000,maxRedirects:0
    })
    assert.equal(response.status(),503,"WAVE_EIGHT_PUBLIC_WRITE_OPEN "+name)
    assert.deepEqual(await response.json(),{error:"migration_writes_disabled"})
    publicDenials++
   }
   // Only nonexistent-target paths; no in-process creation, role changes,
   // God Mode login or logout, or real user/shift/document operations.
   for(const name of safeNames){
    const action="lib/actions/"+name
    const fields=cases.find(x=>x[0]===name)[1](missing)
    const response=await app.request(localRequest(cookie,action,fields),{},env)
    assert.equal(response.status,422,"EXPECTED_MISSING_RESOURCE_DENIAL "+name+" "+bot.id)
    const data=await response.json()
    assert.equal(data.code,"action_failed")
    signedDenials++
   }
   for(const name of [
    "auth.ts#enterNormalAppFromMakerSession",
    "god-mode.ts#enterGodModeFromMakerSession",
    "god-mode.ts#returnToNormalAppFromGodMode"
   ]){
    const action="lib/actions/"+name
    const fields=cases.find(x=>x[0]===name)[1](missing)
    const response=await app.request(localRequest(cookie,action,fields),{},env)
    assert.equal(response.status,200)
    assert.deepEqual(await response.json(),{redirect:"/unauthorized"})
    ownerDenials++
   }
   const spoofAction="lib/actions/uptilldawn.ts#updateWorkplace",
    spoofFields=cases.find(x=>x[0]==="uptilldawn.ts#updateWorkplace")[1](missing)
   assert.equal((await app.request(localRequest(cookie,spoofAction,spoofFields,{
    origin:"https://attacker.invalid"
   }),{},env)).status,403)
   assert.equal((await app.request(localRequest(cookie,spoofAction,spoofFields,{
    actualId:"lib/actions/uptilldawn.ts#addWorkplace"
   }),{},env)).status,404)
   spoofDenials+=2
   assert.equal(forwards,0)
   console.log("PASS wave-eight "+bot.id+": 15 deployed write denials, 6 signed missing targets, 3 owner-gated actions")
  }finally{await ctx.close()}
 }
 assert.equal(signins,2)
 assert.equal(publicDenials,30)
 assert.equal(signedDenials,12)
 assert.equal(ownerDenials,6)
 assert.equal(spoofDenials,4)
 assert.equal(forwards,0)
 console.log(JSON.stringify({
  qaOnly:true,originalMainUnchanged:true,productionUnchanged:true,
  signedBrowserSessions:signins,publishedWorkerWriteEnabled:false,
  publicWriteDenials:publicDenials,signedMissingResourceDenials:signedDenials,
  ownerPrivilegeDenials:ownerDenials,spoofedRequestsDenied:spoofDenials,
  sourceForwards:forwards,fullFunctionalOrVisualParityVerified:false
 }))
}finally{if(browser)await browser.close()}
