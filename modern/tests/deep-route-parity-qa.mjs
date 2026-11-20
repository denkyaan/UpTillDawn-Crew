// Authoritative Main-versus-Vite deep-route acceptance, using ONLY the seven
// pre-existing isolated QA identities. Read-only navigation; no form submission
// or business write. Intentionally does NOT claim complete 1:1 action parity.
import {chromium} from 'playwright'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'

const original='https://uptilldawn-main.uptilldawn.workers.dev'
const modern='https://uptilldawn-modern-main.uptilldawn.workers.dev'
const database='https://npbjrtiolqperdgljnhi.supabase.co'
const qa=new URL(process.env.E2E_MAIN_QA_BASE_URL||'')
const password=process.env.E2E_MAIN_QA_PASSWORD||''
if(qa.origin!==database||qa.pathname!=='/'||qa.search||qa.hash)
 throw Error('DEEP_PARITY_QA_DATABASE_REQUIRED')
if(process.env.E2E_MAIN_MODERN_QA_ORIGIN!==modern)
 throw Error('DEEP_PARITY_QA_WORKER_REQUIRED')
if(password.length<24||process.env.VITE_MIGRATION_ALLOW_WRITES!=='false')
 throw Error('DEEP_PARITY_READ_ONLY_QA_REQUIRED')

const cases=[
 {role:'head_admin',portal:'admin',email:'e2e-head-admin@uptilldawn.test',paths:[
  '/admin/management','/admin/time-records','/portals/administration/modules/invoices',
  '/portals/administration/modules/banking','/portals/administration/modules/ticketing']},
 {role:'left_hand',portal:'administration',email:'e2e-admin@uptilldawn.test',paths:[
  '/portals/administration/rosters','/portals/administration/modules/contracts']},
 {role:'right_hand',portal:'administration',email:'e2e-right-hand@uptilldawn.test',paths:[
  '/portals/administration/personnel','/portals/administration/modules/inventory']},
 {role:'administration',portal:'administration',email:'e2e-administration@uptilldawn.test',paths:[
  '/portals/administration/finance','/portals/administration/modules/artists',
  '/portals/administration/modules/invoices','/portals/administration/timesheets']},
 {role:'responsible',portal:'responsible',email:'e2e-responsible@uptilldawn.test',paths:[
  '/workplaces','/shifts','/briefings']},
 {role:'staff',portal:'staff',email:'e2e-staff@uptilldawn.test',paths:[
  '/tasks','/timesheets','/notifications']},
 {role:'promotion',portal:'promotion',email:'e2e-promotion@uptilldawn.test',paths:[
  '/portals/promotion/tasks','/portals/promotion/chats','/portals/promotion/notifications']},
]
const EXPECTED=cases.reduce((n,c)=>n+c.paths.length,0)
if(cases.length!==7||EXPECTED!==22)throw Error('DEEP_PARITY_COVERAGE_CHANGED')
const reportDir=resolve(import.meta.dirname,'../../test-results/modern-deep-route-parity')
const clean=value=>(value||'').replace(/\s+/g,' ').replace(/\b\d+\b/g,'#').trim()

async function ready(page){
 await page.waitForFunction(()=>{
  const path=location.pathname
  if(/^\/(?:unauthorized|disabled|pending-approval|login)(?:\/|$)/.test(path))
   return !!document.querySelector('h1,[role="alert"]')
  return !!document.querySelector('[data-app-shell-ready="true"]')
 },null,{timeout:18000})
 if(!/^\/(?:unauthorized|disabled|pending-approval|login)(?:\/|$)/.test(new URL(page.url()).pathname)){
  await page.locator('[data-route-loading="true"]').waitFor({state:'detached',timeout:12000})
  await page.waitForFunction(()=>{
   const main=document.querySelector('main')
   return main&&main.getBoundingClientRect().height>0
  },null,{timeout:12000})
 }
 if(await page.locator('[data-app-error="true"]').count())
  throw Error('DEEP_PARITY_RENDER_ERROR')
}
async function view(page){
 return page.evaluate(()=>{
  const clean=value=>(value||'').replace(/\s+/g,' ').replace(/\b\d+\b/g,'#').trim()
  const visible=e=>{
   const r=e.getBoundingClientRect(),style=getComputedStyle(e)
   return r.height>0&&r.width>0&&style.display!=='none'&&style.visibility!=='hidden'
  }
  const list=(selector,mapper)=>[...document.querySelectorAll(selector)].filter(visible).map(mapper)
  const label=e=>clean(e.getAttribute('aria-label')||e.textContent)
  return {
   path:location.pathname,
   headings:list('main h1,main h2',label),
   navigation:list('nav a,nav button,header a,header button',e=>({
    tag:e.tagName,label:label(e),href:e.getAttribute('href'),expanded:e.getAttribute('aria-expanded')
   })),
   fields:list('main input,main select,main textarea',e=>({
    tag:e.tagName,name:e.getAttribute('name'),type:e.getAttribute('type'),
    required:e.required,disabled:e.disabled
   })).filter(e=>!(e.name||'').startsWith('$ACTION')),
   controls:list('main button,main [role="button"],main a[href]',e=>({
    tag:e.tagName,label:label(e),type:e.getAttribute('type'),
    href:e.getAttribute('href'),disabled:e.disabled||e.getAttribute('aria-disabled')==='true'
   }))
  }
 })
}
async function matching(a,b,label){
 let expected=await view(a),actual=await view(b)
 const deadline=Date.now()+6000
 while(JSON.stringify(expected)!==JSON.stringify(actual)&&Date.now()<deadline){
  await b.waitForTimeout(300)
  expected=await view(a);actual=await view(b)
 }
 if(JSON.stringify(expected)===JSON.stringify(actual))return
 await mkdir(reportDir,{recursive:true})
 const safe=label.replace(/[^a-z0-9_-]/gi,'-')
 await a.screenshot({path:resolve(reportDir,safe+'-original.png'),fullPage:true,animations:'disabled'})
 await b.screenshot({path:resolve(reportDir,safe+'-modern.png'),fullPage:true,animations:'disabled'})
 const fields=Object.keys(expected).filter(k=>JSON.stringify(expected[k])!==JSON.stringify(actual[k]))
 // Only field names and route identities are logged: never leak profile data.
 console.error('DEEP_PARITY_DIFFERENCE '+label+' '+fields.join(',')+' originalPath='+new URL(a.url()).pathname+' candidatePath='+new URL(b.url()).pathname)
 throw Error('DEEP_PARITY_MISMATCH '+label+' '+fields.join(','))
}

const browser=await chromium.launch({headless:true})
let validated=0,signins=0
const mismatches=[]
try{
 for(const role of cases){
  const context=await browser.newContext({locale:'nl-BE',viewport:{width:1440,height:900}})
  let sourceContext,modernContext
  try{
   const login=await context.newPage()
   let native=false
   login.on('response',response=>{
    if(new URL(response.url()).pathname==='/api/auth/portal-login')
     native=response.status()===200&&response.headers()['x-uptilldawn-auth-runtime']==='native-original-source'
   })
   await login.goto(modern+'/login/'+role.portal,{waitUntil:'domcontentloaded',timeout:20000})
   await login.locator('input[name="email"]').fill(role.email)
   await login.locator('input[name="password"]').fill(password)
   await login.locator('form button[type="submit"]').click()
   // A login form already contains an h1. That is NOT an authenticated
   // destination: wait for a real role-based redirect, then hydration.
   await login.waitForURL(url=>!url.pathname.startsWith('/login'),{timeout:25000})
   await ready(login)
   if(!native)throw Error('DEEP_PARITY_NATIVE_LOGIN_FAILED '+role.role)
   signins++
   const session=await context.storageState()
   const originalCookies=session.cookies.map(cookie=>({
    ...cookie,domain:new URL(original).hostname,secure:true
   }))
   sourceContext=await browser.newContext({locale:'nl-BE',viewport:{width:1440,height:900},
    storageState:{cookies:originalCookies,origins:[]}})
   modernContext=await browser.newContext({locale:'nl-BE',viewport:{width:1440,height:900},
    storageState:session})
   const a=await sourceContext.newPage(),b=await modernContext.newPage()
   for(const path of role.paths){
    const name=role.role+'-'+path
    // One original SSR request and one candidate SPA request per route.
    // Never synthesize focus/chat refreshes, poll networkidle or retry mutations.
    await a.goto(original+path,{waitUntil:'domcontentloaded',timeout:30000})
    await ready(a)
    await b.goto(modern+path,{waitUntil:'domcontentloaded',timeout:20000})
    // If original Next performed an authenticated redirect, require the
    // candidate to reach that same URL before comparing UI controls. A
    // suspended client navigation is not an accepted alternate route.
    const expectedPath=new URL(a.url()).pathname
    if(expectedPath!==path)
     await b.waitForURL(url=>url.pathname===expectedPath,{timeout:9000})
    await ready(b)
    try{
     await matching(a,b,name)
     validated++
     console.log('DEEP_PARITY_PASS '+name)
    }catch(error){
     // A UI/path mismatch must fail the release, but should not hide the
     // remaining independent QA routes. Collect all safe path/field names
     // in a single run to prevent serial fix-and-redeploy cycles.
     if(!(error instanceof Error)||!error.message.startsWith('DEEP_PARITY_MISMATCH '))throw error
     mismatches.push({route:name,reason:error.message})
     console.error('DEEP_PARITY_ROUTE_FAILED '+name+' '+error.message)
    }
   }
  }finally{
   await sourceContext?.close()
   await modernContext?.close()
   await context.close()
  }
 }
 if(mismatches.length){
  console.error('DEEP_PARITY_ALL_MISMATCHES '+JSON.stringify(mismatches))
  throw Error('DEEP_PARITY_MISMATCHES '+mismatches.length+' — cutover blocked')
 }
 if(signins!==7||validated!==EXPECTED)throw Error('DEEP_PARITY_INCOMPLETE')
 console.log(JSON.stringify({
  deepRouteSourceControlComparisons:validated,authenticatedRoles:signins,
  comparedAgainstRealMain:true,writeActionsSubmitted:0,
  fullFunctionalParityVerified:false,mainCutoverAllowed:false,productionReady:false
 }))
}finally{await browser.close()}
