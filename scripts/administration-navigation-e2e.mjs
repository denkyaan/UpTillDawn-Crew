import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {createClient} from '@supabase/supabase-js'
import {chromium} from 'playwright'

const base=process.env.BOT_TEST_BASE_URL||'http://127.0.0.1:3000'
const url=process.env.BOT_SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,password=process.env.BOT_TEST_PASSWORD
if(!url||!key||!password)throw Error('Missing isolated browser credentials')
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname)||!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw Error('Navigation E2E requires isolated local services')
const groups={planning:['events','artists','contracts','staff','tasks','rosters'],finance:['finance','invoices','banking','ticketing','reports'],operations:['inventory','logistics','documents','permits'],relations:['personnel','chat','contacts','sponsors','marketing'],management:['notifications','automations','ai','promotion-discipline','settings']}
const checks=[],failures=[]
await mkdir('test-results/administration-navigation',{recursive:true})
const browser=await chromium.launch({headless:true})
try{
 for(const role of [{name:'Admin',email:'bot-01-admin-nl@bots.uptilldawn.test'},{name:'Administration',email:'bot-04-staff-de@bots.uptilldawn.test'}]){
  const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data,error}=await auth.auth.signInWithPassword({email:role.email,password})
  if(error||!data.session)throw Error(role.name+' login failed: '+error?.message)
  for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
   const context=await browser.newContext({viewport,locale:'en'})
   await context.addInitScript(()=>{localStorage.setItem('uptilldawn-admin-selection-v1',JSON.stringify({eventId:'00000000-0000-4000-8000-00000000e2e1',workplaceId:null,userId:null,shiftId:null,focus:null}));sessionStorage.setItem('uptilldawn-return-after-login','/events')})
   const page=await context.newPage(),errors=[]
   page.on('pageerror',error=>errors.push(error.message))
   try{
    const session=await context.request.post(base+'/api/test-auth-session',{data:{access_token:data.session.access_token,refresh_token:data.session.refresh_token}})
    assert.equal(session.status(),200)
    const response=await page.goto(base+'/portals/administration',{waitUntil:'networkidle'})
    assert.equal(response.status(),200)
    for(const [category,slugs] of Object.entries(groups)){
     const available=slugs.filter(slug=>slug!=='promotion-discipline'||role.name==='Admin')
     const targets=viewport.width<1000?available:[available[0],available.at(-1)]
     for(const slug of targets){
      await page.locator(`[data-administration-category="${category}"]`).click()
      const link=page.locator(`[data-administration-subtab="${slug}"]`)
      const target=await link.getAttribute('href')
      assert.ok(target.startsWith('/portals/administration/'))
      const documentRequest=page.waitForRequest(request=>request.isNavigationRequest()&&request.resourceType()==='document'&&new URL(request.url()).pathname===target)
      await link.click()
      await documentRequest
      await page.waitForURL(u=>u.pathname===target,{timeout:30000})
      await page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{})
      assert.equal(await page.locator(`[data-administration-category="${category}"]`).getAttribute('aria-pressed'),'true',slug+' lost its category')
      assert.equal(await page.locator(`[data-administration-subtab="${slug}"]`).getAttribute('aria-current'),'page',slug+' lost active subtab')
      assert.equal(await page.locator('[data-layout-key]').count(),0,slug+' rendered personnel navigation')
      assert.ok(!/application error|internal server error|this page could not be found/i.test(await page.locator('body').innerText()))
      checks.push({role:role.name,width:viewport.width,category,slug,path:new URL(page.url()).pathname})
     }
    }
    const header=page.locator('header').first()
    await header.locator('a[href="/portals/administration/modules/notifications"]').click()
    await page.waitForURL('**/portals/administration/modules/notifications')
    // The profile link is visible at desktop width; both dedicated routes must keep the shell.
    if(viewport.width>=1000){
     await header.locator('a[href="/portals/administration/profile"]').click()
     await page.waitForURL('**/portals/administration/profile')
    }
    await header.locator('a[href="/portals/administration"]').click()
    await page.waitForURL('**/portals/administration')
    assert.deepEqual(errors,[],role.name+' uncaught browser errors')
    console.log('PASS administration navigation:',role.name,viewport.width)
   }catch(error){
    failures.push({role:role.name,width:viewport.width,path:page.url(),error:String(error.message||error)})
    await page.screenshot({path:`test-results/administration-navigation/${role.name}-${viewport.width}.png`,fullPage:true}).catch(()=>{})
   }finally{await context.close()}
  }
 }
 const loginContext=await browser.newContext({viewport:{width:390,height:844},locale:'en'})
 try{
  const loginPage=await loginContext.newPage()
  await loginPage.goto(base+'/login/administration',{waitUntil:'networkidle'})
  await loginPage.locator('input[name="email"]').fill('bot-01-admin-nl@bots.uptilldawn.test')
  await loginPage.locator('input[name="password"]').fill(password)
  await loginPage.locator('button[type="submit"]').click()
  await loginPage.waitForURL('**/portals/administration',{timeout:30000})
  assert.equal(new URL(loginPage.url()).pathname,'/portals/administration')
  checks.push({role:'Admin real login',path:'/portals/administration'})
  console.log('PASS administration sign-in through the real login form')
 }catch(error){failures.push({role:'Admin real login',error:String(error.message||error)})}
 finally{await loginContext.close()}
}finally{await browser.close()}
await writeFile('test-results/administration-navigation/result.json',JSON.stringify({checks,failures},null,2))
console.log(JSON.stringify({clicks:checks.length,failures},null,2))
if(failures.length)process.exitCode=1
