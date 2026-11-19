// Seven real QA identities. Compare the original Main controls/headings and
// expanded menus with the same source on Vite, in all four locales/devices.
// No form submissions or production endpoints. Session material stays in RAM.
import {spawn} from 'node:child_process'
import {resolve} from 'node:path'
import {mkdir} from 'node:fs/promises'
import {chromium} from 'playwright'
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
let browser,signins=0,total=0,menuComparisons=0
async function ready(page){
 await page.locator('[data-app-shell-ready="true"]').waitFor({timeout:30000})
 await page.locator('[data-route-loading="true"]').waitFor({state:'detached',timeout:30000})
 // Respect Main's staggered badge refresh: focus invokes the existing
 // immediate path while preserving its anti-overload jitter for real users.
 await page.bringToFront()
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
 await page.waitForLoadState('networkidle',{timeout:25000})
 await page.locator('[data-route-loading="true"]').waitFor({state:'detached',timeout:30000})
 if(await page.getByRole('heading',{name:'De actie kon niet worden voltooid.',exact:true}).count())throw Error('ORIGINAL_VIEW_RENDER_FAILED')
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
 const [expected,actual]=await Promise.all([fingerprint(a),fingerprint(b)])
 if(JSON.stringify(actual)!==JSON.stringify(expected)){
  await mkdir(resolve(root,'test-results/modern-source-parity'),{recursive:true})
  for(const [page,suffix]of [[a,'main'],[b,'vite']])await page.screenshot({path:resolve(root,'test-results/modern-source-parity',label+'-'+suffix+'.png'),fullPage:true})
  for(const field of ['navigation','fields'])if(JSON.stringify(actual[field])!==JSON.stringify(expected[field]))console.error('ORIGINAL_UI_CONTROL_DIFFERENCE '+label+' '+field+' '+JSON.stringify({expected:expected[field],actual:actual[field]}))
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
   await b.waitForLoadState('networkidle',{timeout:25000})
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
   const page=await login.newPage();let status=0,reads=0;const readKinds={}
   page.on('request',request=>{const target=new URL(request.url());if(target.origin!==qa.origin)return;reads++;readKinds[target.pathname]=(readKinds[target.pathname]||0)+1;if(reads>400)void page.close()})
   page.on('pageerror',error=>console.error('QA_PAGE_ERROR '+bot.role+' '+error.name))
   page.on('response',response=>{if(new URL(response.url()).pathname==='/api/auth/portal-login')status=response.status()})
   await page.goto(origin+'/login/'+bot.login,{waitUntil:'domcontentloaded',timeout:20000})
   await page.locator('input[name="email"]').fill(bot.email);await page.locator('input[name="password"]').fill(password)
   await page.locator('form button[type="submit"]').click()
   try{await ready(page)}catch(error){console.error('QA_READY_FAILURE '+bot.role+' '+(error instanceof Error?error.message.split('\n')[0]:'unknown')+' reads='+reads+' sources='+JSON.stringify(readKinds));throw Error('QA_LOGIN_NOT_READY '+bot.role+' HTTP='+status)}
   signins++
   const landing=new URL(page.url()).pathname,state=await login.storageState()
   // Check ordinary source pages without mutations before device comparisons.
   for(const path of ['/settings','/notifications','/events','/crew']){
    await page.goto(origin+path,{waitUntil:'domcontentloaded',timeout:20000});await ready(page)
   }
   for(const language of ['nl','fr','en','de'])for(const device of devices){
    const options={locale:language==='en'?'en-GB':language+'-BE',viewport:device.viewport,isMobile:device.isMobile,hasTouch:device.hasTouch}
    const candidate=await browser.newContext({...options,storageState:state})
    // Both hosts are the same fixed QA database. Reuse the exact signed test
    // session in RAM; no extra passwords or independent privileged tokens.
    const mainCookies=state.cookies.map(c=>({...c,domain:new URL(legacy).hostname,secure:true}))
    const original=await browser.newContext({...options,storageState:{cookies:mainCookies,origins:[]}})
    try{
     const a=await original.newPage(),b=await candidate.newPage(),errors=[]
     b.on('pageerror',error=>errors.push(error.name))
     const label=[bot.role,language,device.name].join('-')
     // Sequential Main SSR requests respect the Free environment's limits.
     await Promise.all([a.goto(legacy+landing,{waitUntil:'domcontentloaded',timeout:30000}),b.goto(origin+landing,{waitUntil:'domcontentloaded',timeout:20000})]);await ready(a);await ready(b)
     if(await b.locator('html').getAttribute('lang')!==language)throw Error('QA_LOCALE '+label)
     await compare(a,b,label);await menus(a,b,label)
     if(language==='nl'&&device.name==='desktop'){
      await a.goto(legacy+'/maker-mode',{waitUntil:'domcontentloaded',timeout:30000})
      await a.waitForURL('**/unauthorized',{timeout:20000})
      await b.goto(origin+'/maker-mode',{waitUntil:'domcontentloaded',timeout:20000})
      await b.waitForURL('**/unauthorized',{timeout:20000})
      await a.getByRole('heading',{name:'Geen toegang',exact:true}).waitFor()
      await b.getByRole('heading',{name:'Geen toegang',exact:true}).waitFor()
      await compare(a,b,label+'-maker-denied')
     }
     if(errors.length)throw Error('QA_JS_ERRORS '+label)
     total++;console.log('PASS original-source controls '+bot.role+' / '+language+' / '+device.name)
    }finally{await candidate.close();await original.close()}
   }
  }finally{await login.close()}
 }
 if(signins!==7||total!==56)throw Error('QA_INCOMPLETE_COVERAGE')
 console.log(JSON.stringify({validated:true,qaBots:7,actualBotSignins:signins,authenticatedBrowserScenarios:total,originalMainControlComparisons:total,expandedMenuComparisons:menuComparisons,locales:4,deviceProfiles:2,formsSubmitted:false,fullVisualParityVerified:false,productionReady:false}))
}finally{if(browser)await browser.close();preview?.kill('SIGTERM')}
