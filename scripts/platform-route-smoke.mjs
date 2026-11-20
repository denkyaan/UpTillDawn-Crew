// Local app smoke test using five isolated accounts in the configured main test DB.
import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
import {createClient} from '@supabase/supabase-js'
import {gotoReady,browserTimeoutMs} from './browser-navigation.mjs'

const base=process.env.BOT_TEST_BASE_URL??'http://127.0.0.1:3000'
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Use a local application')
assert.ok(process.env.UPT_QA_FIXTURE_PATH,'UPT_QA_FIXTURE_PATH is required')
const fixture=JSON.parse(await readFile(process.env.UPT_QA_FIXTURE_PATH,'utf8'))
assert.equal(new URL(fixture.supabaseUrl).hostname,'npbjrtiolqperdgljnhi.supabase.co','Use the main test database')
const shared=['/','/events','/workplaces','/briefings','/tasks','/timesheets','/chat','/notifications','/incidents']
const modules=['events','artists','contracts','staff','invoices','banking','ticketing','inventory','logistics','contacts','sponsors','marketing','permits','documents','tasks','reports','notifications','automations','ai','settings']
const office=['/portals/administration','/portals/administration/finance','/portals/administration/counterparties','/portals/administration/rosters','/portals/administration/personnel','/portals/administration/contacts','/portals/administration/chat','/portals/administration/profile','/portals/administration/promotion-tasks',...modules.map(slug=>'/portals/administration/modules/'+slug),'/portals/administration/counterparties?page=2&q=QA&kind=supplier','/portals/administration/promotion-tasks?page=2','/portals/administration/modules/notifications?page=2']
const routes={admin:[...shared,'/admin','/admin/management','/admin/management/promotion-tasks',...office],responsible:shared,staff:shared,administration:office,promotion:['/portals/promotion','/portals/promotion/tasks','/portals/promotion/staff','/portals/promotion/chats','/portals/promotion/tasks?page=2']}
const locales={admin:'nl',responsible:'fr',staff:'en',administration:'de',promotion:'nl'}
const translatedRoutes={administration:['/portals/administration','/portals/administration/modules/ticketing','/portals/administration/modules/banking','/portals/administration/modules/inventory','/portals/administration/modules/permits','/portals/administration/modules/automations'],promotion:['/portals/promotion','/portals/promotion/tasks']}
const previous=process.env.UPT_BROWSER_RESUME_RESULT?JSON.parse(await readFile(process.env.UPT_BROWSER_RESUME_RESULT,'utf8')):null
const checks=[...(previous?.checks??[])],failures=[]
const completed=new Set(checks.map(check=>[check.role,check.locale,check.route??'denied:'+check.denied].join('|')))
const requestedConcurrency=Number(process.env.UPT_BROWSER_CONCURRENCY??3)
const concurrency=Number.isInteger(requestedConcurrency)&&requestedConcurrency>=1&&requestedConcurrency<=3?requestedConcurrency:3
await mkdir('test-results/platform-smoke',{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium'})
try{
 for(const user of fixture.users){
  const db=createClient(fixture.supabaseUrl,fixture.anonKey,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data,error}=await db.auth.signInWithPassword({email:user.email,password:fixture.password})
  assert.equal(error,null,user.role+' authentication failed')
  assert.ok(data.session)
  const roleLocales=translatedRoutes[user.role]?[locales[user.role],...['nl','fr','en','de'].filter(locale=>locale!==locales[user.role])]:[locales[user.role]]
  try{
  for(const locale of roleLocales){
  const context=await browser.newContext({viewport:{width:390,height:844},locale,ignoreHTTPSErrors:process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS==='1'})
  context.setDefaultTimeout(browserTimeoutMs)
  try{
   const response=await context.request.post(base+'/api/test-auth-session',{data:{access_token:data.session.access_token,refresh_token:data.session.refresh_token},timeout:browserTimeoutMs})
   assert.equal(response.status(),200,user.role+' session bridge')
   const pending=[...(locale===locales[user.role]?routes[user.role]:translatedRoutes[user.role])].filter(route=>!completed.has([user.role,locale,route].join('|')))
   await Promise.all(Array.from({length:concurrency},async()=>{
    const page=await context.newPage()
    try{
    for(let route;(route=pending.shift())!==undefined;){
    const errors=[]
    const onError=error=>errors.push(error.message)
    page.on('pageerror',onError)
    try{
     const response=await gotoReady(page,base+route)
     assert.ok(response&&response.status()<400,route+' HTTP '+response?.status())
     await page.locator('main').first().waitFor({state:'visible',timeout:15000})
     await page.waitForFunction(()=>[...document.querySelectorAll('main')].some(element=>element.innerText.trim().length>0),undefined,{timeout:browserTimeoutMs})
     const actual=new URL(page.url())
     const body=await page.locator('body').innerText()
     assert.equal(await page.locator('html').getAttribute('lang'),locale,'Device language was not applied')
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Page overflows the mobile viewport')
     assert.ok(!/application error|internal server error|this page could not be found|er ging iets mis|something went wrong/i.test(body),route+' error screen')
     assert.notEqual(actual.pathname,'/login',route+' lost authentication')
     if(route.startsWith('/portals/'))assert.equal(actual.pathname,new URL(base+route).pathname,'Cross-portal redirect')
     if(route.includes('page=2'))assert.match(body,/\b(?:Pagina|Page|Seite)\s+2\b/,'Page 2 was ignored')
     if(user.role==='admin'&&route==='/chat'){
      const ai=page.getByRole('button',{name:'ADMIN AI',exact:true})
      await ai.waitFor({state:'visible',timeout:browserTimeoutMs})
      const composer=page.locator('textarea').first()
      await composer.scrollIntoViewIfNeeded()
      await composer.click({trial:true})
      const floating=await ai.boundingBox()
      for(const control of [composer,page.locator('[data-action="chat-send"]')]){
       const rect=await control.boundingBox()
       assert.ok(rect&&floating,'Chat controls were not visible')
       assert.ok(rect.x+rect.width<=floating.x||rect.x>=floating.x+floating.width||rect.y+rect.height<=floating.y||rect.y>=floating.y+floating.height,'Admin AI covers a chat input control')
      }
     }
     assert.equal(errors.length,0,errors.join('; '))
     checks.push({role:user.role,locale,route,status:response.status(),actual:actual.pathname+actual.search})
     console.log('PASS',user.role,locale,route)
    }catch(error){
     failures.push({role:user.role,locale,route,message:error.message})
     console.error('FAIL',user.role,locale,route,error.message)
     await page.screenshot({path:'test-results/platform-smoke/'+user.role+'-'+failures.length+'.png',fullPage:true}).catch(()=>{})
    }finally{page.off('pageerror',onError)}
    }
    }finally{await page.close()}
   }))
   // Verify a real cross-portal denial instead of counting a login redirect as success.
   if(['staff','responsible','promotion'].includes(user.role)&&!completed.has([user.role,locale,'denied:/portals/administration/finance'].join('|'))){
    const deniedPage=await context.newPage()
    try{
     await gotoReady(deniedPage,base+'/portals/administration/finance')
     await deniedPage.waitForURL(url=>url.pathname!=='/portals/administration/finance',{timeout:browserTimeoutMs})
     assert.notEqual(new URL(deniedPage.url()).pathname,'/portals/administration/finance',user.role+' gained Administration access')
     checks.push({role:user.role,locale,denied:'/portals/administration/finance'})
    }finally{await deniedPage.close()}
   }
  }finally{await context.close()}
  }
  }finally{await db.auth.signOut()}
 }
}finally{
 await browser.close()
 await writeFile('test-results/platform-smoke/result.json',JSON.stringify({fixtureEventId:fixture.eventId,checks,failures},null,2))
}
console.log(JSON.stringify({passed:checks.length,failed:failures.length}))
if(failures.length)process.exitCode=1
