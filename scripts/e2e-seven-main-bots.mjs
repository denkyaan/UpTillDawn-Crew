// Explicit opt-in real-browser QA for seven operational roles on isolated Main.
// No product data mutations. Does NOT impersonate Maker, touch production,
// change passwords, or exercise payments and third-party providers.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
import {administrationNavigationGroups,administrationRoute} from '../lib/administration/navigation.ts'

const BASE='https://uptilldawn-main.uptilldawn.workers.dev'
const configUrl=process.env.E2E_MAIN_QA_BASE_URL
const password=process.env.E2E_MAIN_QA_PASSWORD
if(configUrl!==BASE||!password||password.length<24)
 throw Error('Seven-role browser QA is restricted to the exact isolated Main URL and a private 24+ character secret')

const roles=[
 {role:'head_admin',email:'e2e-head-admin@uptilldawn.test',login:'admin',allowed:['/admin','/personnel','/portals/administration/finance'],denied:['/god-mode']},
 {role:'left_hand',email:'e2e-admin@uptilldawn.test',login:'administration',allowed:['/portals/administration','/portals/administration/personnel','/portals/administration/finance'],denied:['/admin','/god-mode']},
 {role:'right_hand',email:'e2e-right-hand@uptilldawn.test',login:'administration',allowed:['/portals/administration','/portals/administration/finance'],denied:['/admin','/god-mode']},
 {role:'administration',email:'e2e-administration@uptilldawn.test',login:'administration',allowed:['/portals/administration','/portals/administration/personnel'],denied:['/admin','/god-mode']},
 {role:'promotion',email:'e2e-promotion@uptilldawn.test',login:'promotion',allowed:['/portals/promotion','/portals/promotion/staff'],denied:['/admin','/portals/administration/finance','/god-mode']},
 {role:'responsible',email:'e2e-responsible@uptilldawn.test',login:'responsible',allowed:['/events','/chat'],denied:['/admin','/portals/administration/finance','/god-mode']},
 {role:'staff',email:'e2e-staff@uptilldawn.test',login:'staff',allowed:['/events','/tasks'],denied:['/admin','/portals/administration/finance','/god-mode']},
]
const locales=['nl','fr','en','de']
const viewports=[{width:390,height:844},{width:1280,height:800}]
const dir='test-results/seven-main-qa'
await mkdir(dir,{recursive:true})
const results=[]
const errors=[]
const browser=await chromium.launch({headless:true})
const timeout=40000
const url=path=>new URL(path,BASE).href

function scrub(error){
 // Never persist credentials, bearer tokens, login URLs or opaque session data.
 const value=String(error?.message||error||'unknown')
 return value.split(password).join('[redacted]').replace(/Bearer\s+[A-Za-z0-9._-]+/gi,'Bearer [redacted]').slice(0,380)
}
async function recordFailure(page,role,locale,viewport,step,error){
 const name=[role,locale,viewport.width,step].join('-').replace(/[^a-z0-9_-]/gi,'-')
 const screenshot=dir+'/'+name+'.png'
 await page.screenshot({path:screenshot,fullPage:true,timeout:10000}).catch(()=>{})
 const issue={role,locale,viewport:viewport.width,step,description:scrub(error),screenshot}
 errors.push(issue)
 console.error('FAIL '+JSON.stringify(issue))
}
async function goto(page,path){
 // Main's Next/RSC pages stream data after the document has committed.
 // Waiting for the entire browser load (or even DOMContentLoaded on a stalled
 // streaming response) gives false failures despite an already navigated page.
 const response=await page.goto(url(path),{waitUntil:'commit',timeout})
 await page.locator('body').waitFor({state:'visible',timeout:30000})
 return response
}
function mark(role,locale,viewport,step,path){
 results.push({role,locale,viewport:viewport.width,step,path})
 console.log('PASS '+role+' '+locale+' '+viewport.width+' '+step+' '+path)
}
async function assertAllowed(page,path,validPaths=[path]){
 const response=await goto(page,path)
 assert.ok(response&&response.status()<400,'HTTP error for '+path+': '+response?.status())
 // A rendered heading distinguishes the real page from a transient authenticated
 // shell. A long-lived skeleton is a legitimate failed acceptance test.
 // Channel chat uses a composer, not an h1; empty chat uses a heading.
 const ready=path==='/chat'?'section textarea, section h1'
  :path==='/portals/administration'?'[data-administration-overview-ready="true"] h1'
  :'h1,main h2'
 await page.locator(ready).first().waitFor({state:'visible',timeout:30000})
 if(path==='/portals/administration'){
  // A hidden h1 in a streamed Suspense template is not a functioning page:
  // require all seven canonical actionable priority rows as well.
  const actions=page.locator('[data-administration-overview-ready="true"] [data-administration-priority]')
  await actions.first().waitFor({state:'visible',timeout:30000})
  assert.equal(await actions.count(),7,'Administration work pulse lacks its seven canonical actions')
 }
 const actual=new URL(page.url()).pathname
 assert.ok(validPaths.includes(actual),'Unexpected portal redirect: '+path+' → '+actual)
 const content=(await page.locator('body').innerText()).trim()
 assert.ok(content.length>16,'Blank protected page')
 assert.doesNotMatch(content,/Application error: a server-side exception|The action could not be completed/i)
 if(page.viewportSize()?.width===390){
  const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth))
  assert.ok(overflow<=4,'Mobile horizontal overflow '+overflow+'px')
 }
 assert.ok(await page.locator('a[href],button').count()>0,'No interactive navigation or controls')
}
// Next.js streaming responses can show a temporary shell or throw ERR_ABORTED
// while redirecting an unauthorized request. Never classify a loading shell
// as privileged access, and never classify an incomplete navigation as denial.
async function assertDenied(page,path){
 const before=new URL(page.url()).pathname
 let response=null
 let requested=false
 let interrupted=false
 let requestedHttpStatus=null
 const onRequest=request=>{
  if(!request.isNavigationRequest())return
  try{if(new URL(request.url()).pathname===path)requested=true}catch{}
 }
 const onResponse=result=>{
  if(result.request().isNavigationRequest()&&new URL(result.url()).pathname===path)
   requestedHttpStatus=result.status()
 }
 page.on('request',onRequest)
 page.on('response',onResponse)
 try{
  try{
   response=await page.goto(url(path),{waitUntil:'commit',timeout})
  }catch(error){
   if(!/ERR_ABORTED|frame was detached|navigation interrupted/i.test(String(error)))throw error
   interrupted=true
  }
 }finally{
  page.off('request',onRequest)
  page.off('response',onResponse)
 }
 const status=requestedHttpStatus??response?.status()??0
 if(status>=500)throw Error('Protected URL returned HTTP '+status+' rather than a denial for '+path)
 if([401,403,404].includes(status))return
 if(!requested&&!response)throw Error('Protected URL request was never observed: '+path)
 // A 200 streaming shell is neither proof of privileged access nor denial.
 // Prefer a committed redirect over race-prone page.waitForFunction during RSC.
 if(new URL(page.url()).pathname===path){
  try{
   await page.waitForURL(target=>target.pathname!==path,{waitUntil:'commit',timeout:50000})
  }catch{
   // Explicit denial page on the original URL is also acceptable.
   const headings=await page.locator('h1,h2,[role="alert"]').allTextContents().catch(()=>[])
   if(!/not found|niet gevonden|geen toegang|no access|accès refusé|kein zugang|unauthorized|forbidden|access denied|404/i.test(headings.join(' ')))
    throw Error('No settled authorization denial for '+path+'; browser remained on '+new URL(page.url()).pathname)
  }
 }
 const actual=new URL(page.url()).pathname
 if(actual===path){
  const headings=await page.locator('h1,h2,[role="alert"]').allTextContents()
  assert.match(headings.join(' '),/not found|niet gevonden|geen toegang|no access|accès refusé|kein zugang|unauthorized|forbidden|access denied|404/i)
  return
 }
 // A lost login session is not a successful role isolation check.
 if(actual==='/login'||actual.startsWith('/login/'))
  throw Error('QA login session lost while checking forbidden route '+path)
 // Explicitly enumerate the known safe destinations for server redirects.
 assert.ok(['/','/events','/portals','/unauthorized'].includes(actual),
  'Forbidden route redirected to an unexpected destination: '+path+' → '+actual)
 if(interrupted&&actual===before&&!([301,302,303,307,308].includes(status)))
  throw Error('Aborted navigation had no confirmed server redirect: '+path)
}
// Real read-only click acceptance, over and above direct URL checks.
// Reuse the seven isolated QA identities; do not create additional bots,
// access Maker/production or submit draft, contract or payment mutations.
async function assertAdministrationClickWorkflows(page,role,locale,viewport){
 await assertAllowed(page,'/portals/administration')
 const buttons=page.locator('nav [data-administration-category]')
 await buttons.first().waitFor({state:'visible',timeout:25000})
 const actualGroups=await buttons.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-administration-category')))
 assert.deepEqual(actualGroups,administrationNavigationGroups.map(group=>group.key),
  'Administration is missing or duplicating navigation categories')
 const pulse=page.locator('[data-administration-overview-ready="true"]')
 const priorities=await pulse.locator('[data-administration-priority]').evaluateAll(nodes=>
  nodes.map(node=>({key:node.getAttribute('data-administration-priority'),href:node.getAttribute('href')})))
 assert.equal(priorities.length,7,'Administration primary work pulse must have seven actionable priorities')
 assert.equal(new Set(priorities.map(row=>row.key)).size,7,'Duplicate primary work actions')
 assert.equal(new Set(priorities.map(row=>row.href)).size,7,'Duplicate destinations in work pulse')
 assert.ok(priorities.every(row=>row.href?.startsWith('/portals/administration/')),
  'Overview priority opens a different portal')
 mark(role,locale,viewport,'administration-primary-actions','/portals/administration')

 for(const group of administrationNavigationGroups.filter(group=>group.key!=='overview')){
  const button=page.locator('nav [data-administration-category="'+group.key+'"]')
  await button.click()
  const region=page.locator('#administration-subtabs')
  await region.waitFor({state:'visible',timeout:15000})
  const found=await region.locator('[data-administration-subtab]').evaluateAll(nodes=>
   nodes.map(node=>({slug:node.getAttribute('data-administration-subtab'),href:node.getAttribute('href')})))
  const expected=group.slugs.filter(slug=>slug!=='promotion-discipline'||role==='head_admin')
  assert.deepEqual(found.map(entry=>entry.slug),expected,'Wrong or duplicate subtab in '+group.key)
  assert.deepEqual(found.map(entry=>entry.href),expected.map(administrationRoute),
   'Subtab targets must use their existing canonical pages')
  await button.click()
  await region.waitFor({state:'detached',timeout:15000})
  mark(role,locale,viewport,'administration-toggle-'+group.key,'/portals/administration')
 }

 for(const {category,slug} of [
  {category:'finance',slug:'banking'},
  {category:'planning',slug:'events'},
  {category:'planning',slug:'contracts'},
 ]){
  await page.locator('nav [data-administration-category="'+category+'"]').click()
  const link=page.locator('[data-administration-subtab="'+slug+'"]')
  await link.waitFor({state:'visible',timeout:15000})
  const href=await link.getAttribute('href')
  assert.equal(href,administrationRoute(slug),'Incorrect '+slug+' subtab destination')
  await Promise.all([
   page.waitForURL(target=>target.pathname===href,{waitUntil:'commit',timeout:40000}),
   link.click({noWaitAfter:true,timeout:20000}),
  ])
  await page.locator('#administration-subtabs').waitFor({state:'detached',timeout:15000})
  await page.locator('main h1').first().waitFor({state:'visible',timeout:30000})
  assert.equal(new URL(page.url()).pathname,href,'Subtab click did not reach its page')
  const text=(await page.locator('main').first().innerText()).trim()
  assert.ok(text.length>24&&!/Application error: a server-side exception/i.test(text),
   'Clicked Administration subtab failed to render')
  mark(role,locale,viewport,'administration-click-'+slug,href)

  if(slug==='events'){
   const draft=page.locator('#administration-event-draft')
   await draft.waitFor({state:'visible',timeout:15000})
   if(!(await draft.evaluate(node=>node.hasAttribute('open'))))await draft.locator('summary').click()
   await draft.locator('form input[name="name"]').waitFor({state:'visible',timeout:10000})
   assert.equal(await draft.locator('form input[name="start_at"]').count(),1,'Event start date field missing')
   assert.equal(await draft.locator('form input[name="end_at"]').count(),1,'Event end date field missing')
   assert.equal(await draft.locator('form button[type="submit"]').count(),1,'Event draft save action missing')
   mark(role,locale,viewport,'administration-event-draft-form',href)
  }
  if(slug==='contracts'){
   const create=page.locator('a[href="/portals/administration/modules/artists/new?contract=1"]')
   await create.waitFor({state:'visible',timeout:15000})
   await Promise.all([
    page.waitForURL(target=>target.pathname==='/portals/administration/modules/artists/new'
     &&target.searchParams.get('contract')==='1',{waitUntil:'commit',timeout:40000}),
    create.click({noWaitAfter:true,timeout:20000}),
   ])
   // The app shell and the Administration page each render a nested <main>.
   // Target only the innermost page content, never an ambiguous global locator.
   const contentMain=page.locator('main').last()
   await contentMain.locator('h1').first().waitFor({state:'visible',timeout:30000})
   const bookingForm=contentMain.locator('form').first()
   const exists=await bookingForm.count()
   if(exists){
    await bookingForm.locator('input[name="artist_name"]').waitFor({state:'visible',timeout:10000})
    assert.equal(await bookingForm.locator('select[name="event_id"]').count(),1,
     'Contract creation form has no event selection')
    assert.equal(await bookingForm.locator('input[name="contract_context"][value="1"]').count(),1,
     'Contract creation lost its contract-draft context')
    mark(role,locale,viewport,'administration-contract-create-form',
     '/portals/administration/modules/artists/new?contract=1')
   }else{
    // A legitimate empty event catalogue requires creating an event first.
    // Verify that the app explains the dependency instead of showing a blank page.
    const notice=(await contentMain.innerText()).toLowerCase()
    assert.match(notice,/maak eerst een evenement|créez d’abord un événement|create an event first|erstellen sie zuerst eine veranstaltung/,
     'Contract creation is blocked without an actionable prerequisite message')
    mark(role,locale,viewport,'administration-contract-prerequisite-visible',
     '/portals/administration/modules/artists/new?contract=1')
   }
  }
  const home=page.locator('nav [data-administration-category="overview"]')
  await Promise.all([
   page.waitForURL(target=>target.pathname==='/portals/administration',{waitUntil:'commit',timeout:40000}),
   home.click({timeout:20000}),
  ])
  await page.locator('[data-administration-overview-ready="true"] h1').waitFor({state:'visible',timeout:30000})
  mark(role,locale,viewport,'administration-return-overview','/portals/administration')
 }
}

try{
 for(const [index,role] of roles.entries()){
  for(const [i,viewport] of viewports.entries()){
   // Rotate locales across the independent sessions: all four are exercised,
   // while keeping opt-in Main QA fast and avoiding 56 redundant logins.
   const locale=locales[(index+i)%locales.length]
   const context=await browser.newContext({locale,viewport,reducedMotion:'reduce'})
   const page=await context.newPage()
   const browserErrors=[]
   page.on('pageerror',error=>browserErrors.push(scrub(error)))
   try{
    let signedIn=false
    for(let attempt=1;attempt<=2&&!signedIn;attempt++){
     await goto(page,'/login/'+role.login)
     await page.locator('form[data-login-hydrated="true"]').waitFor({state:'attached',timeout})
     await page.locator('#email').fill(role.email)
     await page.locator('#password').fill(password)
     const alert=page.locator('[data-login-error-code]')
     try{
      // A failed Server Action can leave the form visible with a clear error.
      // Wait for the first *settled* outcome, not only a navigation timeout.
      const outcomePromise=Promise.race([
       page.waitForURL(target=>!target.pathname.startsWith('/login'),{waitUntil:'commit',timeout:40000})
        .then(()=>({type:'redirect'})),
       alert.waitFor({state:'visible',timeout:40000}).then(()=>({type:'error'})),
      ])
      await page.locator('button[type="submit"]').click()
      const outcome=await outcomePromise
      if(outcome.type==='redirect'){
       signedIn=true
       if(attempt===2)console.warn('QA_RECOVERED_TRANSIENT_LOGIN '+role.role+' '+locale+' '+viewport.width)
       continue
      }
      const code=await alert.getAttribute('data-login-error-code')
      const message=(await alert.innerText()).trim().slice(0,160)
      if(code!=='unexpected_action_failure'||attempt===2)
       throw Error('Login rejected for '+role.role+'; code='+code+'; message='+message)
      // A transient server-action exception is the sole case eligible for
      // one fresh-page retry. It is reported, never silently treated as PASS.
      console.warn('QA_RETRY_TRANSIENT_LOGIN '+role.role+' '+locale+' '+viewport.width)
     }catch(error){
      throw Error('Login navigation failed for '+role.role+'; '+scrub(error))
     }
    }
    assert.ok(signedIn,'Login did not settle as authenticated')
    assert.ok(!new URL(page.url()).pathname.startsWith('/login'),'Login did not complete')
    // Never expose cookie values. Missing SSR cookies explain login loops.
    const cookieNames=(await context.cookies(BASE)).map(cookie=>cookie.name)
    assert.ok(cookieNames.some(name=>/^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i.test(name)),
     'Login redirect completed but browser has no Supabase SSR authentication cookie')
    mark(role.role,locale,viewport,'authenticated',new URL(page.url()).pathname)
    const htmlLocale=(await page.locator('html').getAttribute('lang')||'').split('-')[0]
    assert.equal(htmlLocale,locale,'App language mismatch')
    for(const path of role.allowed){
     try{
      // Without a live assignment, the Tasks route deliberately redirects
      // ordinary Staff to Events. Test that exact documented fallback only.
      const acceptedPaths=role.role==='staff'&&path==='/tasks'?['/tasks','/events']:[path]
      await assertAllowed(page,path,acceptedPaths)
      mark(role.role,locale,viewport,'allowed',path)
     }catch(error){await recordFailure(page,role.role,locale,viewport,'allow-'+path,error)}
    }
    if(role.role==='head_admin'||role.role==='administration'){
     try{
      await assertAdministrationClickWorkflows(page,role.role,locale,viewport)
     }catch(error){
      await recordFailure(page,role.role,locale,viewport,'administration-click-workflows',error)
     }
    }
    for(const path of role.denied){
     try{
      await assertDenied(page,path)
      mark(role.role,locale,viewport,'denied',path)
     }catch(error){await recordFailure(page,role.role,locale,viewport,'deny-'+path,error)}
    }
    if(browserErrors.length)throw Error('Browser runtime exceptions: '+browserErrors.slice(0,3).join('; '))
   }catch(error){
    await recordFailure(page,role.role,locale,viewport,'login-or-runtime',error)
   }finally{
    await context.close()
   }
  }
 }
}finally{
 await browser.close()
 const report={
  run_type:'explicit-main-only-browser-qa',
  target:BASE,
  scope:'14 separate sessions: 7 operational roles × 2 responsive viewports; locales rotated NL/FR/EN/DE; login, route access/denial plus real Administration category, subtab, event-draft and contract-create navigation (read-only)',
  roles:roles.map(r=>r.role),locales,viewports,
  passed:results.length,failed:errors.length,results,errors,
  limitations:'Not Maker; not production; creation forms are inspected but never submitted; no actual event, contract, payment, notification, provider or destructive E2E. Login may write expected Supabase sessions and login audit.'
 }
 await writeFile(dir+'/report.json',JSON.stringify(report,null,2)+'\n')
 console.log('QA MAIN BROWSER RESULT: '+JSON.stringify({roles:roles.length,sessions:roles.length*viewports.length,passed:results.length,failed:errors.length}))
}
if(errors.length)process.exitCode=1
