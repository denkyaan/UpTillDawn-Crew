// Local browser parity, using the actual Next source and built Vite UI.
// The test-only read adapter invokes real native handlers with freshly
// verified signed local cookies. It is NOT a deployed Worker or auth test.
// No remote endpoint or production credentials, no public write enablement.
import assert from 'node:assert/strict'
import {spawn,execFileSync} from 'node:child_process'
import {resolve} from 'node:path'
import {runRolePool,verifyExactCoverage} from './qa-role-pool.mjs'
import {withDeadline} from './qa-browser-deadline.mjs'
import {mkdirSync,writeFileSync} from 'node:fs'
import {chromium} from 'playwright'
import {createServerClient,parseCookieHeader} from '@supabase/ssr'
import {parseIdentity,isActive} from '../src/shared/identity.ts'
import {nativeOriginalViewData} from '../src/api/native-original-view-data.ts'
import {pushConfigResponse} from '../src/api/native-main-reads.ts'
import {nativePortalSwitchResponse} from '../src/api/native-standalone-routes.ts'
import {makerReadResponse} from '../src/api/native-maker-reads.ts'
const root=resolve(import.meta.dirname,'../..'),source='http://127.0.0.1:3000',candidate='http://127.0.0.1:4176',dbUrl='http://127.0.0.1:54321'
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'',password=process.env.BOT_TEST_PASSWORD||''
assert.equal(process.env.BOT_SUPABASE_URL,dbUrl)
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,dbUrl)
assert.equal(process.env.VITE_SUPABASE_URL,dbUrl)
assert.equal(process.env.VITE_SUPABASE_ANON_KEY,key)
assert.equal(process.env.VITE_MIGRATION_ALLOW_WRITES,'false')
assert.equal(process.env.NEXT_PUBLIC_APP_URL,source)
assert.ok(key&&key!==process.env.BOT_SERVICE_ROLE_KEY&&password.length>=24)
const cases=[
 {role:'head_admin',portal:'admin',email:'bot-01-admin-nl@bots.uptilldawn.test',paths:[
  '/admin/management','/admin/time-records','/admin','/admin/health','/admin/platform',
  '/events','/inventory','/portals/administration/modules/invoices',
  '/portals/administration/modules/banking','/portals/administration/modules/ticketing']},
 {role:'left_hand',portal:'administration',email:'bot-06-staff-fr@bots.uptilldawn.test',paths:[
  '/portals/administration/rosters','/portals/administration/modules/contracts',
  '/portals/administration/overview','/portals/administration/modules/events']},
 {role:'right_hand',portal:'administration',email:'bot-07-staff-en@bots.uptilldawn.test',paths:[
  '/portals/administration/personnel','/portals/administration/modules/inventory',
  '/portals/administration/modules/documents','/portals/administration/modules/staff']},
 {role:'administration',portal:'administration',email:'bot-04-staff-de@bots.uptilldawn.test',paths:[
  '/portals/administration/finance','/portals/administration/modules/artists',
  '/portals/administration/modules/invoices','/portals/administration/timesheets',
  '/portals/administration/modules/tasks','/portals/administration/modules/automations',
  '/portals/administration/modules/reports','/portals/administration/modules/settings']},
 {role:'responsible',portal:'responsible',email:'bot-02-responsible-fr@bots.uptilldawn.test',paths:[
  '/workplaces','/shifts','/briefings','/crew','/help','/incidents','/timesheets']},
 {role:'staff',portal:'staff',email:'bot-03-staff-en@bots.uptilldawn.test',paths:[
  '/tasks','/timesheets','/notifications','/events','/settings','/sync','/briefings']},
 {role:'promotion',portal:'promotion',email:'bot-05-staff-nl@bots.uptilldawn.test',paths:[
  '/portals/promotion/tasks','/portals/promotion/chats','/portals/promotion/notifications',
  '/portals/promotion/staff']},
]

assert.equal(cases.length,7)
assert.equal(cases.reduce((n,c)=>n+c.paths.length,0),44)
const devices=[{name:'desktop',viewport:{width:1440,height:900}},{name:'mobile',viewport:{width:390,height:844},isMobile:true,hasTouch:true}]
const locales=['nl','fr','en','de']
const rows=[],failures=[],loginChecks=[],blockedRoutes=new Set()
const maker={role:'maker',portal:'admin',email:'bot-16-maker@bots.uptilldawn.test',paths:[]}
const allRoles=[...cases,maker]
const parallelism=Number(process.env.UPT_LOCAL_BROWSER_PARALLELISM||'3')
assert.ok(Number.isInteger(parallelism)&&parallelism>=1&&parallelism<=3,'LOCAL_BROWSER_PARALLELISM_RANGE')
assert.equal(new Set(allRoles.map(r=>r.email)).size,8,'EACH_ROLE_REQUIRES_DISTINCT_ACCOUNT')
const scenarioKey=x=>[x.role,x.kind,x.language,x.device,x.kind==='landing'?'landing':x.path].join('|')
const planned=allRoles.flatMap(role=>role.role==='maker'?devices.map(d=>scenarioKey({role:role.role,kind:'maker-choice',language:'nl',device:d.name,path:'/maker-mode'})):[...locales.flatMap(language=>devices.map(d=>scenarioKey({role:role.role,kind:'landing',language,device:d.name}))),...devices.flatMap(d=>role.paths.map(path=>scenarioKey({role:role.role,kind:'deep',language:'nl',device:d.name,path})))])
const plannedLogins=allRoles.flatMap(r=>['browser-form','original-http-session'].map(kind=>r.role+'|'+kind))
assert.equal(planned.length,146);assert.equal(new Set(planned).size,146)
const reportDir=resolve(root,'test-results/phase-two-three-local-native')
mkdirSync(reportDir,{recursive:true})
const binding={validatedSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runId:process.env.GITHUB_RUN_ID||null,runAttempt:process.env.GITHUB_RUN_ATTEMPT||null}
const preview=spawn(process.execPath,[resolve(root,'modern/node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4176','--strictPort'],{cwd:resolve(root,'modern'),stdio:'ignore'})
let browser
const fetchBefore=globalThis.fetch
const activeStages=new Map()
const limit=(label,fn,ms=10000)=>withDeadline(label,fn,ms)
const stage=(role,name)=>{activeStages.set(role,name);console.log('LOCAL_BROWSER_STAGE '+role+' '+name)}
const closeContext=context=>limit('CONTEXT_CLOSE',()=>context.close(),5000)
const newContext=options=>limit('CONTEXT_CREATE',()=>browser.newContext(options),10000)
const newPage=context=>limit('PAGE_CREATE',()=>context.newPage(),10000)
// All native server-side read handlers are network-isolated too.
globalThis.fetch=(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input))
 if(![source,candidate,dbUrl].includes(url.origin))throw Error('NONLOCAL_NETWORK_BLOCKED')
 const callerSignal=init?.signal||(input instanceof Request?input.signal:null)
 const timeout=AbortSignal.timeout(8000)
 return fetchBefore(input,{...init,signal:callerSignal?AbortSignal.any([callerSignal,timeout]):timeout,redirect:'error'})
}
const deny=(status=503)=>Response.json({error:'local_read_adapter_unavailable'},{status})
async function readAdapter(request){
 const url=new URL(request.url),cookie=request.headers.get('cookie')||''
 const jar=new Map(parseCookieHeader(cookie).map(x=>[x.name,x.value||'']))
 const db=createServerClient(dbUrl,key,{cookies:{getAll:()=>Array.from(jar,([name,value])=>({name,value})),setAll:changes=>{for(const x of changes)jar.set(x.name,x.value)}}})
 const {data:{user},error:ue}=await db.auth.getUser()
 const {data,error}=await db.rpc('upt_current_session_context')
 const identity=parseIdentity(Array.isArray(data)?data[0]:null)
 if(ue||error||!user||!identity||identity.id!==user.id||!isActive(identity))return deny(401)
 if(request.method==='POST'&&url.pathname==='/api/migration/view-data')return nativeOriginalViewData(db,identity,request,cookie,{})
 if(request.method==='GET'&&url.pathname==='/api/push/config')return pushConfigResponse(db)
 if(request.method==='GET'&&url.pathname.startsWith('/portals/switch/'))return nativePortalSwitchResponse(db,identity,request,url.pathname.split('/').at(-1))
 if(request.method==='GET'&&['/api/god/automation-rules','/api/god/preview-role','/api/god/rules','/api/god/data','/api/god/error-reports'].includes(url.pathname))return makerReadResponse(db,request,cookie,url.pathname)
 // Unimplemented local routes remain explicitly blocked. Never forward
 // to the original or remote Worker, never return invented success.
 blockedRoutes.add(request.method+' '+url.pathname)
 return deny()
}
async function protect(context,which){
 await context.route('**/*',async route=>{
  const incoming=route.request(),url=new URL(incoming.url())
  if(url.origin===dbUrl)return route.continue()
  if(url.origin!==which)return route.abort('blockedbyclient')
  if(which!==candidate||!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/portals/switch/'))return route.continue()
  try{
   const headers=await limit('ROUTE_HEADERS',()=>incoming.allHeaders(),4000)
   const options={method:incoming.method(),headers}
   if(!['GET','HEAD'].includes(options.method))options.body=incoming.postDataBuffer()||undefined
   const response=await limit('SIGNED_READ_ADAPTER',()=>readAdapter(new Request(incoming.url(),options)),12000)
   // Keep real statuses and redirect locations, never source-fallback.
   await limit('ROUTE_FULFILL',async()=>route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())}),5000)
  }catch{await limit('ROUTE_FAILURE_RESPONSE',()=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"local_read_adapter_failed"}'}),3000).catch(()=>route.abort('failed').catch(()=>{}))}
 })
}
// Do not wait on animation frames or unbounded font promises in background
// browser tabs. Timer polling and independent Node deadlines also protect
// against a nonresponsive browser process. Every timeout remains a failure.
async function ready(page,language){
 const timeout=12000
 await limit('APP_READINESS',()=>page.waitForFunction(()=>{
  if(/^\/(?:login|unauthorized|pending-approval|disabled)(?:\/|$)/.test(location.pathname)||document.querySelector('[data-app-error="true"]'))return true
  if(location.pathname==='/maker-mode')return !!document.querySelector('main h1, h1')
  return !!document.querySelector('[data-app-shell-ready="true"]')&&!document.querySelector('[data-route-loading="true"]')&&!!document.querySelector('main')
 },null,{timeout,polling:150}),timeout+1000)
 assert.ok(!/^\/(?:login|unauthorized|pending-approval|disabled)(?:\/|$)/.test(new URL(page.url()).pathname),'UNEXPECTED_AUTH_REDIRECT')
 assert.equal(await limit('APP_ERROR_CHECK',()=>page.locator('[data-app-error="true"]').count(),3000),0,'APP_RENDER_ERROR')
 await limit('LOCALE_READINESS',()=>page.waitForFunction(lang=>document.documentElement.lang.split('-')[0]===lang,language,{timeout:6000,polling:150}),7000)
 await limit('FONT_READINESS',()=>page.waitForFunction(()=>document.fonts.status==='loaded',null,{timeout:4000,polling:150}),5000)
}
async function view(page){
 return limit('VIEW_FINGERPRINT',()=>page.evaluate(()=>{
  const clean=value=>(value||'').replace(/\s+/g,' ').replace(/\b\d+\b/g,'#').trim()
  const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'}
  const list=(selector,fn)=>[...document.querySelectorAll(selector)].filter(visible).map(fn)
  const label=e=>clean(e.getAttribute('aria-label')||e.textContent)
  const control=e=>({tag:e.tagName,label:label(e),href:e.getAttribute('href'),disabled:e.disabled||e.getAttribute('aria-disabled')==='true',expanded:e.getAttribute('aria-expanded')})
  return {path:location.pathname,headings:list('main h1,main h2',label),nav:list('nav a,nav button,header a,header button',control),controls:list('main a[href],main button,main [role="button"]',control),
   fields:list('main input,main textarea,main select',e=>({tag:e.tagName,name:e.getAttribute('name'),type:e.getAttribute('type'),required:e.required,disabled:e.disabled})).filter(e=>!(e.name||'').startsWith('$ACTION')),
   layout:list('header,nav,main,main h1,main h2',e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);const round=n=>Math.round(n/2)*2;return {tag:e.tagName,x:round(r.x),y:round(r.y),w:round(r.width),h:round(r.height),font:s.fontSize,color:s.color,background:s.backgroundColor}})}
 }),5000)
}
function record(meta,error){
 if(error){
  // Only controlled stage names, not raw browser messages, tokens or URLs.
  const reason=String(error?.message||'FAILED').split('\n')[0]
  const safe=/^(?:PARITY_MISMATCH|UNEXPECTED_AUTH_REDIRECT|APP_RENDER_ERROR|SOURCE_HTTP|CANDIDATE_HTTP|SOURCE_LOGIN|DEADLINE_|BROWSER_JS_ERROR|NO_MOBILE_OVERFLOW|MISSING_CONTROL|LOCALE_|UNEXPECTED_ROUTE)/.test(reason)?reason.slice(0,160):String(error?.name||'Error')
  failures.push({...meta,reason:safe});console.error('LOCAL_BROWSER_FAIL '+JSON.stringify({...meta,reason:safe}))
 }else{rows.push(meta);console.log('LOCAL_BROWSER_PASS '+JSON.stringify(meta))}
 writeReport()
}
async function compare(a,b,path,meta){
 stage(meta.role,'compare:'+meta.kind+':'+meta.language+':'+meta.device+':'+path)
 let phase='source'
 try{
  const ra=await a.goto(source+path,{waitUntil:'domcontentloaded',timeout:30000})
  if(!ra||ra.status()>=400)throw Error('SOURCE_HTTP_'+ra?.status())
  await ready(a,meta.language)
  const finalPath=new URL(a.url()).pathname
  // Only the known shifts alias and conditional incident routing may
  // settle on a different authorized route in this matrix.
  if(finalPath!==path&&!(path==='/shifts'&&finalPath==='/workplaces')&&!(path==='/incidents'&&finalPath==='/events'))throw Error('UNEXPECTED_ROUTE_SOURCE')
  phase='candidate'
  const rb=await b.goto(candidate+path,{waitUntil:'domcontentloaded',timeout:30000})
  if(!rb||rb.status()>=400)throw Error('CANDIDATE_HTTP_'+rb?.status())
  if(finalPath!==path)await b.waitForURL(u=>u.pathname===finalPath,{timeout:12000})
  await ready(b,meta.language)
  phase='comparison'
  let expected=await view(a),actual=await view(b),deadline=Date.now()+10000
  while(JSON.stringify(expected)!==JSON.stringify(actual)&&Date.now()<deadline){
   await new Promise(r=>setTimeout(r,300));expected=await view(a);actual=await view(b)
  }
  const diff=Object.keys(expected).filter(k=>JSON.stringify(expected[k])!==JSON.stringify(actual[k]))
  if(diff.length)throw Error('PARITY_MISMATCH '+diff.join(','))
  if(meta.device==='mobile')for(const page of [a,b])if(await limit('MOBILE_OVERFLOW',()=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth>4),4000))throw Error('NO_MOBILE_OVERFLOW')
  if(!expected.headings.length&&!expected.controls.length)throw Error('MISSING_CONTROL')
  record(meta)
 }catch(error){record({...meta,stage:phase},error)}
}
// Verify the real original login HTTP transport independently of the browser
// click. Both use the production application's normal signIn implementation.
// A broken browser login remains a hard failure, but cannot hide all of the
// authenticated UI differences behind one common setup failure.
function safeLoginCode(value){
 return typeof value==='string'&&/^[a-z_]{1,80}$/.test(value)?value:'unknown'
}
function checkedLogin(body){
 if(body?.success!==true||typeof body.redirectTo!=='string'||
    !body.redirectTo.startsWith('/')||body.redirectTo.startsWith('//')||
    body.redirectTo.includes('\\')||/^\/(?:login|pending-approval|unauthorized|disabled)(?:\/|$)/.test(body.redirectTo))
  throw Error('SOURCE_LOGIN_RESULT_'+safeLoginCode(body?.code))
 return new URL(body.redirectTo,source)
}
async function verifyCookieIdentity(context,role){
 const cookies=await limit('SESSION_COOKIES',()=>context.cookies(source),5000)
 assert.ok(cookies.some(c=>/^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i.test(c.name)&&c.value),'SOURCE_LOGIN_COOKIE_MISSING')
 const db=createServerClient(dbUrl,key,{cookies:{getAll:()=>cookies.map(({name,value})=>({name,value})),setAll:()=>{}}})
 const {data:{user},error}=await db.auth.getUser()
 if(error||!user||user.email!==role.email)throw Error('SOURCE_LOGIN_SIGNED_IDENTITY_MISMATCH')
 const {data,error:contextError}=await db.rpc('upt_current_session_context')
 const identity=parseIdentity(Array.isArray(data)?data[0]:null)
 if(contextError||!identity||identity.id!==user.id||!isActive(identity))throw Error('SOURCE_LOGIN_ROLE_CONTEXT_DENIED')
 if(identity.is_owner!==(role.role==='maker'))throw Error('SOURCE_LOGIN_OWNER_CONTEXT_MISMATCH')
}
async function browserLogin(role){
 const context=await newContext({locale:'nl-BE',serviceWorkers:'block'})
 let stage='navigation',status=null,code=null,failedScripts=0,pageErrors=0,authRequestSeen=false
 try{
  await protect(context,source)
  const page=await newPage(context)
  page.on('pageerror',()=>pageErrors++)
  page.on('requestfailed',r=>{if(r.resourceType()==='script'&&new URL(r.url()).origin===source)failedScripts++})
  page.on('request',r=>{if(new URL(r.url()).pathname==='/api/auth/portal-login'&&r.method()==='POST')authRequestSeen=true})
  const response=await page.goto(source+'/login/'+role.portal,{waitUntil:'domcontentloaded',timeout:20000})
  if(!response||response.status()!==200)throw Error('SOURCE_LOGIN_PAGE_HTTP_'+response?.status())
  stage='hydration'
  await page.locator('form[data-login-hydrated="true"]').waitFor({timeout:12000})
  stage='fill'
  await page.locator('input[name="email"]').fill(role.email)
  await page.locator('input[name="password"]').fill(password)
  stage='submit'
  const [login]=await Promise.all([
   page.waitForResponse(r=>new URL(r.url()).origin===source&&new URL(r.url()).pathname==='/api/auth/portal-login'&&r.request().method()==='POST',{timeout:15000}),
   page.locator('form button[type="submit"]').click({timeout:10000})
  ])
  status=login.status()
  stage='response'
  const payload=await login.json()
  code=safeLoginCode(payload?.code)
  if(status!==200)throw Error('SOURCE_LOGIN_HTTP_'+status)
  const destination=checkedLogin(payload)
  stage='redirect'
  await page.waitForURL(u=>u.origin===source&&!u.pathname.startsWith('/login'),{timeout:15000})
  stage='verified-cookie'
  await verifyCookieIdentity(context,role)
  stage='authenticated-ready'
  await ready(page,'nl')
  loginChecks.push({role:role.role,kind:'browser-form',outcome:'pass',status,destination:destination.pathname})
  console.log('LOCAL_BROWSER_LOGIN_PASS '+role.role)
 }catch(error){
  const details={role:role.role,kind:'browser-form',outcome:'fail',stage,status,code,failedScripts,pageErrors,authRequestSeen}
  loginChecks.push(details);console.error('LOCAL_BROWSER_LOGIN_DIAGNOSTIC '+JSON.stringify(details))
  record({role:role.role,stage:'source-browser-login-'+stage},Error('SOURCE_LOGIN '+error.name+(status===null?'':' HTTP_'+status)+(code?' '+code:'')))
 }finally{await closeContext(context)}
}
async function signedState(role){
 const context=await newContext({locale:'nl-BE',serviceWorkers:'block'})
 let stage='http-signin',status=null,code=null
 try{
  await protect(context,source)
  const login=await context.request.post(source+'/api/auth/portal-login',{
   multipart:{portal:role.portal,email:role.email,password},
   headers:{Origin:source,'Sec-Fetch-Site':'same-origin',Accept:'application/json'},
   maxRedirects:0,timeout:20000
  })
  status=login.status()
  const body=await login.json()
  code=safeLoginCode(body?.code)
  if(status!==200)throw Error('SOURCE_LOGIN_HTTP_'+status)
  const destination=checkedLogin(body)
  stage='verified-cookie'
  await verifyCookieIdentity(context,role)
  stage='authenticated-navigation'
  const page=await newPage(context)
  const response=await page.goto(destination.href,{waitUntil:'domcontentloaded',timeout:25000})
  if(!response||response.status()>=400)throw Error('SOURCE_LOGIN_LANDING_HTTP_'+response?.status())
  await ready(page,'nl')
  loginChecks.push({role:role.role,kind:'original-http-session',outcome:'pass',status,destination:destination.pathname})
  return {landing:new URL(page.url()).pathname,cookies:(await context.storageState()).cookies}
 }catch(error){
  loginChecks.push({role:role.role,kind:'original-http-session',outcome:'fail',stage,status,code})
  console.error('LOCAL_ORIGINAL_SESSION_DIAGNOSTIC '+JSON.stringify({role:role.role,stage,status,code,errorName:error.name}))
  const reason=String(error?.message||'')
  throw Error(/^(?:SOURCE_LOGIN_[A-Z0-9_]+|SOURCE_LOGIN_RESULT_[a-z_]+)$/.test(reason)?reason:'SOURCE_LOGIN '+stage+' '+error.name)
 }finally{await closeContext(context)}
}
async function paired(state,language,device,fn){
 const opts={locale:language==='en'?'en-GB':language+'-BE',viewport:device.viewport,isMobile:!!device.isMobile,hasTouch:!!device.hasTouch,serviceWorkers:'block',
  storageState:{cookies:state.cookies.filter(c=>!['uptilldawn-language','uptilldawn-language-source'].includes(c.name)),origins:[]}}
 const contexts=[]
 try{
  contexts.push(await newContext(opts))
  contexts.push(await newContext(opts))
  await Promise.all(contexts.map((c,i)=>protect(c,i?candidate:source)))
  for(const [i,context] of contexts.entries()){
   await context.addCookies([{name:'uptilldawn-language',value:language,url:i?candidate:source,sameSite:'Lax'},{name:'uptilldawn-language-source',value:'device',url:i?candidate:source,sameSite:'Lax'}])
  }
  const a=await newPage(contexts[0]),b=await newPage(contexts[1])
  await fn(a,b)
 }finally{await Promise.all(contexts.map(closeContext))}
}
// A role remains sequential so its sessions, workspace preferences and
// mutable account state cannot race against itself. Only independent roles
// run concurrently, on one local browser/Next/Vite/Supabase stack.
async function runRole(role){
 const started=performance.now()
 try{
  stage(role.role,'browser-login')
  await browserLogin(role)
  stage(role.role,'http-session')
  let state
  try{state=await signedState(role)}catch(error){record({role:role.role,stage:'source-login'},error);return}
  if(role.role==='maker'){
   assert.equal(state.landing,'/maker-mode','UNEXPECTED_ROUTE_MAKER')
   for(const device of devices)await paired(state,'nl',device,(a,b)=>compare(a,b,'/maker-mode',{role:role.role,kind:'maker-choice',language:'nl',device:device.name,path:'/maker-mode'}))
   return
  }
  for(const language of locales)for(const device of devices)await paired(state,language,device,async(a,b)=>{
   await compare(a,b,state.landing,{role:role.role,kind:'landing',language,device:device.name,path:state.landing})
  })
  for(const device of devices)await paired(state,'nl',device,async(a,b)=>{
   for(const path of role.paths)await compare(a,b,path,{role:role.role,kind:'deep',language:'nl',device:device.name,path})
  })
 }catch(error){record({role:role.role,stage:'role-execution'},error)}
 finally{
  activeStages.delete(role.role)
  console.log('LOCAL_BROWSER_ROLE_COMPLETE '+JSON.stringify({role:role.role,elapsedMs:Math.round(performance.now()-started),passed:rows.filter(x=>x.role===role.role).length,failed:failures.filter(x=>x.role===role.role).length,totalPassed:rows.length,expected:planned.length}))
 }
}
const started=performance.now()
let poolResult=null
function writeReport(){
 const scenarioCoverage=verifyExactCoverage(planned,rows.map(scenarioKey))
 const loginCoverage=verifyExactCoverage(plannedLogins,loginChecks.filter(x=>x.outcome==='pass').map(x=>x.role+'|'+x.kind))
 const report={...binding,scope:'local-next-vite-browser-with-native-read-adapter',expected:planned.length,passed:rows.length,failed:failures.length,rows,failures,loginChecks,scenarioCoverage,loginCoverage,parallelism,peakParallelRoles:poolResult?.peak??null,activeStages:Object.fromEntries(activeStages),elapsedMs:Math.round(performance.now()-started),unsupportedLocalReadRoutes:[...blockedRoutes].sort(),candidateNativeLoginVerified:false,deployedWorkerVerified:false,fullVisualParityVerified:false,productionReady:false}
 writeFileSync(resolve(reportDir,'browser-parity.json'),JSON.stringify(report,null,2)+'\n')
 return report
}
// A stuck browser must never consume the entire CI job. Missing cases are
// persisted as unverified, and the step fails instead of reporting a pass.
const hardBudgetMs=14*60*1000
const heartbeat=setInterval(()=>{writeReport();console.log('LOCAL_BROWSER_PROGRESS '+JSON.stringify({passed:rows.length,failed:failures.length,expected:planned.length,active:Object.fromEntries(activeStages),elapsedMs:Math.round(performance.now()-started)}))},15000)
const watchdog=setTimeout(()=>{
 failures.push({stage:'browser-watchdog',reason:'BROWSER_BUDGET_EXCEEDED',active:Object.fromEntries(activeStages)})
 const report=writeReport()
 console.error('LOCAL_BROWSER_BUDGET_EXCEEDED '+JSON.stringify({passed:rows.length,missing:report.scenarioCoverage.missing.length,active:report.activeStages}))
 preview.kill('SIGTERM');process.exit(1)
},hardBudgetMs)
try{
 console.log('LOCAL_BROWSER_START expected='+planned.length+' parallelism='+parallelism)
 writeReport()
 let up=false
 for(let i=0;i<100;i++){if(preview.exitCode!==null)throw Error('PREVIEW_EXITED');try{if((await fetch(candidate+'/login',{signal:AbortSignal.timeout(1000)})).ok){up=true;break}}catch{}await new Promise(r=>setTimeout(r,250))}
 assert.ok(up,'PREVIEW_UNAVAILABLE')
 browser=await limit('CHROMIUM_LAUNCH',()=>chromium.launch({headless:true,timeout:15000}),16000)
 console.log('LOCAL_BROWSER_READY')
 // Longest roles first minimizes the idle tail without adding extra workers.
 const queue=allRoles.toSorted((a,b)=>b.paths.length-a.paths.length)
 poolResult=await runRolePool(queue,parallelism,runRole,({item,error})=>{
  if(error)record({role:item.role,stage:'pool'},error)
  // Persist partial results after every completed role; missing cases stay
  // explicitly unverified if the overall job is interrupted.
  writeReport()
 })
}finally{
 try{if(browser)await limit('BROWSER_CLOSE',()=>browser.close(),8000)}catch(error){failures.push({stage:'cleanup',reason:'DEADLINE_BROWSER_CLOSE'})}
 clearInterval(heartbeat);clearTimeout(watchdog);preview.kill('SIGTERM');globalThis.fetch=fetchBefore
 const report=writeReport()
 console.log(JSON.stringify({localBrowserExpected:planned.length,passed:rows.length,failed:failures.length,parallelism,peakParallelRoles:report.peakParallelRoles,elapsedMs:report.elapsedMs,missing:report.scenarioCoverage.missing.length,unsupportedLocalReadRoutes:report.unsupportedLocalReadRoutes}))
 if(!report.scenarioCoverage.complete||!report.loginCoverage.complete||failures.length||loginChecks.length!==16||loginChecks.some(x=>x.outcome!=='pass')||!poolResult||poolResult.errors.length)process.exitCode=1
}
