// Seven real QA identities. Compare the original Main controls/headings and
// expanded menus with the same source on Vite, in all four locales/devices.
// No form submissions or production endpoints. Session material stays in RAM.
import {spawn} from 'node:child_process'
import {resolve} from 'node:path'
import {mkdir} from 'node:fs/promises'
import {chromium} from 'playwright'
import {createServerClient} from '@supabase/ssr'
const qa=new URL(process.env.E2E_MAIN_QA_BASE_URL||''),key=process.env.E2E_MAIN_QA_PUBLISHABLE_KEY||'',password=process.env.E2E_MAIN_QA_PASSWORD||''
if(qa.origin!=='https://npbjrtiolqperdgljnhi.supabase.co'||qa.pathname!=='/'||qa.search||qa.hash)throw Error('QA_ONLY_ENDPOINT_REQUIRED')
if(!key.startsWith('sb_publishable_'))throw Error('QA_PUBLISHABLE_KEY_REQUIRED')
if(password.length<24)throw Error('QA_PASSWORD_NOT_CONFIGURED')
if(process.env.VITE_MIGRATION_ALLOW_WRITES!=='false')throw Error('READ_ONLY_CANDIDATE_REQUIRED')
const bots=[
 {role:'head_admin',login:'admin',email:'e2e-head-admin@uptilldawn.test'},
 {role:'left_hand',login:'administration',email:'e2e-admin@uptilldawn.test'},
 {role:'right_hand',login:'administration',email:'e2e-right-hand@uptilldawn.test'},
 {role:'responsible',login:'responsible',email:'e2e-responsible@uptilldawn.test'},
 {role:'staff',login:'staff',email:'e2e-staff@uptilldawn.test'},
 {role:'promotion',login:'promotion',email:'e2e-promotion@uptilldawn.test'},
 {role:'administration',login:'administration',email:'e2e-administration@uptilldawn.test'},
]
const devices=[{name:'desktop',viewport:{width:1440,height:900},isMobile:false,hasTouch:false},{name:'mobile',viewport:{width:390,height:844},isMobile:true,hasTouch:true}]
const legacy='https://uptilldawn-main.uptilldawn.workers.dev',approvedRemote='https://uptilldawn-modern-main.uptilldawn.workers.dev'
const remote=process.env.E2E_MAIN_MODERN_QA_ORIGIN||''
if(remote&&remote!==approvedRemote)throw Error('EXACT_MODERN_MAIN_QA_ORIGIN_REQUIRED')
const origin=remote||'http://127.0.0.1:4176',root=resolve(import.meta.dirname,'../..')
const preview=remote?null:spawn(process.execPath,[resolve(root,'modern/node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4176','--strictPort'],{cwd:resolve(root,'modern'),stdio:'ignore'})
let browser,signins=0,total=0,menuComparisons=0,workspaceComparisons=0,baselineRecoveries=0,nativeReadComparisons=0
const failures=[]
const notificationReads=new WeakMap()
function observeNotices(page){
 const reads=[];notificationReads.set(page,reads)
 page.on('response',async response=>{const url=new URL(response.url());if(url.origin!==qa.origin||!url.pathname.endsWith('/crew_notifications')||url.searchParams.get('select')!=='id,link,kind')return;try{const data=await response.json();reads.push({status:response.status(),count:Array.isArray(data)?data.length:null})}catch{reads.push({status:response.status(),count:null})}})
}
// A populated, hydrated view is the authoritative readiness signal. Waiting
// for networkidle can never prove this when chat, badges and Realtime continue
// to make requests. Worse, the previous focus + chat-read probes induced two
// extra refresh bursts per role/device/locale comparison on Workers Free.
async function ready(page){
 await page.locator('[data-app-shell-ready="true"]').waitFor({timeout:18000})
 await page.locator('[data-route-loading="true"]').waitFor({state:'detached',timeout:15000})
 await page.waitForFunction(()=>{
  const main=document.querySelector('main'),nav=document.querySelector('nav')
  return Boolean(main&&nav&&main.getBoundingClientRect().height>0&&
   nav.querySelector('a,button')&&!document.querySelector('[data-route-loading="true"]'))
 },null,{timeout:10000})
 if(await page.locator('[data-app-error="true"]').count())
  throw Error('ORIGINAL_VIEW_RENDER_FAILED')
}
// A legacy Main timeout is not evidence of candidate UI parity. Retry only
// the failing read, with bounded cooling-off time to protect Workers Free.
// If a fully hydrated original view cannot be read, keep the gate RED.
let consecutiveLegacyFailures=0
async function readyBaseline(page,check=ready){
 for(let attempt=0;attempt<3;attempt++){
  try{
   await check(page)
   consecutiveLegacyFailures=0
   return
  }catch(error){
   baselineRecoveries++
   const cause=error instanceof Error?error.message.split('\n')[0]:'read unavailable'
   // Never retry a confirmed application/render error or a parity mismatch.
   if(error?.name!=='TimeoutError'&&!/^LEGACY_MAIN_HTTP_(502|503|504)$/.test(cause))throw error
   console.error('LEGACY_MAIN_READ_RECOVERY attempt='+String(attempt+1)+' '+cause)
   if(consecutiveLegacyFailures>=1)
    throw Error('LEGACY_MAIN_BASELINE_UNAVAILABLE_CIRCUIT_OPEN')
   if(attempt===2){
    consecutiveLegacyFailures++
    throw Error('LEGACY_MAIN_BASELINE_UNAVAILABLE_AFTER_BOUNDED_RETRIES')
   }
   // Repeated immediate SSR reloads can amplify a Worker resource failure.
   await new Promise(resolve=>setTimeout(resolve,6000*(attempt+1)))
   try{
    const response=await page.reload({waitUntil:'domcontentloaded',timeout:25000})
    if(response&&response.status()>=500)
     console.error('LEGACY_MAIN_RELOAD_HTTP_'+response.status())
   }catch(reloadError){
    console.error('LEGACY_MAIN_RELOAD_FAILED '+(reloadError instanceof Error?reloadError.name:'unknown'))
   }
  }
 }
}
async function fingerprint(page){
 return page.evaluate(()=>{
  const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'}
  const text=e=>(e.getAttribute('aria-label')||e.textContent||'').replace(/\s+/g,' ').trim()
  // Compare actual user controls. Internal Next action fields, signed photo
  // URLs and live work-duration counters are not UI capability identifiers.
  const headings=Array.from(document.querySelectorAll('main h1')).filter(visible).map(text)
  const navigation=Array.from(document.querySelectorAll('nav a,nav button,header a,header button')).filter(visible).map(e=>({tag:e.tagName,label:text(e).replace(/\b\d+\b/g,'#'),href:e.getAttribute('href'),expanded:e.getAttribute('aria-expanded')}))
  const fields=Array.from(document.querySelectorAll('main input,main select,main textarea')).filter(visible).filter(e=>!(e.getAttribute('name')||'').startsWith('$ACTION')).map(e=>({tag:e.tagName,name:e.getAttribute('name'),type:e.getAttribute('type'),required:e.required,disabled:e.disabled}))
  return {headings,navigation,fields}
 })
}
async function compare(a,b,label){
 let [expected,actual]=await Promise.all([fingerprint(a),fingerprint(b)])
 // The original shell deliberately staggers each signed badge refresh by
 // up to 6.9 seconds to prevent login bursts on Workers Free. Allow that
 // source-defined initialization plus bounded network latency, but keep
 // every heading, badge, field and navigation assertion fail-closed.
 const deadline=Date.now()+18000
 while(JSON.stringify(actual)!==JSON.stringify(expected)&&Date.now()<deadline){
  await new Promise(resolve=>setTimeout(resolve,300))
  ;[expected,actual]=await Promise.all([fingerprint(a),fingerprint(b)])
 }
 if(JSON.stringify(actual)!==JSON.stringify(expected)){
  console.error('ORIGINAL_BADGE_READS '+label+' '+JSON.stringify({main:notificationReads.get(a),candidate:notificationReads.get(b)}))
  await mkdir(resolve(root,'test-results/modern-source-parity'),{recursive:true})
  for(const [page,suffix]of [[a,'main'],[b,'vite']])await page.screenshot({path:resolve(root,'test-results/modern-source-parity',label+'-'+suffix+'.png'),fullPage:true})
  for(const field of ['headings','navigation','fields'])if(JSON.stringify(actual[field])!==JSON.stringify(expected[field]))console.error('ORIGINAL_UI_CONTROL_DIFFERENCE '+label+' '+field+' '+JSON.stringify({expected:expected[field],actual:actual[field]}))
  const differing=Object.keys(expected).filter(k=>JSON.stringify(actual[k])!==JSON.stringify(expected[k]))
  throw Error('ORIGINAL_UI_CONTROL_PARITY '+label+' '+differing.join(','))
 }
}
async function menus(a,b,label){
 const selector='button[aria-expanded]:visible,button[data-role-category]:not([data-role-category="home"]):visible'
 const buttons=a.locator(selector)
 const count=Math.min(await buttons.count(),6)
 for(let i=0;i<count;i++){
  const original=buttons.nth(i),candidate=b.locator(selector).nth(i)
  if(!await original.isEnabled()||!await candidate.isEnabled())continue
  await Promise.all([original.click(),candidate.click()]);await Promise.all([a.waitForTimeout(100),b.waitForTimeout(100)])
  await compare(a,b,label+'-menu-'+i);menuComparisons++
  if(label==='head_admin-nl-desktop'&&(await original.innerText()).includes('AI')&&await candidate.getAttribute('aria-expanded')==='true'){
   await b.evaluate(()=>window.dispatchEvent(new Event('upt-source-refresh')))
   await b.locator('[data-route-loading="true"]').waitFor({state:'detached',timeout:12000})
   if(await candidate.getAttribute('aria-expanded')!=='true')throw Error('ORIGINAL_CLIENT_STATE_LOST_ON_REFRESH')
   await compare(a,b,label+'-retained-ai')
  }
  if(await original.getAttribute('aria-expanded')==='true')await original.click()
  if(await candidate.getAttribute('aria-expanded')==='true')await candidate.click()
 }
}
try{
 let up=false
 for(let i=0;i<80;i++){if(preview&&preview.exitCode!==null)throw Error('Candidate preview exited');try{if((await fetch(origin+'/login',{signal:AbortSignal.timeout(1000)})).ok){up=true;break}}catch{}await new Promise(r=>setTimeout(r,250))}
 if(!up)throw Error('QA_CANDIDATE_PREVIEW_UNAVAILABLE')
 browser=await chromium.launch({headless:true})
 for(const bot of bots){
  const login=await browser.newContext({locale:'nl-BE',viewport:devices[0].viewport})
  try{
   const page=await login.newPage();let status=0,reads=0,nativeLogin=false;const readKinds={}
   page.on('request',request=>{const target=new URL(request.url());if(target.origin!==qa.origin)return;reads++;readKinds[target.pathname]=(readKinds[target.pathname]||0)+1;if(reads>400)void page.close()})
   page.on('pageerror',error=>console.error('QA_PAGE_ERROR '+bot.role+' '+error.name))
   page.on('response',response=>{if(new URL(response.url()).pathname==='/api/auth/portal-login'){status=response.status();nativeLogin=response.headers()['x-uptilldawn-auth-runtime']==='native-original-source'}})
   await page.goto(origin+'/login/'+bot.login,{waitUntil:'domcontentloaded',timeout:20000})
   await page.locator('input[name="email"]').fill(bot.email);await page.locator('input[name="password"]').fill(password)
   await page.locator('form button[type="submit"]').click()
   try{await ready(page)}catch(error){console.error('QA_READY_FAILURE '+bot.role+' '+(error instanceof Error?error.message.split('\n')[0]:'unknown')+' reads='+reads+' sources='+JSON.stringify(readKinds));throw Error('QA_LOGIN_NOT_READY '+bot.role+' HTTP='+status)}
   if(remote&&!nativeLogin)throw Error('QA_NON_NATIVE_AUTH '+bot.role)
   signins++
   const landing=new URL(page.url()).pathname,state=await login.storageState()
   // Check ordinary source pages without mutations before device comparisons.
   for(const path of ['/settings','/notifications','/events','/crew']){
    await page.goto(origin+path,{waitUntil:'domcontentloaded',timeout:20000});await ready(page)
   }
   // Stop the now-unused login/probe page's live badges, offline sync and
   // realtime activity before the independent role comparisons.
   await page.close()
   for(const language of ['nl','fr','en','de'])for(const device of devices){
    const options={locale:language==='en'?'en-GB':language+'-BE',viewport:device.viewport,isMobile:device.isMobile,hasTouch:device.hasTouch}
    const candidate=await browser.newContext({...options,storageState:state})
    // Both hosts are the same fixed QA database. Reuse the exact signed test
    // session in RAM; no extra passwords or independent privileged tokens.
    const mainCookies=state.cookies.map(c=>({...c,domain:new URL(legacy).hostname,secure:true}))
    const original=await browser.newContext({...options,storageState:{cookies:mainCookies,origins:[]}})
    const label=[bot.role,language,device.name].join('-')
    try{
     const a=await original.newPage(),b=await candidate.newPage(),errors=[]
     observeNotices(a);observeNotices(b)
     b.on('pageerror',error=>errors.push(error.name))
     // Sequential Main SSR requests respect the Free environment's limits.
     await a.goto(legacy+landing,{waitUntil:'domcontentloaded',timeout:30000});await readyBaseline(a)
     await b.goto(origin+landing,{waitUntil:'domcontentloaded',timeout:20000});await ready(b)
     if(await b.locator('html').getAttribute('lang')!==language)throw Error('QA_LOCALE '+label)
     await compare(a,b,label);await menus(a,b,label)
     if(language==='nl'&&device.name==='desktop'){
      await a.goto(legacy+'/maker-mode',{waitUntil:'domcontentloaded',timeout:30000})
      await readyBaseline(a,async source=>{
       await source.waitForURL('**/unauthorized',{timeout:20000})
       await source.getByRole('heading',{name:'Geen toegang',exact:true}).waitFor({timeout:18000})
      })
      await b.goto(origin+'/maker-mode',{waitUntil:'domcontentloaded',timeout:20000})
      await b.waitForURL('**/unauthorized',{timeout:20000})
      await b.getByRole('heading',{name:'Geen toegang',exact:true}).waitFor()
      await compare(a,b,label+'-maker-denied')
     }
     if(label==='head_admin-nl-desktop'){
      // Two migrated READ endpoints must match the real authenticated Main,
      // including session-cookie handling and empty/error outcomes. Never
      // write business data or relax a response mismatch into a pass.
      const sourcePush=await original.request.get(legacy+'/api/push/config')
      const modernPush=await candidate.request.get(origin+'/api/push/config')
      const sourcePushBody=await sourcePush.json(),modernPushBody=await modernPush.json()
      if(sourcePush.status()!==modernPush.status()||
         JSON.stringify(sourcePushBody)!==JSON.stringify(modernPushBody))
       throw Error('QA_NATIVE_PUSH_CONFIG_PARITY')
      nativeReadComparisons++
      // The original portal-preference DTO reads an allowlisted cookie after
      // authentication. Preserve the exact result on the lighter Worker.
      for(const [context,host] of [[original,legacy],[candidate,origin]])
       await context.addCookies([{name:'uptilldawn-last-portal',value:'promotion',url:host,secure:true,sameSite:'Lax'}])
      const sourcePreference=await original.request.post(legacy+'/api/migration/view-data',{
       data:{id:'portal-preference',args:[]},headers:{Origin:legacy}
      })
      const modernPreference=await candidate.request.post(origin+'/api/migration/view-data',{
       data:{id:'portal-preference',args:[]},headers:{Origin:origin}
      })
      const sourcePreferenceBody=await sourcePreference.json(),modernPreferenceBody=await modernPreference.json()
      if(sourcePreference.status()!==200||
         sourcePreference.status()!==modernPreference.status()||
         JSON.stringify(sourcePreferenceBody)!==JSON.stringify(modernPreferenceBody)||
         sourcePreferenceBody?.value?.lastPortal!=='promotion')
       throw Error('QA_NATIVE_PORTAL_PREFERENCE_PARITY')
      nativeReadComparisons++
      // Signed, read-only original-versus-native CSV bytes and headers. This
      // cannot be replaced by synthetic snapshots before the Main cutover.
      for(const path of [
       '/api/administration/finance/summary/export',
       '/api/administration/ticketing/event-summary'
      ]){
       const originalExport=await original.request.get(legacy+path)
       const modernExport=await candidate.request.get(origin+path)
       if(originalExport.status()!==200||modernExport.status()!==200||
          originalExport.status()!==modernExport.status()||
          originalExport.headers()['content-disposition']!==modernExport.headers()['content-disposition']||
          originalExport.headers()['content-type']!==modernExport.headers()['content-type']||
          !Buffer.from(await originalExport.body()).equals(Buffer.from(await modernExport.body())))
        throw Error('QA_NATIVE_ADMIN_EXPORT_PARITY '+path)
       nativeReadComparisons++
      }
      // Extended native read migration: signed original-versus-Hono source
      // comparison for every new backend route. Payroll uses a valid event
      // UUID; if no approved snapshot exists both must return the same
      // original refusal rather than fabricate rows.
      for(const [path,positive] of [
       ['/api/administration/ticketing/export',true],
       ['/api/administration/payroll/export?event=00000000-0000-0000-0000-000000000001',false],
       ['/api/administration/provider-mappings',true],
       ['/api/administration/provider-transactions',true]
      ]){
       const source=await original.request.get(legacy+path)
       const native=await candidate.request.get(origin+path)
       if(source.status()>=500||native.status()>=500||
          (positive&&source.status()!==200)||
          source.status()!==native.status()||
          source.headers()['content-type']!==native.headers()['content-type']||
          source.headers()['content-disposition']!==native.headers()['content-disposition']||
          !Buffer.from(await source.body()).equals(Buffer.from(await native.body())))
        throw Error('QA_NATIVE_ADMIN_READ_PARITY '+path.split('?')[0])
       nativeReadComparisons++
      }
      // The account ID selects a non-authoritative preference only. Both
      // apps independently verify the session and actual portal access.
      const reader=createServerClient(qa.origin,key,{cookies:{getAll:()=>state.cookies,setAll:()=>{}}})
      const {data:{session}}=await reader.auth.getSession(),uid=session?.user.id
      if(!uid)throw Error('QA_WORKSPACE_IDENTITY_MISSING')
      for(const workspace of ['administration','promotion']){
       for(const [context,host]of [[original,legacy],[candidate,origin]])await context.addCookies([{name:'uptilldawn-last-workspace',value:encodeURIComponent(uid+':'+workspace),url:host,secure:host.startsWith('https:'),sameSite:'Lax'}])
       await a.goto(legacy+'/',{waitUntil:'domcontentloaded',timeout:30000})
       await a.waitForURL('**/portals/'+workspace,{timeout:20000});await readyBaseline(a)
       await b.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:20000})
       await b.waitForURL('**/portals/'+workspace,{timeout:20000});await ready(b)
       await compare(a,b,label+'-restore-'+workspace);workspaceComparisons++
      }
     }
     if(errors.length)throw Error('QA_JS_ERRORS '+label)
     total++;console.log('PASS original-source controls '+bot.role+' / '+language+' / '+device.name)
    }catch(error){
     const reason=error instanceof Error?error.message.split('\n')[0]:'QA_SCENARIO_FAILED'
     failures.push({label,reason});console.error('ORIGINAL_SCENARIO_FAILED '+label+' '+reason)
     if(reason==='LEGACY_MAIN_BASELINE_UNAVAILABLE_CIRCUIT_OPEN')
      throw Error('QA_STOPPED_UNHEALTHY_LEGACY_MAIN_NO_FALSE_PARITY')
    }finally{
     await candidate.close();await original.close()
     // Do not pile the next role/locale SSR request onto a cooling-off Worker.
     // Source Main uses Next SSR on Cloudflare Free. Spread the 56 genuine
     // independent SSR comparisons to avoid back-to-back CPU spikes; never
     // suppress an error, skip a role or fabricate success.
     await new Promise(resolve=>setTimeout(resolve,1600))
    }
   }
  }catch(error){
   // A single bad role/login is still a failed gate, but cannot hide all
   // remaining identities. Keep the unhealthy-source circuit breaker hard.
   const message=error instanceof Error?error.message.split('\n')[0]:'unknown'
   if(message==='QA_STOPPED_UNHEALTHY_LEGACY_MAIN_NO_FALSE_PARITY')throw error
   const reason=/^(QA_LOGIN_NOT_READY [a-z_]+ HTTP=\d+|QA_NON_NATIVE_AUTH [a-z_]+|ORIGINAL_VIEW_RENDER_FAILED)$/.test(message)?
    message:'QA_ROLE_INCOMPLETE '+(error instanceof Error?error.name:'Error')
   failures.push({label:bot.role,reason})
   console.error('QA_ROLE_FAILED '+bot.role+' '+reason)
  }finally{await login.close()}
 }
 if(failures.length){console.error('ORIGINAL_COMPARISON_FAILURES '+JSON.stringify(failures));throw Error('QA_ORIGINAL_COMPARISONS_FAILED '+failures.length)}
 if(workspaceComparisons!==2)throw Error('QA_WORKSPACE_RESTORATION_INCOMPLETE')
 if(nativeReadComparisons!==8)throw Error('QA_NATIVE_SOURCE_READ_COVERAGE_INCOMPLETE')
 if(signins!==7||total!==56)throw Error('QA_INCOMPLETE_COVERAGE')
 console.log(JSON.stringify({validated:true,qaBots:7,actualBotSignins:signins,authenticatedBrowserScenarios:total,originalMainControlComparisons:total,expandedMenuComparisons:menuComparisons,workspaceRestorationComparisons:workspaceComparisons,nativeSourceReadComparisons:nativeReadComparisons,legacyMainReadRecoveries:baselineRecoveries,legacyMainRuntimeHealthy:baselineRecoveries===0,locales:4,deviceProfiles:2,formsSubmitted:false,fullVisualParityVerified:false,productionReady:false}))
}finally{if(browser)await browser.close();preview?.kill('SIGTERM')}
