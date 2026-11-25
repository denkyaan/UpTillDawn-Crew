// Live signed negative acceptance only. Mismatched envelopes cannot create
// data. No positive business mutation, provider operation or privileged key.
import assert from "node:assert/strict"
import {mkdirSync,writeFileSync} from "node:fs"
import {resolve} from "node:path"
import {execFileSync} from "node:child_process"
import {chromium} from "playwright"
import {actionEntries} from "../tooling/main-source.mjs"
import {sourceReadSession,hasOriginalAuthCookie} from "../src/api/native-main-reads.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const password=process.env.E2E_MAIN_QA_PASSWORD||""
const key=process.env.E2E_MAIN_QA_PUBLISHABLE_KEY||""
if(process.env.E2E_MAIN_MODERN_QA_ORIGIN!==origin||
 process.env.E2E_MAIN_QA_BASE_URL!==qa+"/"||
 process.env.VITE_MIGRATION_ALLOW_WRITES!=="false"||
 !key.startsWith("sb_publishable_")||password.length<24)throw Error("EXACT_MAIN_QA_ONLY")
const ids=actionEntries().map(a=>a.id)
assert.equal(ids.length,163);assert.equal(new Set(ids).size,163)
const identities=[
 {role:"head-admin",portal:"admin",email:"e2e-head-admin@uptilldawn.test",admin:true},
 {role:"staff",portal:"staff",email:"e2e-staff@uptilldawn.test",admin:false}
]
let browser,denials=0,signins=0
const failures=[],verified=[]
const sha=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()
if(process.env.QA_VALIDATED_SHA&&process.env.QA_VALIDATED_SHA!==sha)throw Error("DENIAL_WRONG_CHECKOUT")
try{
 browser=await chromium.launch({headless:true})
 for(const bot of identities){
  const context=await browser.newContext({locale:"nl-BE"})
  let db
  try{
   const page=await context.newPage()
   await page.goto(origin+"/login/"+bot.portal,{waitUntil:"domcontentloaded",timeout:20000})
   await page.locator('input[name="email"]').fill(bot.email)
   await page.locator('input[name="password"]').fill(password)
   await page.locator('form button[type="submit"]').click()
   await page.waitForURL(url=>!url.pathname.startsWith("/login"),{timeout:25000})
   const cookie=(await context.cookies(origin)).map(c=>c.name+"="+c.value).join("; ")
   assert.ok(hasOriginalAuthCookie(cookie))
   const verified=await sourceReadSession(new Request(origin+"/api/push/config",{headers:{Cookie:cookie}}),{SUPABASE_URL:qa,SUPABASE_ANON_KEY:key})
   assert.equal(verified.ok,true)
   db=verified.db
   const {data:{user},error}=await db.auth.getUser()
   assert.equal(error,null);assert.equal(user?.email,bot.email)
   const {data:admin,error:adminError}=await db.rpc("upt_is_admin",{uid:user.id})
   assert.equal(adminError,null);assert.equal(admin,bot.admin)
   const {data:owner,error:ownerError}=await db.rpc("upt_current_is_owner")
   assert.equal(ownerError,null);assert.equal(owner,false)
   signins++
   // Small bounded batches. Rejected before business DB access.
   for(let start=0;start<ids.length;start+=4){
    const results=await Promise.allSettled(ids.slice(start,start+4).map(async id=>{
     const response=await context.request.post(origin+"/api/migration/actions",{
      // Exact registered ID, not an unknown synthetic envelope. Public writes are disabled before dispatch.
      multipart:{_id:id,_args:"[]"},
      headers:{Origin:origin,"X-UpTillDawn-Action-Hint":id},
      timeout:12000,maxRedirects:0
     })
     try{
      if(response.status()!==503||!(response.headers()["cache-control"]||"").includes("no-store")||
         (await response.json()).error!=="migration_writes_disabled")
       throw Error("PUBLIC_GATE_DENIAL_"+response.status())
      return id
     }finally{await response.dispose()}
    }))
    for(const [i,result] of results.entries()){
     if(result.status==="fulfilled"){denials++;verified.push({role:bot.role,id:result.value})}
     else failures.push({role:bot.role,id:ids[start+i],reason:"public_write_gate_failed"})
    }
   }
  }catch(error){
   failures.push({role:bot.role,reason:"signed_identity_incomplete",type:error instanceof Error?error.name:"Error"})
  }finally{
   if(db)try{await db.auth.signOut({scope:"local"})}catch{}
   await context.close()
  }
 }
 const report={validatedSha:sha,runId:process.env.GITHUB_RUN_ID||null,runAttempt:process.env.GITHUB_RUN_ATTEMPT||null,originalActions:ids.length,signedIdentities:signins,publicWriteDenials:denials,expectedDenials:326,verified,failures,businessWrites:0,positiveWriteParityVerified:false,productionReady:false}
 const dir=resolve(import.meta.dirname,"../../test-results/modern-action-denials")
 mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,"report.json"),JSON.stringify(report,null,2)+"\n")
 console.log(JSON.stringify({...report,verified:undefined}))
 if(signins!==2||denials!==326||failures.length)throw Error("ALL_NATIVE_ACTION_WRITE_DENIALS_INCOMPLETE")
}finally{await browser?.close()}
