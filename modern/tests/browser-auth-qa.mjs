// Read-only authenticated acceptance of the isolated Vite candidate using
// precisely seven fixed Main QA bots. No service role, never production.
// Logins occur once per bot. Session cookies are replayed in memory for 4
// locales x 2 device profiles, avoiding 56 expensive Auth sign-ins.
import {spawn} from "node:child_process"
import {resolve} from "node:path"
import {chromium} from "playwright"

const url=new URL(process.env.E2E_MAIN_QA_BASE_URL||"")
const key=process.env.E2E_MAIN_QA_PUBLISHABLE_KEY||""
const password=process.env.E2E_MAIN_QA_PASSWORD||""
if(url.origin!=="https://npbjrtiolqperdgljnhi.supabase.co"||url.pathname!=="/"||
 url.search||url.hash)throw Error("QA_ONLY_ENDPOINT_REQUIRED")
if(!key.startsWith("sb_publishable_"))throw Error("QA_PUBLISHABLE_KEY_REQUIRED")
if(password.length<24)throw Error("QA_PASSWORD_NOT_CONFIGURED")
if(process.env.VITE_MIGRATION_ALLOW_WRITES!=="false")throw Error("READ_ONLY_CANDIDATE_REQUIRED")
const bots=[
 {role:"head_admin",email:"e2e-head-admin@uptilldawn.test",admin:true,promotion:true,responsible:true},
 {role:"left_hand",email:"e2e-admin@uptilldawn.test",admin:true,promotion:false,responsible:false},
 {role:"right_hand",email:"e2e-right-hand@uptilldawn.test",admin:true,promotion:false,responsible:false},
 {role:"responsible",email:"e2e-responsible@uptilldawn.test",admin:false,promotion:false,responsible:true},
 {role:"staff",email:"e2e-staff@uptilldawn.test",admin:false,promotion:false,responsible:false},
 {role:"promotion",email:"e2e-promotion@uptilldawn.test",admin:false,promotion:true,responsible:false},
 {role:"administration",email:"e2e-administration@uptilldawn.test",admin:true,promotion:false,responsible:false},
]
const translations={nl:"Overzicht",fr:"Accueil",en:"Overview",de:"Übersicht"}
const devices=[
 {name:"desktop",viewport:{width:1440,height:900},isMobile:false,hasTouch:false},
 {name:"mobile",viewport:{width:390,height:844},isMobile:true,hasTouch:true}
]
const approvedRemote="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const remoteOrigin=process.env.E2E_MAIN_MODERN_QA_ORIGIN||""
if(remoteOrigin&&remoteOrigin!==approvedRemote)
 throw Error("EXACT_MODERN_MAIN_QA_ORIGIN_REQUIRED")
const origin=remoteOrigin||"http://127.0.0.1:4176"
const root=resolve(import.meta.dirname,"../..")
const preview=remoteOrigin?null:spawn(process.execPath,[resolve(root,"modern/node_modules/vite/bin/vite.js"),
 "preview","--host","127.0.0.1","--port","4176","--strictPort"],{
 cwd:resolve(root,"modern"),stdio:"ignore"
})
let browser
let total=0
let signins=0
async function ready(page){
 await page.locator('a[href="/overview"]').first().waitFor({state:"visible",timeout:20000})
}
async function denied(page,path){
 await page.goto(origin+path,{waitUntil:"domcontentloaded",timeout:15000})
 await ready(page)
 await page.getByRole("alert").first().waitFor({state:"visible",timeout:12000})
 if(await page.locator('h1').filter({hasText:"UP TILL DAWN —"}).count())
  throw Error("Unauthenticated route loaded during authenticated QA")
}
async function assertNav(page,bot){
 for(const [route,allowed] of [
  ["/events",true],["/portals/administration",bot.admin],
  ["/portals/promotion",bot.promotion],
  ["/responsible",bot.responsible],
  ["/maker/diagnostics",false],
 ]){
  const count=await page.locator('header nav a[href="'+route+'"], header a[href="'+route+'"]').count()
  if((count>0)!==allowed)throw Error("QA_NAV_POLICY "+bot.role+" "+route)
 }
}
try{
 let up=false
 for(let i=0;i<80;i++){
  if(preview&&preview.exitCode!==null)throw Error("Candidate preview exited")
  try{
   const response=await fetch(origin+"/login",{signal:AbortSignal.timeout(1000)})
   if(response.ok){up=true;break}
  }catch{}
  await new Promise(done=>setTimeout(done,250))
 }
 if(!up)throw Error("QA_CANDIDATE_PREVIEW_UNAVAILABLE")
 browser=await chromium.launch({headless:true})
 for(const bot of bots){
  // The only credential operation in this harness is this one QA login.
  const loginContext=await browser.newContext({viewport:devices[0].viewport})
  try{
   await loginContext.addInitScript(()=>localStorage.setItem("uptilldawn-modern-locale","nl"))
   const loginPage=await loginContext.newPage()
   await loginPage.goto(origin+"/login",{waitUntil:"domcontentloaded",timeout:15000})
   await loginPage.locator('input[name="email"]').fill(bot.email)
   await loginPage.locator('input[name="password"]').fill(password)
   await loginPage.locator('button.primary').click()
   await ready(loginPage)
   signins++
   await assertNav(loginPage,bot)
   // Real signed, RLS-protected reads on the candidate, not only navbar labels.
   // Every page remains read-only; no business data is created or updated.
   const routes=["/profile","/notifications","/crew","/qr",
    ...(bot.admin?["/portals/administration"]:[]),
    ...(bot.promotion?["/portals/promotion"]:[]),
    ...(bot.responsible?["/responsible"]:[])]
   for(const route of routes){
    await loginPage.goto(origin+route,{waitUntil:"domcontentloaded",timeout:15000})
    await ready(loginPage)
    await loginPage.waitForTimeout(700)
    const error=await loginPage.locator('p[role="alert"].error').count()
    if(error)throw Error("QA_AUTHENTICATED_READ_FAILED "+bot.role+" "+route)
    if(route==="/crew"){
     // Open the actual personnel data screens, not merely their navigation.
     // Signed reads remain bounded and sequential to respect the free plan.
     for(const tab of ["Check-ins","Gewerkte uren"]){
      await loginPage.getByRole("button",{name:tab}).click()
      await loginPage.waitForTimeout(900)
      if(await loginPage.locator('p[role="alert"].error').count())
       throw Error("QA_AUTHENTICATED_TIMEKEEPING_READ_FAILED "+bot.role+" "+tab)
     }
    }
   }
   await denied(loginPage,"/maker/diagnostics")
   if(!bot.admin)await denied(loginPage,"/portals/administration")
   if(!bot.promotion)await denied(loginPage,"/portals/promotion/chat")
   const state=await loginContext.storageState()
   // This is in-memory only: never write storageState to disk, artifacts or logs.
   for(const [language,label] of Object.entries(translations)){
    for(const device of devices){
     const context=await browser.newContext({
      storageState:state,viewport:device.viewport,isMobile:device.isMobile,
      hasTouch:device.hasTouch,
     })
     try{
      await context.addInitScript(lang=>localStorage.setItem("uptilldawn-modern-locale",lang),language)
      const page=await context.newPage()
      const jsErrors=[]
      page.on("pageerror",error=>jsErrors.push(error.name))
      await page.goto(origin+"/overview",{waitUntil:"domcontentloaded",timeout:15000})
      await ready(page)
      if((await page.locator("html").getAttribute("lang"))!==language)
       throw Error("QA_LOCALE "+bot.role+" "+language)
      await page.locator('header nav a[href="/overview"]').first().waitFor({state:"visible"})
      const actual=await page.locator('header nav a[href="/overview"]').first().innerText()
      if(!actual.includes(label))throw Error("QA_TRANSLATION "+bot.role+" "+language)
      await assertNav(page,bot)
      if(jsErrors.length)throw Error("QA_JS_ERRORS "+bot.role+" "+language+" "+device.name)
      total++
      console.log("PASS authenticated candidate "+bot.role+" / "+language+" / "+device.name)
     }finally{await context.close()}
    }
   }
  }finally{await loginContext.close()}
  // No parallel logins or browser fanout against resource-limited Main QA.
  await new Promise(done=>setTimeout(done,250))
 }
 if(signins!==7||total!==56)throw Error("QA_INCOMPLETE_COVERAGE")
 console.log(JSON.stringify({validated:true,qaBots:7,actualBotSignins:signins,
  authenticatedBrowserScenarios:total,locales:4,deviceProfiles:2,
  target:"isolated-main-qa",wroteBusinessData:false,productionReady:false}))
}finally{
 if(browser)await browser.close()
 preview?.kill("SIGTERM")
}
