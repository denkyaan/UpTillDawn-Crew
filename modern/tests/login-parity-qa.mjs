// Read-only, exact-visual login cutover gate: existing Main is authoritative.
// This deliberately FAILS until modern reproduces every Main login screen.
// No credentials, no real logins, no write requests, no Production endpoints.
// Run explicitly: npm --prefix modern run login:parity
import {chromium} from "playwright"
import {mkdir,writeFile} from "node:fs/promises"
import {resolve} from "node:path"
const baseline="https://uptilldawn-main.uptilldawn.workers.dev"
const candidate="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const routes=["/login","/login/staff","/login/responsible",
 "/login/admin","/login/promotion","/login/administration"]
const languages=["nl","fr","en","de"]
const devices=[
 {name:"desktop",viewport:{width:1440,height:900},isMobile:false,hasTouch:false},
 {name:"mobile",viewport:{width:390,height:844},isMobile:true,hasTouch:true},
]
const reportDir=resolve(import.meta.dirname,"../../test-results/login-parity")
const browser=await chromium.launch({headless:true})
let comparisons=0
let interactionComparisons=0
let lastRoute="unknown"
async function visit(context,origin,path,lang){
 const page=await context.newPage()
 const unsafe=[]
 page.on("request",req=>{
  if(!["GET","HEAD"].includes(req.method()))unsafe.push(req.method()+" "+new URL(req.url()).pathname)
 })
 const response=await page.goto(origin+path,{waitUntil:"networkidle",timeout:25000})
 if(response?.status()!==200)throw Error("LOGIN_HTTP_NOT_200 "+origin+path+" "+response?.status())
 const switcher=page.locator("select")
 if(await switcher.count()!==1)throw Error("LOGIN_LANGUAGE_SWITCHER_NOT_PARITY "+origin+path)
 await switcher.selectOption(lang)
 await page.waitForFunction(language=>document.documentElement.lang===language,lang,{timeout:12000})
 await page.evaluate(async()=>{
  await document.fonts.ready
  await Promise.all([...document.images].map(img=>
   img.complete?Promise.resolve():new Promise(done=>{
    img.addEventListener("load",done,{once:true})
    img.addEventListener("error",done,{once:true})
  })))
 })
 if((await page.locator('img[src="/uptilldawn-logo.jpeg"]').count())!==1)
  throw Error("LOGIN_EXACT_LOGO_MISSING "+origin+path)
 if(!await page.locator('img[src="/uptilldawn-logo.jpeg"]').evaluate(el=>el.naturalWidth>0))
  throw Error("LOGIN_LOGO_NOT_LOADED "+origin+path)
 if(path==="/login"){
  for(const href of ["/login/staff","/login/promotion","/login/administration","/signup"]){
   if((await page.locator('a[href="'+href+'"]').count())<1)
    throw Error("LOGIN_CHOOSER_LINK_MISSING "+origin+href)
  }
 }else{
  const portal=path.slice("/login/".length)
  if(await page.locator('input[name="portal"]').inputValue()!==portal)
   throw Error("LOGIN_PORTAL_NOT_IDENTICAL "+origin+path)
  if(await page.locator('input[name="email"][autocomplete="username"]').count()!==1)
   throw Error("LOGIN_USERNAME_NOT_IDENTICAL "+origin+path)
  if(await page.locator('input[name="password"][autocomplete="current-password"]').count()!==1)
   throw Error("LOGIN_PASSWORD_NOT_IDENTICAL "+origin+path)
  for(const href of ["/forgot-password","/signup"]){
   if((await page.locator('a[href="'+href+'"]').count())<1)
    throw Error("LOGIN_ACCOUNT_LINK_MISSING "+origin+path+" "+href)
  }
  await page.locator('button[aria-label]').filter({has:page.locator("svg.lucide-eye")}).click()
  if(await page.locator('input[name="password"]').getAttribute("type")!=="text")
   throw Error("LOGIN_SHOW_PASSWORD_BROKEN "+origin+path)
  await page.locator('button[aria-label]').filter({has:page.locator("svg.lucide-eye-off")}).click()
  if(await page.locator('input[name="password"]').getAttribute("type")!=="password")
   throw Error("LOGIN_HIDE_PASSWORD_BROKEN "+origin+path)
  await page.locator("button[aria-expanded]").click()
  for(const role of ["staff","responsible","admin","promotion","administration"])
   if(!await page.locator('a[href="/login/'+role+'"]').count())
    throw Error("LOGIN_MENU_PORTAL_MISSING "+origin+" "+role)
  await page.locator("button[aria-expanded]").click()
 }
 if(unsafe.length)throw Error("LOGIN_READ_ONLY_TEST_SAW_MUTATION "+unsafe[0])
 await page.locator("h1").click({force:true})
 await page.mouse.move(0,0)
 await page.evaluate(()=>scrollTo(0,0))
 const pixels=await page.screenshot({fullPage:true,animations:"disabled",caret:"hide"})
 return {page,pixels}
}
try{
 for(const device of devices){
  for(const lang of languages){
   const context=await browser.newContext({
    viewport:device.viewport,isMobile:device.isMobile,hasTouch:device.hasTouch,
    locale:lang==="nl"?"nl-BE":lang==="fr"?"fr-BE":lang==="de"?"de-BE":"en-US",
    deviceScaleFactor:1,colorScheme:"dark",reducedMotion:"reduce"
   })
   try{
    for(const route of routes){
     lastRoute=device.name+"/"+lang+route
     let legacy,modern
     try{
      legacy=await visit(context,baseline,route,lang)
      modern=await visit(context,candidate,route,lang)
      if(!legacy.pixels.equals(modern.pixels)){
       await mkdir(reportDir,{recursive:true})
       const name=(device.name+"-"+lang+"-"+route.slice(1).replaceAll("/","-")).replace(/[^a-z0-9-]/gi,"")
       await legacy.page.screenshot({path:resolve(reportDir,name+"-legacy.png"),fullPage:true,animations:"disabled"})
       await modern.page.screenshot({path:resolve(reportDir,name+"-modern.png"),fullPage:true,animations:"disabled"})
       throw Error("LOGIN_PIXEL_PARITY_FAILED "+lastRoute+" (two anonymous comparison screenshots saved)")
      }
      comparisons++
      if(route!=="/login"){
       // Match visible interactive states too. Empty fields only: no login,
       // recovery email, synthetic credential POST or business write occurs.
       for(const state of ["menu","password-visible","email-focus","password-focus"]){
        for(const current of [legacy,modern]){
         if(state==="menu")await current.page.locator("button[aria-expanded]").click()
         if(state==="password-visible")await current.page.locator('button[aria-label]').filter({has:current.page.locator("svg.lucide-eye")}).click()
         if(state==="email-focus")await current.page.locator('input[name="email"]').focus()
         if(state==="password-focus")await current.page.locator('input[name="password"]').focus()
         await current.page.mouse.move(0,0)
         await current.page.evaluate(()=>scrollTo(0,0))
         current.pixels=await current.page.screenshot({fullPage:true,animations:"disabled",caret:"hide"})
        }
        if(!legacy.pixels.equals(modern.pixels)){
         await mkdir(reportDir,{recursive:true})
         const name=(device.name+"-"+lang+"-"+route.slice(1).replaceAll("/","-")+"-"+state)
         await writeFile(resolve(reportDir,name+"-legacy.png"),legacy.pixels)
         await writeFile(resolve(reportDir,name+"-modern.png"),modern.pixels)
         throw Error("LOGIN_PIXEL_PARITY_FAILED "+lastRoute+" "+state)
        }
        interactionComparisons++
        if(state==="menu")for(const current of [legacy,modern])await current.page.locator("button[aria-expanded]").click()
        if(state==="password-visible")for(const current of [legacy,modern])await current.page.locator('button[aria-label]').filter({has:current.page.locator("svg.lucide-eye-off")}).click()
       }
      }
      console.log("PASS login screenshot "+lastRoute)
     }finally{
      await legacy?.page.close()
      await modern?.page.close()
     }
    }
   }finally{await context.close()}
  }
 }
 if(comparisons!==48)throw Error("LOGIN_COVERAGE_INCOMPLETE "+comparisons+"/48")
 if(interactionComparisons!==160)throw Error("LOGIN_INTERACTION_COVERAGE_INCOMPLETE")
 const report={loginVisualParityVerified:true,
  exactScreens:routes.length,locales:languages.length,devices:devices.length,
  screenshotPairs:comparisons,interactionScreenshotPairs:interactionComparisons,authenticationNotExercised:true,
  functionalAuthParityVerified:false,productionReady:false}
 await mkdir(reportDir,{recursive:true})
 await writeFile(resolve(reportDir,"report.json"),JSON.stringify(report,null,2))
 console.log(JSON.stringify(report))
}finally{
 await browser.close()
}
