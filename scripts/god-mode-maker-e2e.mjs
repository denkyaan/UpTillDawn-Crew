// Real Maker → God Mode journey on disposable, locally seeded Supabase.
// Only read-only God API requests; session creation and logout are expected.
// Never use this test on a remote Supabase project or deployed application.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {createClient} from '@supabase/supabase-js'
import {chromium} from 'playwright'

const base=process.env.BOT_TEST_BASE_URL
const supabase=process.env.BOT_SUPABASE_URL
const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const password=process.env.BOT_TEST_PASSWORD
if(base!=='http://127.0.0.1:3000'||supabase!=='http://127.0.0.1:54321'
 ||process.env.UPT_E2E_SESSION_BRIDGE!=='1'||!anonKey||!password){
 throw Error('God Mode browser E2E is strictly limited to the disposable local CI stack')
}
const out='test-results/god-mode-e2e'
await mkdir(out,{recursive:true})
const checks=[]
const failures=[]
const browser=await chromium.launch({headless:true})

async function actor(email,viewport){
 const auth=createClient(supabase,anonKey,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data,error}=await auth.auth.signInWithPassword({email,password})
 if(error||!data.session)throw Error('QA actor sign-in failed: '+(error?.message||'session missing'))
 const context=await browser.newContext({viewport,locale:'nl',reducedMotion:'reduce'})
 const response=await context.request.post(base+'/api/test-auth-session',{
  data:{access_token:data.session.access_token,refresh_token:data.session.refresh_token},
 })
 assert.equal(response.status(),200,'Isolated session bridge must authenticate')
 return {context,page:await context.newPage()}
}
function record(value){checks.push(value);console.log('PASS:',value)}
async function safeRequest(context,path){
 return context.request.get(base+path,{maxRedirects:0,timeout:20000})
}
async function verifyMaker(viewport){
 const maker=await actor('bot-16-maker@bots.uptilldawn.test',viewport)
 const tag='maker-'+viewport.width
 try{
  const {context,page}=maker
  assert.equal((await safeRequest(context,'/api/god/logs?environment=main&limit=3')).status(),401,'Maker account requires a separate God session')
  await page.goto(base+'/maker-mode',{waitUntil:'domcontentloaded',timeout:45000})
  await page.getByRole('heading',{name:'Kies je modus'}).waitFor({state:'visible',timeout:30000})
  await page.getByRole('button',{name:/Normale app/}).waitFor({state:'visible',timeout:30000})
  await page.getByRole('button',{name:/God Mode/}).waitFor({state:'visible',timeout:30000})
  await Promise.all([
   page.waitForURL(url=>url.pathname==='/admin',{timeout:30000}),
   page.getByRole('button',{name:/Normale app/}).click(),
  ])
  await page.getByRole('heading',{name:'Operationeel command center'}).waitFor({state:'visible',timeout:30000})
  record(tag+' Maker enters the normal Admin portal without losing Owner entitlement')
  await page.goto(base+'/maker-mode?portal=admin',{waitUntil:'domcontentloaded',timeout:45000})
  await page.getByRole('heading',{name:'Kies je modus'}).waitFor({state:'visible',timeout:30000})
  const enter=page.getByRole('button',{name:/God Mode/}).first()
  await enter.waitFor({state:'visible',timeout:30000})
  await Promise.all([
   page.waitForURL(url=>url.pathname==='/god-mode',{timeout:30000}),
   enter.click(),
  ])
  assert.equal(new URL(page.url()).pathname,'/god-mode')
  await page.locator('main h1').filter({hasText:'App Studio'}).waitFor({state:'visible',timeout:20000})
  const workspaceNav=page.locator('nav[aria-label="God Mode gereedschappen"]')
  await workspaceNav.getByRole('button',{name:/Main/}).waitFor({state:'visible',timeout:10000})
  await workspaceNav.getByRole('button',{name:/Productie/}).waitFor({state:'visible',timeout:10000})
  assert.equal(await workspaceNav.locator('a[href*="/god-mode"]').count(),1,
   'Selected environment must open through its own isolated session without duplicate top-level selectors')
  record(tag+' Maker enters private God Mode with isolated Main and production controls')

  // Installed PWA starts at '/': it must restore a valid God session instead of Admin.
  await page.waitForFunction(()=>document.cookie.includes('uptilldawn-last-workspace='),null,{timeout:10000})
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000})
  await page.waitForURL(url=>url.pathname==='/god-mode',{timeout:30000})
  record(tag+' PWA reopen at root restores authorized God Mode instead of Admin')

  // Real iframe viewport dimensions, not just CSS-shrunk mobile replicas.
  await workspaceNav.getByRole('button',{name:'App Studio'}).click()
  // On narrow phones the complete Studio submenu is an accessible select,
  // not a clipped row of buttons. Desktop retains the button tabs.
  if(viewport.width<640){
   await workspaceNav.getByRole('combobox',{name:'App Studio'}).selectOption('builder')
  }else{
   await workspaceNav.getByRole('button',{name:'Live Builder'}).click()
  }
  const preview=page.locator('iframe[title*="preview"]').first()
  await preview.waitFor({state:'visible',timeout:30000})
  for(const [name,width] of [['Mobiel 390px','390px'],['Tablet 820px','820px'],['Desktop 1440px','1440px']]){
   await page.getByRole('button',{name,exact:true}).click()
   assert.equal(await preview.evaluate(element=>element.style.width),width,'Wrong preview viewport for '+name)
  }
  record(tag+' iPhone/tablet/desktop selection changes real iframe viewport widths')

  const result=await safeRequest(context,'/api/god/logs?environment=main&limit=3')
  assert.equal(result.status(),200,'Owner must be allowed to read local persisted God logs')
  const payload=await result.json()
  assert.equal(payload.source,'authenticated environment')
  assert.ok(payload.logs&&typeof payload.logs==='object')
  for(const key of ['errors','recovery','audit'])assert.ok(Array.isArray(payload.logs[key]),'Missing '+key+' logs')
  record(tag+' God Mode session can read its authenticated local error/recovery/audit logs')

  const overview=await safeRequest(context,'/api/god/overview?environment=main')
  assert.equal(overview.status(),200,'Maker must be able to view technical status even when provider connectors are absent')
  const status=await overview.json()
  assert.equal(status.environment,'main')
  record(tag+' Maker overview returns only Main status, without claiming absent provider evidence')

  const foreign=await context.request.post(base+'/api/god/sql',{
   headers:{Origin:'https://attacker.invalid','Sec-Fetch-Site':'cross-site'},
   data:{query:'select 1',write:false,environment:'main'},
  })
  assert.equal(foreign.status(),403,'Cross-origin God Mode requests must be forbidden')
  record(tag+' cross-origin God Mode requests are denied before SQL execution')

  const top=['AI & herstel','App Studio','Versies & CI','Geavanceerd']
  for(const title of top){
   const nav=page.getByRole('button',{name:title,exact:true}).first()
   await nav.waitFor({state:'visible',timeout:12000})
   await nav.click()
   assert.equal(await nav.getAttribute('aria-pressed'),'true','God Mode section '+title+' did not activate')
  }
  record(tag+' critical Studio, AI, release and advanced navigation buttons are functional')

  // "Normale app openen" is NOT logout: it must revoke only the privileged
  // God token, preserve Supabase authentication and open the Admin portal.
  const normal=page.getByRole('button',{name:'Normale app openen'})
  await normal.click()
  await page.waitForURL(url=>url.pathname==='/admin',{timeout:30000})
  assert.equal((await safeRequest(context,'/api/god/logs?environment=main&limit=3')).status(),401)
  record(tag+' leaving God Mode retains the Owner login and restores Admin')

  // An authenticated Maker may switch to Administration. The PWA must then
  // reopen the last authorized workspace, without silently returning to Admin.
  await page.goto(base+'/portals/switch/administration',{waitUntil:'domcontentloaded',timeout:45000})
  await page.waitForURL(url=>url.pathname==='/portals/administration',{timeout:30000})
  await page.waitForFunction(()=>decodeURIComponent(document.cookie).includes(':administration'),null,{timeout:12000})
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000})
  await page.waitForURL(url=>url.pathname==='/portals/administration',{timeout:30000})
  record(tag+' PWA reopen restores authorized Administration instead of Admin')

  // Separately verify explicit God Mode sign-out. Going to the Admin login
  // screen may terminate the normal account session; never assume the user
  // remains authenticated after deliberately choosing "afmelden".
  await page.goto(base+'/maker-mode?portal=admin',{waitUntil:'domcontentloaded',timeout:45000})
  await page.getByRole('heading',{name:'Kies je modus'}).waitFor({state:'visible',timeout:30000})
  const returnToGod=page.getByRole('button',{name:/God Mode/}).first()
  await Promise.all([
   page.waitForURL(url=>url.pathname==='/god-mode',{timeout:30000}),
   returnToGod.click(),
  ])
  const leave=page.getByRole('button',{name:'God Mode afmelden'})
  await leave.click()
  await page.waitForURL(url=>url.pathname!=='/god-mode',{timeout:30000})
  assert.equal((await safeRequest(context,'/api/god/logs?environment=main&limit=3')).status(),401)
  record(tag+' God Mode logout invalidates the private session')
 }catch(error){
  failures.push(tag+': '+String(error?.message||error))
  await maker.page.screenshot({path:out+'/'+tag+'.png',fullPage:true,timeout:5000}).catch(()=>{})
 }finally{await maker.context.close()}
}

try{
 const staff=await actor('bot-03-staff-en@bots.uptilldawn.test',{width:390,height:844})
 try{
  const resp=await safeRequest(staff.context,'/api/god/logs?environment=main')
  assert.equal(resp.status(),401,'Ordinary staff must not read God Mode logs')
  const overview=await safeRequest(staff.context,'/api/god/overview?environment=main')
  assert.equal(overview.status(),401,'Ordinary staff must not read God Mode overview')
  await staff.page.goto(base+'/maker-mode',{waitUntil:'domcontentloaded',timeout:30000})
  await staff.page.waitForURL(url=>url.pathname==='/unauthorized',{timeout:20000})
  record('staff cannot enter Maker portal or read private God Mode APIs')
 }catch(error){
  failures.push('staff negative access: '+String(error?.message||error))
  await staff.page.screenshot({path:out+'/staff-denied.png',fullPage:true,timeout:5000}).catch(()=>{})
 }finally{await staff.context.close()}
 for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
  await verifyMaker(viewport)
 }
}finally{
 await browser.close()
 await writeFile(out+'/result.json',JSON.stringify({checks,failures,
  target:'http://127.0.0.1:3000',isolated:true,
  disclaimer:'No production write, provider delivery, cloud runtime tail or rollback executed',
 },null,2))
}
if(failures.length){
 for(const failure of failures)console.error('FAIL:',failure)
 process.exitCode=1
}
