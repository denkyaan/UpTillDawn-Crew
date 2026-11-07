// Local app smoke test using five isolated accounts in the configured main test DB.
import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
import {createClient} from '@supabase/supabase-js'

const base=process.env.BOT_TEST_BASE_URL??'http://127.0.0.1:3000'
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Use a local application')
assert.ok(process.env.UPT_QA_FIXTURE_PATH,'UPT_QA_FIXTURE_PATH is required')
const fixture=JSON.parse(await readFile(process.env.UPT_QA_FIXTURE_PATH,'utf8'))
assert.equal(new URL(fixture.supabaseUrl).hostname,'npbjrtiolqperdgljnhi.supabase.co','Use the main test database')
const shared=['/','/events','/workplaces','/briefings','/tasks','/timesheets','/chat','/notifications','/incidents']
const modules=['events','artists','contracts','staff','invoices','banking','ticketing','inventory','logistics','contacts','sponsors','marketing','permits','documents','tasks','reports','notifications','automations','ai','settings']
const office=['/portals/administration','/portals/administration/finance','/portals/administration/counterparties','/portals/administration/rosters','/portals/administration/personnel','/portals/administration/contacts','/portals/administration/chat','/portals/administration/profile','/portals/administration/promotion-tasks',...modules.map(slug=>'/portals/administration/modules/'+slug),'/portals/administration/counterparties?page=2&q=QA&kind=supplier','/portals/administration/promotion-tasks?page=2','/portals/administration/modules/notifications?page=2']
const routes={admin:[...shared,'/admin','/admin/management','/admin/management/promotion-tasks',...office],responsible:shared,staff:shared,administration:office,promotion:['/portals/promotion','/portals/promotion/tasks','/portals/promotion/staff','/portals/promotion/chat','/portals/promotion/tasks?page=2']}
const locales={admin:'nl',responsible:'fr',staff:'en',administration:'de',promotion:'nl'}
const checks=[],failures=[]
await mkdir('test-results/platform-smoke',{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium'})
try{
 for(const user of fixture.users){
  const db=createClient(fixture.supabaseUrl,fixture.anonKey,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data,error}=await db.auth.signInWithPassword({email:user.email,password:fixture.password})
  assert.equal(error,null,user.role+' authentication failed')
  assert.ok(data.session)
  const context=await browser.newContext({viewport:{width:390,height:844},locale:locales[user.role]})
  try{
   const response=await context.request.post(base+'/api/test-auth-session',{data:{access_token:data.session.access_token,refresh_token:data.session.refresh_token}})
   assert.equal(response.status(),200,user.role+' session bridge')
   const page=await context.newPage()
   for(const route of routes[user.role]){
    const errors=[]
    const onError=error=>errors.push(error.message)
    page.on('pageerror',onError)
    try{
     const response=await page.goto(base+route,{waitUntil:'load',timeout:30000})
     assert.ok(response&&response.status()<400,route+' HTTP '+response?.status())
     await page.locator('main').first().waitFor({state:'visible',timeout:15000})
     const actual=new URL(page.url())
     const body=await page.locator('body').innerText()
     assert.ok(!/application error|internal server error|this page could not be found|er ging iets mis|something went wrong/i.test(body),route+' error screen')
     assert.notEqual(actual.pathname,'/login',route+' lost authentication')
     if(route.startsWith('/portals/'))assert.equal(actual.pathname,new URL(base+route).pathname,'Cross-portal redirect')
     if(route.includes('page=2'))assert.match(body,/\b(?:Pagina|Page|Seite)\s+2\b/,'Page 2 was ignored')
     assert.equal(errors.length,0,errors.join('; '))
     checks.push({role:user.role,route,status:response.status(),actual:actual.pathname+actual.search})
     console.log('PASS',user.role,route)
    }catch(error){
     failures.push({role:user.role,route,message:error.message})
     console.error('FAIL',user.role,route,error.message)
     await page.screenshot({path:'test-results/platform-smoke/'+user.role+'-'+failures.length+'.png',fullPage:true}).catch(()=>{})
    }finally{page.off('pageerror',onError)}
   }
   // Verify a real cross-portal denial instead of counting a login redirect as success.
   if(['staff','responsible','promotion'].includes(user.role)){
    await page.goto(base+'/portals/administration/finance',{waitUntil:'load'})
    assert.notEqual(new URL(page.url()).pathname,'/portals/administration/finance',user.role+' gained Administration access')
    checks.push({role:user.role,denied:'/portals/administration/finance'})
   }
  }finally{await context.close();await db.auth.signOut()}
 }
}finally{
 await browser.close()
 await writeFile('test-results/platform-smoke/result.json',JSON.stringify({checks,failures},null,2))
}
console.log(JSON.stringify({passed:checks.length,failed:failures.length}))
if(failures.length)process.exitCode=1
