// Authoritative Main-versus-Vite deep-route acceptance, using ONLY the seven
// pre-existing isolated QA identities. This pass now compares 44 routes;
// it still does NOT claim all 81 application screens or all workflow states.
// Read-only navigation; no form submission
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
  '/admin/management','/admin/time-records','/admin','/admin/health','/admin/platform',
  '/events','/inventory','/portals/administration/modules/invoices',
  '/portals/administration/modules/banking','/portals/administration/modules/ticketing']},
 {role:'left_hand',portal:'administration',email:'e2e-admin@uptilldawn.test',paths:[
  '/portals/administration/rosters','/portals/administration/modules/contracts',
  '/portals/administration/overview','/portals/administration/modules/events']},
 {role:'right_hand',portal:'administration',email:'e2e-right-hand@uptilldawn.test',paths:[
  '/portals/administration/personnel','/portals/administration/modules/inventory',
  '/portals/administration/modules/documents','/portals/administration/modules/staff']},
 {role:'administration',portal:'administration',email:'e2e-administration@uptilldawn.test',paths:[
  '/portals/administration/finance','/portals/administration/modules/artists',
  '/portals/administration/modules/invoices','/portals/administration/timesheets',
  '/portals/administration/modules/tasks','/portals/administration/modules/automations',
  '/portals/administration/modules/reports','/portals/administration/modules/settings']},
 {role:'responsible',portal:'responsible',email:'e2e-responsible@uptilldawn.test',paths:[
  '/workplaces','/shifts','/briefings','/crew','/help','/incidents','/timesheets']},
 {role:'staff',portal:'staff',email:'e2e-staff@uptilldawn.test',paths:[
  '/tasks','/timesheets','/notifications','/events','/settings','/sync','/briefings']},
 {role:'promotion',portal:'promotion',email:'e2e-promotion@uptilldawn.test',paths:[
  '/portals/promotion/tasks','/portals/promotion/chats','/portals/promotion/notifications',
  '/portals/promotion/staff']},
]
const EXPECTED=cases.reduce((n,c)=>n+c.paths.length,0)
if(cases.length!==7||EXPECTED!==44)throw Error('DEEP_PARITY_COVERAGE_CHANGED')
const reportDir=resolve(import.meta.dirname,'../../test-results/modern-deep-route-parity')
const clean=value=>(value||'').replace(/\s+/g,' ').replace(/\b\d+\b/g,'#').trim()

let legacyRecoveries=0
async function navigateOriginalWithRecovery(page,path){
 // The original Next SSR GET can transiently fail while Main-QA is healthy.
 // Only recover an idempotent source navigation, with bounded cooling.
 for(let attempt=0;attempt<3;attempt++){
  const response=await page.goto(original+path,{waitUntil:'domcontentloaded',timeout:30000})
  const status=response?.status()
  if(status!==502&&status!==503&&status!==504)return response
  if(attempt===2)return response
  await page.waitForTimeout((attempt+1)*2000)
  console.warn('DEEP_PARITY_SOURCE_RECOVERY '+path+' '+status+' attempt='+String(attempt+1))
  legacyRecoveries++
 }
 throw Error('DEEP_PARITY_SOURCE_NAVIGATION_INCOMPLETE')
}

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
  // Detect silent visual regressions that a matching heading/button list
  // cannot: actual original header, navigation, content and typography boxes.
  // Round to 2 CSS pixels to avoid browser fractional-pixel artifacts.
  const round=x=>Math.round(x/2)*2
  const layout=list('header,nav,main,main h1,main h2',e=>{
   const r=e.getBoundingClientRect(),s=getComputedStyle(e)
   return {tag:e.tagName,x:round(r.x),y:round(r.y),w:round(r.width),h:round(r.height),
    font:s.fontSize,weight:s.fontWeight,color:s.color,background:s.backgroundColor}
  })
  return {
   path:location.pathname,
   layout,
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
 // Avoid comparing original SSR and SPA mid-font-swap or first paint.
 await Promise.all([a,b].map(page=>page.evaluate(async()=>{
  await document.fonts.ready
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))
 })))
 let expected=await view(a),actual=await view(b)
 const deadline=Date.now()+10000
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
 if(fields.includes('layout')){
  // Diagnostic deliberately emits CSS geometry only: no document text,
  // cookies, account identifiers, token-bearing URLs or finance content.
  const differences=[]
  for(let i=0;i<Math.max(expected.layout.length,actual.layout.length)&&differences.length<8;i++){
   const source=expected.layout[i],candidate=actual.layout[i]
   if(JSON.stringify(source)!==JSON.stringify(candidate))
    differences.push({index:i,original:source&&{tag:source.tag,x:source.x,y:source.y,w:source.w,h:source.h,font:source.font,weight:source.weight},candidate:candidate&&{tag:candidate.tag,x:candidate.x,y:candidate.y,w:candidate.w,h:candidate.h,font:candidate.font,weight:candidate.weight}})
  }
  console.error('DEEP_PARITY_LAYOUT_GEOMETRY '+label+' '+JSON.stringify(differences))
 }
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
   // Reuse source and candidate pages for ordinary navigation to keep
   // Cloudflare Free load low. A conditional Next redirect may still be in
   // flight after React hydration, so give THAT route its own disposable
   // documents rather than letting it interrupt the next /timesheets visit.
   const sharedSource=await sourceContext.newPage(),sharedCandidate=await modernContext.newPage()
   for(const path of role.paths){
    const name=role.role+'-'+path
    const redirectsConditionally=path==='/incidents'
    const a=redirectsConditionally?await sourceContext.newPage():sharedSource
    const b=redirectsConditionally?await modernContext.newPage():sharedCandidate
    let stage='original-navigation'
    const failedReadStatuses=[]
    const onCandidateResponse=response=>{
     if(new URL(response.url()).pathname==='/api/migration/view-data'&&
        response.status()>=500)failedReadStatuses.push(response.status())
    }
    b.on('response',onCandidateResponse)
    try{
     const baseline=await navigateOriginalWithRecovery(a,path)
     if(baseline?.status()!==200&&baseline?.status()!==304)
      throw Error('LEGACY_MAIN_HTTP_'+baseline?.status())
     // Legacy /shifts is always an authenticated alias to /workplaces.
     if(path==='/shifts'){
      stage='original-shifts-redirect'
      await a.waitForURL(url=>url.pathname==='/workplaces',{timeout:9000})
     }
     // The original /incidents page sends responsible/staff to /events
     // when no current work context or active shift exists. It can first
     // stream a blank Next shell. Require either the rendered incident
     // heading or the actual authorized redirect before taking a baseline.
     if(path==='/incidents'){
      stage='original-incidents-settle'
      await a.waitForFunction(()=>location.pathname==='/events'||
       (location.pathname==='/incidents'&&!!document.querySelector('main h1')),
       null,{timeout:18000})
      const settled=new URL(a.url()).pathname
      if(settled!=='/incidents'&&settled!=='/events')
       throw Error('UNEXPECTED_ORIGINAL_INCIDENT_REDIRECT')
     }
     stage='original-readiness'
     try{await ready(a)}catch(error){
      // An observed conditional redirect is not passing evidence unless its
      // destination renders. Re-attempt the original route once, never skip
      // the route or replace the candidate's required redirect.
      if(path!=='/incidents'||error?.name!=='TimeoutError'||new URL(a.url()).pathname!=='/events')throw error
      legacyRecoveries++
      console.warn('DEEP_PARITY_SOURCE_REDIRECT_READINESS_RECOVERY '+path)
      await a.waitForTimeout(2000)
      const retry=await navigateOriginalWithRecovery(a,path)
      if(retry?.status()!==200&&retry?.status()!==304)throw Error('LEGACY_MAIN_HTTP_'+retry?.status())
      await a.waitForFunction(()=>location.pathname==='/events'||(location.pathname==='/incidents'&&!!document.querySelector('main h1')),null,{timeout:18000})
      await ready(a)
     }
     const expectedPath=new URL(a.url()).pathname
     stage='candidate-navigation'
     await b.goto(modern+path,{waitUntil:'domcontentloaded',timeout:20000})
     // If the original page has redirected, the candidate MUST navigate
     // to the SAME final location. Never count a missing/blank redirect
     // or an unhydrated root as a passing screen.
     if(expectedPath!==path){
      stage='candidate-redirect'
      await b.waitForURL(url=>url.pathname===expectedPath,{timeout:12000})
     }
     stage='candidate-readiness'
     await ready(b)
     stage='compare-original'
     await matching(a,b,name)
     validated++
     console.log('DEEP_PARITY_PASS '+name)
    }catch(error){
     // Report ALL independent failures in a single QA run, without leaking
     // response bodies, profile/incident data or credential-bearing URLs.
     const message=error instanceof Error?error.message.split('\n')[0]:'unknown'
     const knownError=/^(?:DEEP_PARITY_MISMATCH .*|DEEP_PARITY_RENDER_ERROR|LEGACY_MAIN_HTTP_\d+|UNEXPECTED_ORIGINAL_INCIDENT_REDIRECT)$/
     const reason=(knownError.test(message)?message:
      'DEEP_PARITY_ROUTE_INCOMPLETE '+stage+' '+(error instanceof Error?error.name:'Error'))+
      (failedReadStatuses.length?' bridgeRead5xx='+failedReadStatuses.join(','):'')
     const sourcePath=new URL(a.url()).pathname,candidatePath=new URL(b.url()).pathname
     mismatches.push({route:name,reason,sourcePath,candidatePath})
     console.error('DEEP_PARITY_ROUTE_FAILED '+name+' '+reason+
      ' originalPath='+sourcePath+' candidatePath='+candidatePath)
    }finally{
     b.off('response',onCandidateResponse)
     if(redirectsConditionally){
      await a.close()
      await b.close()
     }
     // Do not pile dozens of expensive legacy SSR reads onto Cloudflare Free.
     await new Promise(resolve=>setTimeout(resolve,450))
    }
   }
   await sharedSource.close()
   await sharedCandidate.close()
  }catch(error){
   // Keep a failed login/role visible without preventing independent roles
   // from producing evidence. Do not emit credentials or raw browser errors.
   const reason='DEEP_PARITY_ROLE_INCOMPLETE '+(error instanceof Error?error.name:'Error')
   mismatches.push({route:role.role,reason})
   console.error('DEEP_PARITY_ROLE_FAILED '+role.role+' '+reason)
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
  deepRouteSourceControlComparisons:validated,authenticatedRoles:signins,legacyMainReadRecoveries:legacyRecoveries,
  comparedAgainstRealMain:true,writeActionsSubmitted:0,
  fullFunctionalParityVerified:false,mainCutoverAllowed:false,productionReady:false
 }))
}finally{await browser.close()}
