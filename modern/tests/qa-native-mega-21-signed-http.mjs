// One opt-in signed Main-QA browser job for the full 21-action mega-bundle.
// Public Hono writes MUST be disabled; dangerous positive admin writes are
// explicitly excluded from in-process tests outside rollback transactions.
import assert from "node:assert/strict"
import {randomUUID} from "node:crypto"
import {chromium} from "playwright"
import app from "../src/api/worker.ts"
import {sourceReadSession,hasOriginalAuthCookie} from "../src/api/native-main-reads.ts"
import {encode} from "../../lib/migration/wire.ts"
import {megaPeopleActionIds} from "../src/api/native-mega-people-actions.ts"
import {megaOperationsActionIds} from "../src/api/native-mega-operations-actions.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const key="sb_publishable_zStTw3n8wZ271PehDRDvGg_rs0JOy84"
const password=process.env.E2E_MAIN_QA_PASSWORD||""
if(process.env.E2E_MAIN_QA_BASE_URL!==qa+"/"||
 process.env.E2E_MAIN_MODERN_QA_ORIGIN!==origin||
 process.env.VITE_MIGRATION_ALLOW_WRITES!=="false"||password.length<24)
 throw Error("MEGABUNDLE_MAIN_QA_ONLY_SIGNED_ACCEPTANCE_REQUIRED")
const bots=[
 {id:"head-admin",portal:"admin",email:"e2e-head-admin@uptilldawn.test",admin:true},
 {id:"staff",portal:"staff",email:"e2e-staff@uptilldawn.test",admin:false}
]
const simple=[
 ["promotion-tasks.ts#createPromotionTask",id=>({request:id,title:"QA no target",user_id:randomUUID()})],
 ["promotion-tasks.ts#assignGeneralPromotionTask",id=>({task_id:id,user_id:randomUUID()})],
 ["promotion-tasks.ts#editPromotionTask",id=>({task_id:id,title:"QA task",expected_updated_at:"2026-11-23T20:00:00+01:00"})],
 ["promotion-tasks.ts#removeGeneralPromotionAssignment",id=>({assignment_id:id})],
 ["admin-inventory-batch.ts#receiveAdminInventoryBatch",id=>({
  request:id,document:randomUUID(),confirm:"yes",rows:JSON.stringify([{line:randomUUID(),item:randomUUID(),quantity:1}])
 })],
 ["portal-roles.ts#changePortalRole",id=>({user_id:id,portal:"events",role:"event_staff",action:"approve"})],
 ["personnel-dual-roles.ts#savePersonnelRoleSlot",id=>({user_id:id,role_one:"staff",role_two:"promotion",save_slot:"1"})],
 ["personnel.ts#setPersonnelBlock",id=>({user_id:id,blocked:"true",reason:"QA"})],
 ["personnel.ts#setPersonnelRole",id=>({user_id:id,role:"staff"})],
 ["uptilldawn.ts#approvePersonnelAccount",id=>({user_id:id,role:"staff"})],
 ["uptilldawn.ts#setAccountStatus",id=>({user_id:id,status:"approved",role:"staff"})],
 ["platform.ts#savePayRate",id=>({user_id:id,hourly_rate:"20",effective_from:"2026-12-01"})],
 ["platform.ts#createKnowledgeArticle",id=>({event_id:id,title:"QA knowledge",body:"No real record"})],
 ["platform.ts#createQrResource",id=>({event_id:id,resource_type:"workplace",title:"QA QR",route:"/workplaces"})],
 ["platform.ts#updateAssetMetadata",id=>({item_id:id})],
 ["uptilldawn.ts#removeOperationalChecklistItem",id=>({item_id:id})],
 ["uptilldawn.ts#reopenOperationalChecklistItem",id=>({item_id:id})],
 ["uptilldawn.ts#archiveEventDocument",id=>({document_id:id})],
 ["uptilldawn.ts#removeTaskAssignment",id=>({assignment_id:id})],
 ["uptilldawn.ts#markAllNotificationsRead",id=>({})],
 ["uptilldawn.ts#updateEvent",id=>({event_id:id,name:"QA event",start_at:"2026-12-01T18:00:00+01:00",
  end_at:"2026-12-02T04:00:00+01:00",registration_deadline:"2026-12-01T18:00:00+01:00",radius:"100"})]
]
function actionForm(id,fields){
 const fd=new FormData()
 for(const [name,value]of Object.entries(fields))fd.set(name,value)
 const args=id.endsWith("#markAllNotificationsRead")?[]:
  id.endsWith("#receiveAdminInventoryBatch")||id.endsWith("#savePersonnelRoleSlot")?
   [{error:null},fd]:[fd]
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
assert.deepEqual([...megaPeopleActionIds,...megaOperationsActionIds].toSorted(),
 simple.map(v=>"lib/actions/"+v[0]).toSorted())
assert.equal(megaPeopleActionIds.length,11)
assert.equal(megaOperationsActionIds.length,10)
const missing=randomUUID()
let browser,signins=0,publicDenials=0,signedDenials=0,spoofDenials=0,forwards=0
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
   const verified=await sourceReadSession(new Request(origin+"/api/push/config",{headers:{Cookie:cookie}}),env)
   assert.equal(verified.ok,true)
   const {data:{user},error:authError}=await verified.db.auth.getUser()
   assert.equal(authError,null);assert.ok(user?.id)
   const {data:admin,error:adminError}=await verified.db.rpc("upt_is_admin",{uid:user.id})
   assert.equal(adminError,null);assert.equal(admin,bot.admin)
   const {data:profiles,error:contextError}=await verified.db.rpc("upt_current_session_context")
   assert.equal(contextError,null)
   assert.equal(profiles?.[0]?.id,user.id)
   signins++
   // 21/21 actions must be blocked on the ACTUAL deployed Main-QA Worker.
   for(const [name,fields]of simple){
    const action="lib/actions/"+name
    const live=await context.request.post(origin+"/api/migration/actions",{
     multipart:Object.fromEntries(actionForm(action,fields(missing))),
     headers:{Origin:origin,"X-UpTillDawn-Action-Hint":action},
     timeout:18000,maxRedirects:0
    })
    assert.equal(live.status(),503,"PUBLIC_WRITE_OPEN: "+name)
    assert.deepEqual(await live.json(),{error:"migration_writes_disabled"})
    publicDenials++
   }
   // These are the three VERIFIED non-mutating negative cases per signed
   // identity. Never run a targetless insert or mark-all notification on live QA.
   for(const name of [
    "uptilldawn.ts#removeOperationalChecklistItem",
    "uptilldawn.ts#archiveEventDocument",
    "uptilldawn.ts#removeTaskAssignment"
   ]){
    const action="lib/actions/"+name
    const fields=simple.find(x=>x[0]===name)[1](missing)
    const response=await app.request(localRequest(cookie,action,fields),{},env)
    assert.equal(response.status,422,"EXPECTED_SIGNED_DENIAL: "+bot.id+" "+name)
    assert.deepEqual(await response.json(),{
     error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",code:"action_failed"
    })
    signedDenials++
   }
   const base="lib/actions/personnel.ts#setPersonnelBlock",fields={user_id:missing,blocked:"true"}
   assert.equal((await app.request(localRequest(cookie,base,fields,{
    origin:"https://attacker.invalid"
   }),{},env)).status,403)
   assert.equal((await app.request(localRequest(cookie,base,fields,{
    actualId:"lib/actions/personnel.ts#setPersonnelRole"
   }),{},env)).status,404)
   spoofDenials+=2
   assert.equal(forwards,0)
   console.log("PASS 21-action mega-bundle signed "+bot.id+": 21 public denials, 3 missing-resource denials")
  }finally{await context.close()}
 }
 assert.equal(signins,2)
 assert.equal(publicDenials,42)
 assert.equal(signedDenials,6)
 assert.equal(spoofDenials,4)
 assert.equal(forwards,0)
 console.log(JSON.stringify({
  qaOnly:true,originalMainUnchanged:true,productionUnchanged:true,
  signedBrowserSessions:signins,publishedWorkerWriteEnabled:false,
  publicWriteDenials:publicDenials,inProcessSignedNegativeDenials:signedDenials,
  spoofedRequestsDenied:spoofDenials,legacySourceForwards:forwards,
  positiveMutationCoverage:"not tested by live signed HTTP; SQL rollback only",
  fullFunctionalOrVisualParityVerified:false
 }))
}finally{if(browser)await browser.close()}
