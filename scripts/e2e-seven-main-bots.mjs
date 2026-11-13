// Explicit opt-in real-browser QA for seven operational roles on isolated Main.
// No product data mutations. Does NOT impersonate Maker, touch production,
// change passwords, or exercise payments and third-party providers.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'

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
 const response=await page.goto(url(path),{waitUntil:'domcontentloaded',timeout})
 await page.locator('body').waitFor({state:'visible',timeout:15000})
 await page.waitForTimeout(800)
 return response
}
function mark(role,locale,viewport,step,path){
 results.push({role,locale,viewport:viewport.width,step,path})
 console.log('PASS '+role+' '+locale+' '+viewport.width+' '+step+' '+path)
}
async function assertAllowed(page,path){
 const response=await goto(page,path)
 assert.ok(response&&response.status()<400,'HTTP error for '+path+': '+response?.status())
 assert.equal(new URL(page.url()).pathname,path,'Unexpected portal redirect')
 const content=(await page.locator('body').innerText()).trim()
 assert.ok(content.length>16,'Blank protected page')
 assert.doesNotMatch(content,/Application error: a server-side exception|The action could not be completed/i)
 if(page.viewportSize()?.width===390){
  const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth))
  assert.ok(overflow<=4,'Mobile horizontal overflow '+overflow+'px')
 }
 assert.ok(await page.locator('a[href],button').count()>0,'No interactive navigation or controls')
}
async function assertDenied(page,path){
 const response=await goto(page,path)
 const actual=new URL(page.url()).pathname
 const content=(await page.locator('body').innerText()).toLowerCase()
 const blocked=(response?.status()||0)>=400||actual!==path||/not found|niet gevonden|geen toegang|no access|accès refusé|kein zugang|unauthorized|forbidden|404/.test(content)
 assert.ok(blocked,'Forbidden role could access protected URL '+path)
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
    await goto(page,'/login/'+role.login)
    await page.locator('form[data-login-hydrated="true"]').waitFor({state:'attached',timeout})
    await page.locator('#email').fill(role.email)
    await page.locator('#password').fill(password)
    await Promise.all([
     page.waitForURL(target=>!target.pathname.startsWith('/login'),{timeout}),
     page.locator('button[type="submit"]').click(),
    ])
    assert.ok(!new URL(page.url()).pathname.startsWith('/login'),'Login did not complete')
    mark(role.role,locale,viewport,'authenticated',new URL(page.url()).pathname)
    const htmlLocale=(await page.locator('html').getAttribute('lang')||'').split('-')[0]
    assert.equal(htmlLocale,locale,'App language mismatch')
    for(const path of role.allowed){
     try{
      await assertAllowed(page,path)
      mark(role.role,locale,viewport,'allowed',path)
     }catch(error){await recordFailure(page,role.role,locale,viewport,'allow-'+path,error)}
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
  scope:'14 separate sessions: 7 operational roles × 2 responsive viewports; locales rotated across NL/FR/EN/DE; role route access and denial only',
  roles:roles.map(r=>r.role),locales,viewports,
  passed:results.length,failed:errors.length,results,errors,
  limitations:'Not Maker; not production; no payment, events, notification, provider or destructive E2E. Login may write expected Supabase sessions and login audit.'
 }
 await writeFile(dir+'/report.json',JSON.stringify(report,null,2)+'\n')
 console.log('QA MAIN BROWSER RESULT: '+JSON.stringify({roles:roles.length,sessions:roles.length*viewports.length,passed:results.length,failed:errors.length}))
}
if(errors.length)process.exitCode=1
