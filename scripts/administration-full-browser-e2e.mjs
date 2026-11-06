import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'

const base=process.env.BOT_TEST_BASE_URL||'http://127.0.0.1:3000'
const url=process.env.BOT_SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL
const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const password=process.env.BOT_TEST_PASSWORD
if(!url||!anon||!password)throw Error('Isolated browser E2E credentials missing')
const roles=[
  {name:'admin',index:1,locale:'nl'},
  {name:'responsible',index:2,locale:'fr'},
  {name:'staff',index:3,locale:'en'},
  {name:'administration',index:4,locale:'de'},
  {name:'promotion',index:5,locale:'nl'},
]
const portals=[
  '/portals/administration','/portals/administration/overview',
  '/portals/administration/personnel','/portals/administration/chat','/portals/administration/contacts','/portals/administration/counterparties','/portals/administration/timesheets','/portals/administration/sales','/portals/administration/profile',
  '/portals/administration/finance','/portals/administration/rosters',
  '/portals/administration/modules/artists','/portals/administration/modules/documents',
  '/portals/administration/modules/events','/portals/administration/modules/contracts','/portals/administration/modules/staff','/portals/administration/modules/tasks','/portals/administration/modules/logistics','/portals/administration/modules/permits','/portals/administration/modules/sponsors','/portals/administration/modules/marketing','/portals/administration/modules/automations','/portals/administration/modules/ai','/portals/administration/modules/ticketing',
  '/portals/administration/modules/invoices','/portals/administration/modules/banking',
  '/portals/administration/modules/inventory','/portals/administration/modules/notifications',
  '/portals/administration/modules/reports','/portals/administration/modules/settings',
  '/portals/administration/modules/contacts',
  '/portals/promotion','/portals/promotion/tasks',
]
const surfaces=['/','/events','/workplaces','/briefings','/inventory','/guestlist','/chat','/operations','/tasks','/timesheets','/incidents','/notifications','/personnel','/sales','/settings','/exports','/audit']
const failures=[]
const findings=[]
const interactionInventory=[]
const clickedNavigation=[]
await mkdir('test-results/portal-e2e',{recursive:true})
const browser=await chromium.launch({headless:true})
try{
 for(const role of roles){
  const context=await browser.newContext({viewport:{width:390,height:844},locale:role.locale,acceptDownloads:true})
  const page=await context.newPage()
  const email=role.name==='administration'?'bot-04-staff-de@bots.uptilldawn.test':role.name==='promotion'?'bot-05-staff-nl@bots.uptilldawn.test':`bot-${String(role.index).padStart(2,'0')}-${role.name}-${role.locale}@bots.uptilldawn.test`
  try{
   if(role.name==='admin'){
    const response=await context.request.post(base+'/api/auth/admin-login',{form:{email,password},maxRedirects:0})
    if(response.status()!==303)throw Error('admin login HTTP '+response.status())
   }else{
    const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data,error}=await auth.auth.signInWithPassword({email,password})
    if(error||!data.session)throw Error('auth: '+(error?.message||'missing session'))
    const response=await context.request.post(base+'/api/test-auth-session',{data:{access_token:data.session.access_token,refresh_token:data.session.refresh_token}})
    if(!response.ok())throw Error('session bridge HTTP '+response.status())
   }
   const routes=role.name==='admin'?[...surfaces,...portals]:role.name==='administration'?portals.filter(route=>route.startsWith('/portals/administration')&&!route.includes('promotion-discipline')):role.name==='promotion'?portals.filter(route=>route.startsWith('/portals/promotion')):surfaces
   for(const route of routes){
    const errors=[]
    const handler=error=>errors.push(String(error.message||error))
    page.on('pageerror',handler)
    try{
     const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:45000})
     await page.waitForLoadState('networkidle',{timeout:7000}).catch(()=>{})
     const path=new URL(page.url()).pathname
     const body=(await page.locator('body').innerText()).trim()
     if(!response||response.status()>=400)throw Error('HTTP '+response?.status())
     if(!body)throw Error('empty page')
     if(/404\s*\|\s*this page could not be found|application error|internal server error/i.test(body))throw Error('application/404 screen')
     if(errors.length)throw Error('uncaught JS: '+errors.join('; ').slice(0,350))
     // Canonical overview redirects to the portal home. Sales is deliberately
     // admin-only; an administrative_staff account must be redirected away.
     const expectedPath=route==='/portals/administration/overview'?'/portals/administration':role.name==='administration'&&route==='/portals/administration/sales'?'/portals/administration':route
     if(['admin','administration','promotion'].includes(role.name)&&route.startsWith('/portals/')&&path!==expectedPath)throw Error('unexpected portal redirect from '+route+' to '+path+' (expected '+expectedPath+')')
     if(role.name==='administration'&&route.startsWith('/portals/administration')&&await page.locator('[data-layout-key]').count())throw Error('administration rendered personnel navigation')
     if(role.name==='promotion'&&route.startsWith('/portals/promotion')&&await page.locator('[data-layout-key]').count())throw Error('promotion rendered personnel navigation')
     if(route.startsWith('/portals/administration')&&/\/portals\/(staff|responsible|promotion)(\/|$)/.test(path))throw Error('administration entered another role portal')
     if(route.startsWith('/portals/promotion')&&/\/portals\/(staff|responsible|administration)(\/|$)/.test(path))throw Error('promotion entered another role portal')
     const links=await page.locator('a[href]').evaluateAll(els=>els.map(el=>({href:el.getAttribute('href'),label:(el.textContent||'').trim()})).filter(x=>x.href?.startsWith('/')&&!x.href.startsWith('//')))
     const buttons=await page.getByRole('button').count()
     const forms=await page.locator('form').count()
     const controls=await page.locator('button,input,select,textarea,[role="button"],[role="switch"],[role="checkbox"]').evaluateAll(elements=>elements.map(el=>({tag:el.tagName.toLowerCase(),type:el.getAttribute('type')||'',action:el.getAttribute('data-action')||'',label:(el.getAttribute('aria-label')||el.getAttribute('name')||el.textContent||'').trim().slice(0,100),disabled:el.matches(':disabled')||el.getAttribute('aria-disabled')==='true'})))
     interactionInventory.push({role:role.name,route,controls})
     findings.push({role:role.name,route,actual:path,links:links.length,buttons,forms,controls:controls.length})
     if((['admin','administration'].includes(role.name)&&route.startsWith('/portals/administration'))||(role.name==='promotion'&&route.startsWith('/portals/promotion'))){
      // Exercise actual user clicks, rather than treating direct URL requests as navigation coverage.
      const visibleLinks=await page.locator('a[href]:visible').evaluateAll(els=>els.map(el=>el.getAttribute('href')).filter(Boolean))
      // Do not click admin-only Sales as an administrative_staff user: the access guard correctly redirects to portal home.
      const portalPrefix=role.name==='promotion'?'/portals/promotion/':'/portals/administration/'
      const targets=[...new Set(visibleLinks.filter(href=>href.startsWith(portalPrefix)&&(role.name==='admin'||href!=='/portals/administration/sales')))].slice(0,35)
      if(role.name==='promotion'&&route==='/portals/promotion'&&!targets.includes('/portals/promotion/tasks'))throw Error('promotion home missing tasks navigation')
      for(const target of targets){
       const tab=await context.newPage()
       const clickedPageErrors=[]
       tab.on('pageerror',error=>clickedPageErrors.push(String(error.message||error)))
       try{
        await tab.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000})
        const href=tab.locator('a[href="'+target.replaceAll('"','\\"')+'"]:visible').first()
        const expectedClickedPath=target==='/portals/administration/overview'?'/portals/administration':target
        try {
         await Promise.all([
          tab.waitForURL(u=>u.pathname===new URL(expectedClickedPath,base).pathname,{timeout:20000,waitUntil:'commit'}),
          href.click({timeout:15000}),
         ])
        } catch (error) {
         const actualPath=new URL(tab.url()).pathname
         const screenshotName='test-results/portal-e2e/'+role.name+'-clicked-'+route.replace(/[^a-z0-9]/gi,'_')+'-to-'+target.replace(/[^a-z0-9]/gi,'_')+'.png'
         await tab.screenshot({path:screenshotName,fullPage:true,timeout:5000}).catch(()=>{})
         throw Error('navigation '+route+' -> '+target+' expected '+expectedClickedPath+' but reached '+actualPath+': '+String(error.message||error)+' (screenshot: '+screenshotName+')')
        }
        await tab.waitForLoadState('domcontentloaded',{timeout:15000})
        // Client-side hydration may redirect after the initial navigation commit.
        // Verify the final route after the page has rendered, not just the first URL.
        await tab.locator('body').waitFor({state:'visible',timeout:15000})
        await tab.waitForTimeout(250)
        const finalUrl=new URL(tab.url())
        const finalPath=finalUrl.pathname+finalUrl.search
        if(finalPath!==expectedClickedPath)throw Error('hydrated navigation '+route+' -> '+target+' ended at '+finalPath+' (expected '+expectedClickedPath+'); page title='+await tab.title()+'; body='+((await tab.locator('body').innerText()).slice(0,500)))
        if(await tab.locator('[data-layout-key]').count())throw Error('hydrated portal subtab rendered personnel navigation: '+target)
        const text=(await tab.locator('body').innerText()).trim()
        if(!text||/404\s*\|\s*this page could not be found|application error|internal server error/i.test(text))throw Error('clicked destination rendered error: '+target)
        if(clickedPageErrors.length)throw Error('clicked destination uncaught JS: '+target+': '+clickedPageErrors.join('; ').slice(0,350))
        if(await tab.locator('[data-layout-key]').count())throw Error('clicked portal destination rendered personnel navigation: '+target)
        clickedNavigation.push({role:role.name,from:route,to:target,actual:finalPath})
       }catch(error){
        const screenshotName='test-results/portal-e2e/'+role.name+'-clicked-'+route.replace(/[^a-z0-9]/gi,'_')+'-to-'+target.replace(/[^a-z0-9]/gi,'_')+'.png'
        await tab.screenshot({path:screenshotName,fullPage:true,timeout:5000}).catch(()=>{})
        throw error
       }finally{await tab.close()}
      }
     }
    }catch(e){
     failures.push(`${role.name} ${route}: ${String(e.message||e)}`)
     if(failures.length<=12)await page.screenshot({path:`test-results/portal-e2e/${role.name}-${route.replace(/[^a-z0-9]/gi,'_')}.png`,fullPage:true}).catch(()=>{})
    }finally{page.off('pageerror',handler)}
   }
  }catch(e){failures.push(`${role.name} login: ${String(e.message||e)}`)}
  finally{await context.close()}
 }
}finally{await browser.close()}
await writeFile('test-results/portal-e2e/interaction-inventory.json',JSON.stringify({inventory:interactionInventory,clickedNavigation},null,2))
console.log(JSON.stringify({visited:findings.length,findings,failures,inventoryPath:'test-results/portal-e2e/interaction-inventory.json'},null,2))
if(failures.length)process.exitCode=1
