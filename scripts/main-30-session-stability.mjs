// Bounded MAIN-only acceptance: 30 simultaneously open browser tabs across the
// seven EXISTING isolated QA identities. No new users, production, payment,
// form submission or third-party provider interactions. This is 30 active
// browser sessions, NOT proof of 30 distinct human accounts.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'

const BASE='https://uptilldawn-main.uptilldawn.workers.dev'
const password=process.env.E2E_MAIN_QA_PASSWORD
if(process.env.E2E_MAIN_QA_BASE_URL!==BASE || !password || password.length<24)
 throw Error('MAIN concurrency QA requires exact isolated Main URL and 24+ character QA secret')

const roles=[
 {name:'head_admin',email:'e2e-head-admin@uptilldawn.test',login:'admin',path:'/admin'},
 {name:'left_hand',email:'e2e-admin@uptilldawn.test',login:'administration',path:'/portals/administration'},
 {name:'right_hand',email:'e2e-right-hand@uptilldawn.test',login:'administration',path:'/portals/administration'},
 {name:'administration',email:'e2e-administration@uptilldawn.test',login:'administration',path:'/portals/administration'},
 {name:'promotion',email:'e2e-promotion@uptilldawn.test',login:'promotion',path:'/portals/promotion'},
 {name:'responsible',email:'e2e-responsible@uptilldawn.test',login:'responsible',path:'/events'},
 {name:'staff',email:'e2e-staff@uptilldawn.test',login:'staff',path:'/tasks'},
]
const TARGET_SESSIONS=30
const HOLD_MS=65_000
const reportDir='test-results/main-30-session'
await mkdir(reportDir,{recursive:true})
const failures=[]
const fiveHundreds=[]
const results=[]
const contexts=[]
const startup=Date.now()
const browser=await chromium.launch({headless:true})
const scrub=error=>String(error?.message||error||'unknown')
 .split(password).join('[redacted]')
 .replace(/Bearer\s+[A-Za-z0-9._-]+/gi,'Bearer [redacted]')
 .slice(0,240)
const url=path=>new URL(path,BASE).href
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const observePage=(page,session,role)=>{
 page.on('pageerror',error=>failures.push({session,role,type:'browser_exception',message:scrub(error)}))
 page.on('response',response=>{
  if(response.status()<500)return
  try{if(new URL(response.url()).origin!==BASE)return}catch{return}
  fiveHundreds.push({session,role,status:response.status(),resourceType:response.request().resourceType()})
 })
}

try{
 const signedIn=[]
 // Authenticate only seven times. All extra tabs reuse a browser context,
 // not additional credentials, profiles or persistent bot accounts.
 for(const [index,role] of roles.entries()){
  const context=await browser.newContext({
   locale:['nl','fr','en','de'][index%4],
   viewport:index%2?{width:390,height:844}:{width:1280,height:800},
   reducedMotion:'reduce',
  })
  contexts.push(context)
  const page=await context.newPage()
  observePage(page,index+1,role.name)
  const response=await page.goto(url('/login/'+role.login),{waitUntil:'commit',timeout:40_000})
  assert.ok(response && response.status()<500,'Main login returned HTTP 5xx for '+role.name)
  await page.locator('form[data-login-hydrated="true"]').waitFor({state:'attached',timeout:40_000})
  await page.locator('#email').fill(role.email)
  await page.locator('#password').fill(password)
  const alert=page.locator('[data-login-error-code]')
  const outcomePromise=Promise.race([
   page.waitForURL(target=>!target.pathname.startsWith('/login'),{waitUntil:'commit',timeout:45_000})
    .then(()=>({type:'redirect'})),
   alert.waitFor({state:'visible',timeout:45_000}).then(()=>({type:'error'})),
  ])
  await page.locator('button[type="submit"]').click({timeout:40_000})
  const outcome=await outcomePromise
  if(outcome.type==='error'){
   const code=await alert.getAttribute('data-login-error-code')
   throw Error('Main QA login rejected for '+role.name+'; safe error code='+String(code||'unknown'))
  }
  const cookieNames=(await context.cookies(BASE)).map(cookie=>cookie.name)
  assert.ok(cookieNames.some(name=>/^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i.test(name)),
   'Missing authenticated SSR session for '+role.name)
  signedIn.push({role,context,page})
  console.log('MAIN_CONCURRENCY_AUTHENTICATED '+role.name)
 }

 const tabs=[]
 for(let i=0;i<TARGET_SESSIONS;i++){
  const signed=signedIn[i%roles.length]
  const page=i<signedIn.length?signed.page:await signed.context.newPage()
  const role=signed.role
  if(i>=signedIn.length)observePage(page,i+1,role.name)
  tabs.push({index:i+1,page,role})
 }
 assert.equal(tabs.length,30)

 // Ramp up requests with at most three simultaneous document navigations;
 // all 30 tabs remain OPEN and running simultaneously during the hold period.
 const queue=[...tabs]
 await Promise.all(Array.from({length:3},async()=>{
  for(let tab;(tab=queue.shift())!==undefined;){
   const started=Date.now()
   try{
    const response=await tab.page.goto(url(tab.role.path),{waitUntil:'commit',timeout:45_000})
    assert.ok(response && response.status()<500,
     'Main protected route returned HTTP '+(response?.status()??'unknown'))
    await tab.page.locator('main').first().waitFor({state:'visible',timeout:35_000})
    const current=new URL(tab.page.url())
    assert.equal(current.origin,BASE,'Unexpected browser origin')
    assert.ok(!current.pathname.startsWith('/login'),'QA session was lost')
    assert.ok(current.pathname===tab.role.path,'Unexpected authenticated redirect')
    const text=(await tab.page.locator('body').innerText()).trim()
    assert.ok(text.length>20,'Blank authenticated page')
    assert.doesNotMatch(text,/Application error: a server-side exception|Worker exceeded resource limits/i)
    results.push({session:tab.index,role:tab.role.name,status:response.status(),navigationMs:Date.now()-started})
    console.log('MAIN_CONCURRENCY_OPEN '+tab.index+' '+tab.role.name+' HTTP '+response.status())
   }catch(error){
    failures.push({session:tab.index,role:tab.role.name,type:'navigation',message:scrub(error)})
   }
   await sleep(350)
  }
 }))
 assert.equal(results.length,TARGET_SESSIONS,'Not all 30 active browser sessions reached a real protected page')
 console.log('MAIN_CONCURRENCY_ACTIVE sessions='+tabs.length+' identities='+roles.length+' hold_ms='+HOLD_MS)
 await sleep(HOLD_MS)
 for(const tab of tabs)
  if(tab.page.isClosed())failures.push({session:tab.index,role:tab.role.name,type:'unexpected_tab_close'})
} catch(error){
 failures.push({type:'test_setup_or_execution',message:scrub(error)})
} finally {
 for(const context of contexts)await context.close().catch(()=>{})
 await browser.close().catch(()=>{})
 const summary={
  target:BASE,kind:'bounded_main_only_30_browser_tabs',uniqueQaIdentities:roles.length,
  targetSessions:TARGET_SESSIONS,openedSessions:results.length,holdMs:HOLD_MS,
  durationMs:Date.now()-startup,successfulNavigations:results.length,
  http5xx:fiveHundreds.length,failures:failures.length,
  limitations:'Seven QA identities are reused across 30 simultaneously active browser tabs. This is not a 30-distinct-user load test, a pentest, a production guarantee, or proof that delayed Cloudflare analytics contain zero failures.',
  results,serverFailures:fiveHundreds,errors:failures,
 }
 await writeFile(reportDir+'/report.json',JSON.stringify(summary,null,2)+'\n')
 console.log('MAIN_30_SESSION_RESULT '+JSON.stringify({
  sessions:summary.openedSessions,identities:summary.uniqueQaIdentities,http5xx:summary.http5xx,failures:summary.failures,
 }))
 if(failures.length||fiveHundreds.length||results.length!==TARGET_SESSIONS)process.exitCode=1
}
