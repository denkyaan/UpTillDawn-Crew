// Local browser parity, using the actual Next source and built Vite UI.
// The test-only read adapter invokes real native handlers with freshly
// verified signed local cookies. It is NOT a deployed Worker or auth test.
// No remote endpoint or production credentials, no public write enablement.
import assert from 'node:assert/strict'
import {spawn,execFileSync} from 'node:child_process'
import {resolve} from 'node:path'
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
const rows=[],failures=[],blockedRoutes=new Set()
const reportDir=resolve(root,'test-results/phase-two-three-local-native')
mkdirSync(reportDir,{recursive:true})
const binding={validatedSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runId:process.env.GITHUB_RUN_ID||null,runAttempt:process.env.GITHUB_RUN_ATTEMPT||null}
const preview=spawn(process.execPath,[resolve(root,'modern/node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4176','--strictPort'],{cwd:resolve(root,'modern'),stdio:'ignore'})
let browser
const fetchBefore=globalThis.fetch
// All native server-side read handlers are network-isolated too.
globalThis.fetch=(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input))
 if(![source,candidate,dbUrl].includes(url.origin))throw Error('NONLOCAL_NETWORK_BLOCKED')
 return fetchBefore(input,{...init,redirect:'error'})
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
   const headers=await incoming.allHeaders()
   const options={method:incoming.method(),headers}
   if(!['GET','HEAD'].includes(options.method))options.body=incoming.postDataBuffer()||undefined
   const response=await readAdapter(new Request(incoming.url(),options))
   // Keep real statuses and redirect locations, never source-fallback.
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())})
  }catch{await route.fulfill({status:503,contentType:'application/json',body:'{"error":"local_read_adapter_failed"}'})}
 })
}
async function ready(page,language){
 const timeout=20000
 await page.waitForFunction(()=>{
  if(location.pathname==='/maker-mode')return !!document.querySelector('main h1, h1')
  return !!document.querySelector('[data-app-shell-ready="true"]')&&!document.querySelector('[data-route-loading="true"]')&&!!document.querySelector('main')
 },null,{timeout})
 assert.ok(!/^\/(?:login|unauthorized|pending-approval|disabled)(?:\/|$)/.test(new URL(page.url()).pathname),'UNEXPECTED_AUTH_REDIRECT')
 assert.equal(await page.locator('[data-app-error="true"]').count(),0,'APP_RENDER_ERROR')
 await page.waitForFunction(lang=>document.documentElement.lang.split('-')[0]===lang,language,{timeout})
 await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))})
}
async function view(page){
 return page.evaluate(()=>{
  const clean=value=>(value||'').replace(/\s+/g,' ').replace(/\b\d+\b/g,'#').trim()
  const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'}
  const list=(selector,fn)=>[...document.querySelectorAll(selector)].filter(visible).map(fn)
  const label=e=>clean(e.getAttribute('aria-label')||e.textContent)
  const control=e=>({tag:e.tagName,label:label(e),href:e.getAttribute('href'),disabled:e.disabled||e.getAttribute('aria-disabled')==='true',expanded:e.getAttribute('aria-expanded')})
  return {path:location.pathname,headings:list('main h1,main h2',label),nav:list('nav a,nav button,header a,header button',control),controls:list('main a[href],main button,main [role="button"]',control),
   fields:list('main input,main textarea,main select',e=>({tag:e.tagName,name:e.getAttribute('name'),type:e.getAttribute('type'),required:e.required,disabled:e.disabled})).filter(e=>!(e.name||'').startsWith('$ACTION')),
   layout:list('header,nav,main,main h1,main h2',e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);const round=n=>Math.round(n/2)*2;return {tag:e.tagName,x:round(r.x),y:round(r.y),w:round(r.width),h:round(r.height),font:s.fontSize,color:s.color,background:s.backgroundColor}})}
 })
}
function record(meta,error){
 if(error){
  // Only controlled stage names, not raw browser messages, tokens or URLs.
  const reason=String(error?.message||'FAILED').split('\n')[0]
  const safe=/^(?:PARITY_MISMATCH|UNEXPECTED_AUTH_REDIRECT|APP_RENDER_ERROR|SOURCE_HTTP|CANDIDATE_HTTP|SOURCE_LOGIN|BROWSER_JS_ERROR|NO_MOBILE_OVERFLOW|MISSING_CONTROL|LOCALE_|UNEXPECTED_ROUTE)/.test(reason)?reason.slice(0,160):String(error?.name||'Error')
  failures.push({...meta,reason:safe});console.error('LOCAL_BROWSER_FAIL '+JSON.stringify({...meta,reason:safe}))
 }else{rows.push(meta);console.log('LOCAL_BROWSER_PASS '+JSON.stringify(meta))}
}
async function compare(a,b,path,meta){
 let stage='source'
 try{
  const ra=await a.goto(source+path,{waitUntil:'domcontentloaded',timeout:30000})
  if(!ra||ra.status()>=400)throw Error('SOURCE_HTTP_'+ra?.status())
  await ready(a,meta.language)
  const finalPath=new URL(a.url()).pathname
  // Only the known shifts alias and conditional incident routing may
  // settle on a different authorized route in this matrix.
  if(finalPath!==path&&!(path==='/shifts'&&finalPath==='/workplaces')&&!(path==='/incidents'&&finalPath==='/events'))throw Error('UNEXPECTED_ROUTE_SOURCE')
  stage='candidate'
  const rb=await b.goto(candidate+path,{waitUntil:'domcontentloaded',timeout:30000})
  if(!rb||rb.status()>=400)throw Error('CANDIDATE_HTTP_'+rb?.status())
  if(finalPath!==path)await b.waitForURL(u=>u.pathname===finalPath,{timeout:12000})
  await ready(b,meta.language)
  stage='comparison'
  let expected=await view(a),actual=await view(b),deadline=Date.now()+10000
  while(JSON.stringify(expected)!==JSON.stringify(actual)&&Date.now()<deadline){
   await new Promise(r=>setTimeout(r,300));expected=await view(a);actual=await view(b)
  }
  const diff=Object.keys(expected).filter(k=>JSON.stringify(expected[k])!==JSON.stringify(actual[k]))
  if(diff.length)throw Error('PARITY_MISMATCH '+diff.join(','))
  if(meta.device==='mobile')for(const page of [a,b])if(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth>4))throw Error('NO_MOBILE_OVERFLOW')
  if(!expected.headings.length&&!expected.controls.length)throw Error('MISSING_CONTROL')
  record(meta)
 }catch(error){record({...meta,stage},error)}
}
async function signedState(role){
 const context=await browser.newContext({locale:'nl-BE',serviceWorkers:'block'})
 try{
  await protect(context,source)
  const page=await context.newPage()
  await page.goto(source+'/login/'+role.portal,{waitUntil:'domcontentloaded',timeout:30000})
  await page.locator('form[data-login-hydrated="true"]').waitFor({timeout:30000})
  await page.locator('input[name="email"]').fill(role.email)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL(u=>!u.pathname.startsWith('/login'),{timeout:30000})
  await ready(page,'nl')
  return {landing:new URL(page.url()).pathname,cookies:(await context.storageState()).cookies}
 }finally{await context.close()}
}
async function paired(state,language,device,fn){
 const opts={locale:language==='en'?'en-GB':language+'-BE',viewport:device.viewport,isMobile:!!device.isMobile,hasTouch:!!device.hasTouch,serviceWorkers:'block',
  storageState:{cookies:state.cookies.filter(c=>!['uptilldawn-language','uptilldawn-language-source'].includes(c.name)),origins:[]}}
 const contexts=[await browser.newContext(opts),await browser.newContext(opts)]
 try{
  await Promise.all(contexts.map((c,i)=>protect(c,i?candidate:source)))
  for(const [i,context] of contexts.entries()){
   await context.addCookies([{name:'uptilldawn-language',value:language,url:i?candidate:source,sameSite:'Lax'},{name:'uptilldawn-language-source',value:'device',url:i?candidate:source,sameSite:'Lax'}])
  }
  const a=await contexts[0].newPage(),b=await contexts[1].newPage()
  await fn(a,b)
 }finally{await Promise.all(contexts.map(c=>c.close()))}
}
try{
 let up=false
 for(let i=0;i<100;i++){if(preview.exitCode!==null)throw Error('PREVIEW_EXITED');try{if((await fetch(candidate+'/login',{signal:AbortSignal.timeout(1000)})).ok){up=true;break}}catch{}await new Promise(r=>setTimeout(r,250))}
 assert.ok(up,'PREVIEW_UNAVAILABLE')
 browser=await chromium.launch({headless:true})
 for(const role of cases){
  let state
  try{state=await signedState(role)}catch(error){record({role:role.role,stage:'source-login'},Error('SOURCE_LOGIN '+error.name));continue}
  for(const language of locales)for(const device of devices)await paired(state,language,device,async(a,b)=>{
   await compare(a,b,state.landing,{role:role.role,kind:'landing',language,device:device.name,path:state.landing})
  })
  for(const device of devices)await paired(state,'nl',device,async(a,b)=>{
   for(const path of role.paths)await compare(a,b,path,{role:role.role,kind:'deep',language:'nl',device:device.name,path})
  })
 }
 // Maker choice on both sizes, using a genuine owner account and original
 // login. This is not a claim of all God Mode panels or provider access.
 const maker={role:'maker',portal:'admin',email:'bot-16-maker@bots.uptilldawn.test'}
 try{
  const state=await signedState(maker)
  assert.equal(state.landing,'/maker-mode','UNEXPECTED_ROUTE_MAKER')
  for(const device of devices)await paired(state,'nl',device,(a,b)=>compare(a,b,'/maker-mode',{role:'maker',kind:'maker-choice',language:'nl',device:device.name,path:'/maker-mode'}))
 }catch(error){record({role:'maker',stage:'source-login'},Error('SOURCE_LOGIN '+error.name))}
}finally{
 await browser?.close();preview.kill('SIGTERM');globalThis.fetch=fetchBefore
 const expected=56+88+2
 const report={...binding,scope:'local-next-vite-browser-with-native-read-adapter',expected,passed:rows.length,failed:failures.length,rows,failures,unsupportedLocalReadRoutes:[...blockedRoutes].sort(),candidateNativeLoginVerified:false,deployedWorkerVerified:false,fullVisualParityVerified:false,productionReady:false}
 writeFileSync(resolve(reportDir,'browser-parity.json'),JSON.stringify(report,null,2)+'\n')
 console.log(JSON.stringify({localBrowserExpected:expected,passed:rows.length,failed:failures.length,unsupportedLocalReadRoutes:report.unsupportedLocalReadRoutes}))
 if(rows.length!==expected||failures.length)process.exitCode=1
}
