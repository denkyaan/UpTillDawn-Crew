// Read-only authenticated acceptance runner for all six product roles.
// This is NOT run by CI main without dedicated QA accounts. It never grants
// roles, modifies production data, or invokes mutation buttons.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'

const MATRIX=[
 {role:'admin',login:'admin',routes:['/admin','/events','/personnel','/chat','/operations','/settings','/portals/administration/finance'],denied:[]},
 {role:'administration',login:'administration',routes:['/portals/administration','/portals/administration/finance','/portals/administration/chat','/portals/administration/promotion-tasks'],denied:['/admin','/god-mode']},
 {role:'promotion',login:'promotion',routes:['/portals/promotion','/portals/promotion/chats','/portals/promotion/staff','/portals/promotion/tasks'],denied:['/admin','/portals/administration/finance','/god-mode']},
 {role:'staff',login:'staff',routes:['/events','/tasks','/chat','/workplaces'],denied:['/admin','/portals/administration/finance','/god-mode']},
 {role:'responsible',login:'responsible',routes:['/events','/workplaces','/chat','/operations'],denied:['/admin','/portals/administration/finance','/god-mode']},
 {role:'maker',login:'admin',routes:['/maker-mode'],denied:[]},
]
const LOCALES=['nl','fr','en','de']
const VIEWPORTS=[{width:390,height:844},{width:1280,height:800}]
const required=['E2E_BASE_URL',...MATRIX.flatMap(({role})=>['E2E_'+role.toUpperCase()+'_EMAIL','E2E_'+role.toUpperCase()+'_PASSWORD'])]
const missing=required.filter(key=>!process.env[key])
if(missing.length){
 console.error('BLOCKED: six-role browser acceptance requires QA configuration: '+missing.join(', '))
 process.exit(2)
}

const base=new URL(process.env.E2E_BASE_URL)
const local=['localhost','127.0.0.1'].includes(base.hostname)
const main=base.hostname==='uptilldawn-main.uptilldawn.workers.dev'
if(base.pathname!=='/'||base.search||base.hash||(!local&&!main)||(main&&process.env.E2E_ALLOW_MAIN_TEST!=='1')){
 throw Error('E2E target must be localhost or explicitly approved main-test; production is forbidden')
}
const records=[]
const failures=[]
await mkdir('test-results/final-acceptance',{recursive:true})
const browser=await chromium.launch({headless:true})
const timeOut=45000
function safeFile(value){return value.replace(/[^a-z0-9_-]/gi,'-').slice(0,100)}
const addFailure=async(page,meta,error)=>{
 const message=error instanceof Error?error.message:String(error)
 const screenshot='test-results/final-acceptance/'+safeFile([meta.role,meta.locale,meta.width,meta.step].join('-'))+'.png'
 await page.screenshot({path:screenshot,fullPage:true,timeout:12000}).catch(()=>{})
 failures.push({...meta,message,screenshot})
 console.error('FAIL '+meta.role+' '+meta.locale+' '+meta.width+' '+meta.step+': '+message)
}
async function settledRoute(page,pathname){
 const response=await page.goto(new URL(pathname,base).href,{waitUntil:'domcontentloaded',timeout:timeOut})
 await page.locator('body').waitFor({state:'visible',timeout:timeOut})
 await page.waitForLoadState('domcontentloaded')
 // RSC authorization and metadata may render after the initial HTTP document.
 await page.waitForTimeout(450)
 const actual=new URL(page.url()).pathname
 assert.ok(response&&response.status()<400,'HTTP failure '+response?.status()+' on '+pathname)
 assert.equal(actual,pathname,'Unexpected redirect: '+pathname+' → '+actual)
 const body=(await page.locator('body').innerText()).trim()
 assert.ok(body.length>=12,'Blank route: '+pathname)
 assert.doesNotMatch(body,/The action could not be completed|Application error: a server-side exception/i)
 if(page.viewportSize()?.width===390){
  const extra=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth))
  assert.ok(extra<=4,'Whole-page horizontal overflow: '+extra+'px on '+pathname)
 }
 const clickables=await page.locator('a[href],button').count()
 assert.ok(clickables>0,'No accessible controls on '+pathname)
 return {path:pathname,actual,clickables,bodyLength:body.length}
}
async function expectDenied(page,pathname){
 let response
 try{response=await page.goto(new URL(pathname,base).href,{waitUntil:'domcontentloaded',timeout:timeOut})}
 catch(error){if(!/ERR_ABORTED|interrupted/i.test(String(error)))throw error}
 await page.waitForFunction(expected=>{
  const path=window.location.pathname
  if(path!==expected)return true
  const content=(document.body?.innerText||'').toLowerCase()
  return /not found|niet gevonden|geen toegang|no access|accès refusé|kein zugang|unauthorized|forbidden|404/.test(content)
 },pathname,{timeout:15000})
 const actual=new URL(page.url()).pathname
 return {path:pathname,denied:true,actual,http:response?.status()??null}
}
try{
 for(const config of MATRIX){
  const role=config.role
  const email=process.env['E2E_'+role.toUpperCase()+'_EMAIL']
  const password=process.env['E2E_'+role.toUpperCase()+'_PASSWORD']
  for(const locale of LOCALES){
   for(const viewport of VIEWPORTS){
    const meta={role,locale,width:viewport.width}
    const context=await browser.newContext({locale,viewport,acceptDownloads:true,reducedMotion:'reduce'})
    const page=await context.newPage()
    const jsErrors=[]
    page.on('pageerror',error=>jsErrors.push(String(error?.message??error)))
    try{
     const login='/login/'+config.login
     await page.goto(new URL(login,base).href,{waitUntil:'domcontentloaded',timeout:timeOut})
     await page.locator('#email').fill(email)
     await page.locator('#password').fill(password)
     await Promise.all([
      page.waitForURL(url=>!url.pathname.startsWith('/login'),{timeout:timeOut}),
      page.locator('button[type="submit"]').click(),
     ])
     records.push({...meta,step:'authenticated',actual:new URL(page.url()).pathname})
     for(const pathname of config.routes){
      try{
       const result=await settledRoute(page,pathname)
       records.push({...meta,step:'route',...result})
       console.log('PASS '+role+' '+locale+' '+viewport.width+' '+pathname)
      }catch(error){await addFailure(page,{...meta,step:'route-'+pathname},error)}
     }
     for(const pathname of config.denied){
      try{
       const result=await expectDenied(page,pathname)
       records.push({...meta,step:'deny',...result})
       console.log('PASS DENY '+role+' '+locale+' '+pathname)
      }catch(error){await addFailure(page,{...meta,step:'deny-'+pathname},error)}
     }
     if(jsErrors.length)throw Error('Browser exceptions: '+jsErrors.slice(0,5).join('; '))
    }catch(error){await addFailure(page,{...meta,step:'login-or-runtime'},error)}
    finally{await context.close()}
   }
  }
 }
}finally{
 await browser.close()
 const report={
  source:'authenticated-browser',
  target:base.origin,
  roles:MATRIX.map(entry=>entry.role),
  locales:LOCALES,
  viewports:VIEWPORTS,
  checks:records.length,
  failed:failures.length,
  note:'Read-only login/navigation/denial/responsive acceptance. Mutating event, payments, OCR, push, Peppol and provider integrations require separate sandbox acceptance.',
  records,failures,
 }
 await writeFile('test-results/final-acceptance/report.json',JSON.stringify(report,null,2)+'\n')
 console.log(JSON.stringify({checks:records.length,failed:failures.length,roles:MATRIX.length,locales:LOCALES.length,viewports:VIEWPORTS.length}))
}
if(failures.length)process.exitCode=1
