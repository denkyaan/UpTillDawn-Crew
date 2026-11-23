// Explicit, one-commit Main-QA signed acceptance for original catalog/event
// wave six. No live business mutations or source forwarding, ever.
// Real public Worker flag must stay OFF; synthetic UUID targets only.
import assert from "node:assert/strict"
import {randomUUID} from "node:crypto"
import {chromium} from "playwright"
import app from "../src/api/worker.ts"
import {sourceReadSession,hasOriginalAuthCookie} from "../src/api/native-main-reads.ts"
import {encode} from "../../lib/migration/wire.ts"
import {
 nativeCatalogActionIds,nativeCatalogAdminActionIds,nativeCatalogManagerActionIds
} from "../src/api/native-catalog-event-actions.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const key="sb_publishable_zStTw3n8wZ271PehDRDvGg_rs0JOy84"
const password=process.env.E2E_MAIN_QA_PASSWORD||""
if(process.env.E2E_MAIN_QA_BASE_URL!==qa+"/"||
 process.env.E2E_MAIN_MODERN_QA_ORIGIN!==origin||
 process.env.VITE_MIGRATION_ALLOW_WRITES!=="false"||password.length<24)
 throw Error("WAVE_SIX_MAIN_QA_ONLY_SIGNED_ACCEPTANCE_REQUIRED")

const bots=[
 {id:"head-admin",portal:"admin",email:"e2e-head-admin@uptilldawn.test",admin:true},
 {id:"staff",portal:"staff",email:"e2e-staff@uptilldawn.test",admin:false}
]
const cases=[
 ["workplace-catalog.ts#createCatalogWorkplace",id=>({name:"QA_STANDARDCATALOG_DO_NOT_COMMIT",target_staff:"1"})],
 ["workplace-catalog.ts#updateCatalogWorkplace",id=>({workplace_id:id,name:"QA Lockers",target_staff:"1"})],
 ["workplace-catalog.ts#createCatalogItem",id=>({workplace_id:id,name:"QA missing catalog item",quantity:"1"})],
 ["workplace-catalog.ts#updateCatalogItem",id=>({item_id:id,name:"QA item",quantity:"1"})],
 ["events.ts#captureEventTemplate",id=>({event_id:id,template_name:"QA template",section_workplaces:"on"})],
 ["events.ts#applyEventTemplate",id=>({template_id:id,name:"QA event",start_at:"2026-12-01T18:00:00+01:00",end_at:"2026-12-02T06:00:00+01:00"})],
 ["uptilldawn.ts#duplicateEvent",id=>({event_id:id,name:"QA duplicate",start_at:"2026-12-01T18:00:00+01:00",end_at:"2026-12-02T06:00:00+01:00"})],
 ["uptilldawn.ts#archiveEvent",id=>({event_id:id})],
 ["uptilldawn.ts#deleteEvent",id=>({event_id:id})],
 ["uptilldawn.ts#createOperationalChecklist",id=>({workplace_id:id,kind:"opening",title:"QA checklist"})]
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
assert.deepEqual(nativeCatalogActionIds.toSorted(),
 cases.map(x=>"lib/actions/"+x[0]).toSorted())
assert.equal(nativeCatalogAdminActionIds.length,9)
assert.equal(nativeCatalogManagerActionIds.length,1)
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
    assert.equal(live.status(),503,"PUBLIC_WAVE_SIX_WRITE_OPEN: "+name)
    assert.deepEqual(await live.json(),{error:"migration_writes_disabled"})
    publicDenials++
   }
   for(const [name,fields]of cases){
    const action="lib/actions/"+name
    // Admin + targetless create would insert a real catalog row: NEVER
    // execute that positive case outside a transaction that rolls back.
    // The head-admin creation of a catalog item is also excluded until its
    // foreign-key guarantee is verified by isolated rollback SQL.
    if(bot.admin&&(name==="workplace-catalog.ts#createCatalogWorkplace"||
      name==="workplace-catalog.ts#createCatalogItem"))continue
    // Remaining admin calls target a fresh nonexistent UUID; ordinary staff
    // is denied by original role checks before any business SQL runs.
    const response=await app.request(localRequest(cookie,action,fields(missing)),{},env)
    assert.equal(response.status,422,"SIGNED_WAVE_SIX_ERROR_EXPECTED: "+bot.id+" "+name)
    assert.deepEqual(await response.json(),{
     error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",code:"action_failed"
    })
    assert.equal(response.headers.get("cache-control"),"private, no-store")
    signedDbDenials++
   }
   const keyId="lib/actions/workplace-catalog.ts#createCatalogWorkplace",fields=cases[0][1](missing)
   const evil=await app.request(localRequest(cookie,keyId,fields,{
    origin:"https://attacker.invalid"
   }),{},env)
   assert.equal(evil.status,403)
   const spoof=await app.request(localRequest(cookie,keyId,fields,{
    actualId:"lib/actions/workplace-catalog.ts#updateCatalogWorkplace"
   }),{},env)
   assert.equal(spoof.status,404)
   spoofDenials+=2
   assert.equal(forwards,0)
   console.log("PASS wave-six signed Main-QA "+bot.id+
    " / 10 public write denials / safe signed RLS checks")
  }finally{await context.close()}
 }
 assert.equal(signins,2)
 assert.equal(publicDenials,20)
 assert.equal(signedDbDenials,18)
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
