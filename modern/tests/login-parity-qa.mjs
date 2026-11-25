// Read-only, exact-visual login cutover gate: existing Main is authoritative.
// This deliberately FAILS until modern reproduces every Main login screen.
// No credentials, no real logins, no write requests, no Production endpoints.
// Run explicitly: npm --prefix modern run login:visual-parity
import {chromium} from "playwright"
import {mkdir,writeFile} from "node:fs/promises"
import {resolve} from "node:path"
import {stableLoginScreenshot} from "../tooling/stable-login-screenshot.mjs"
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
const browser=await chromium.launch({headless:true,args:[
 "--disable-gpu","--disable-skia-runtime-opts","--disable-threaded-animation","--disable-threaded-scrolling"
]})
let comparisons=0
let interactionComparisons=0
let lastRoute="unknown"
const failures=[]
const unstableFrames=[]
const recoveredFrames=[]
const capture=async(page,label,side)=>{
 const result=await stableLoginScreenshot(page)
 if(result.captures>2)recoveredFrames.push({label,side,captures:result.captures})
 if(!result.stable)unstableFrames.push({label,side,captures:result.captures})
 return result
}
function recordFailure(label,reason){
 failures.push({label,reason})
 console.error("LOGIN_CASE_FAILED "+label+" "+reason)
}
async function comparePair(legacy,modern,label,name){
 // Both images come from independently stable foreground-only documents.
 if(!legacy||!modern){recordFailure(label,"LOGIN_CAPTURE_MISSING");return false}
 if(!legacy.stable||!modern.stable||!legacy.pixels.equals(modern.pixels)){
  await mkdir(reportDir,{recursive:true})
  await writeFile(resolve(reportDir,name+"-legacy.png"),legacy.pixels)
  await writeFile(resolve(reportDir,name+"-modern.png"),modern.pixels)
  recordFailure(label,!legacy.stable||!modern.stable?"LOGIN_UNSTABLE_RENDER":"LOGIN_PIXEL_PARITY_FAILED")
  return false
 }
 return true
}
async function waitAttr(page,selector,attribute,value){
 await page.waitForFunction(({selector,attribute,value})=>
  document.querySelector(selector)?.getAttribute(attribute)===value,
  {selector,attribute,value},{timeout:8000})
}
const passwordSelector='input[name="password"]'
const menuSelector='button[aria-expanded]'
async function clickControl(page,locator,device){
 if(device.hasTouch)await locator.tap()
 else await locator.click()
}
async function toggleMenu(page,device,open){
 const button=page.locator(menuSelector)
 await clickControl(page,button,device)
 await waitAttr(page,menuSelector,"aria-expanded",String(open))
}
async function togglePassword(page,device,visible){
 const icon=visible?"svg.lucide-eye":"svg.lucide-eye-off"
 await clickControl(page,page.locator('button[aria-label]').filter({has:page.locator(icon)}),device)
 await waitAttr(page,passwordSelector,"type",visible?"text":"password")
}
async function visit(context,origin,path,lang,device){
 const page=await context.newPage()
 const unsafe=[]
 page.on("request",req=>{
  if(!["GET","HEAD"].includes(req.method()))unsafe.push(req.method()+" "+new URL(req.url()).pathname)
 })
 try{
 const response=await page.goto(origin+path,{waitUntil:"networkidle",timeout:25000})
 if(response?.status()!==200)throw Error("LOGIN_HTTP_NOT_200 "+origin+path+" "+response?.status())
 if(path!=="/login")
  await page.locator('form[data-login-hydrated="true"]').waitFor({state:"attached",timeout:15000})
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
  // Interactions are captured exactly once below, after hydration.
 }
 if(unsafe.length)throw Error("LOGIN_READ_ONLY_TEST_SAW_MUTATION "+unsafe[0])
 await page.mouse.move(0,0)
 await page.evaluate(()=>scrollTo(0,0))
 return {page,pixels:null,assertReadOnly:()=>{
  if(unsafe.length)throw Error("LOGIN_READ_ONLY_TEST_SAW_MUTATION "+unsafe[0])
 }}
 }catch(error){
  await page.close()
  throw error
 }
}
async function collect(context,origin,route,lang,device,side,label){
 const states=new Map()
 let current
 try{
  current=await visit(context,origin,route,lang,device)
  const page=current.page
  const captureState=async state=>{
   await page.mouse.move(0,0)
   await page.evaluate(()=>scrollTo(0,0))
   states.set(state,await capture(page,label+" "+state,side))
  }
  await captureState("base")
  if(route!=="/login"){
   for(const state of ["menu","password-visible","email-focus","password-focus"]){
    try{
     if(state==="menu"){
      await toggleMenu(page,device,true)
      for(const role of ["staff","responsible","admin","promotion","administration"])
       if(!await page.locator('a[href="/login/'+role+'"]').count())
        throw Error("LOGIN_MENU_PORTAL_MISSING "+role)
     }else if(state==="password-visible")await togglePassword(page,device,true)
     else{
      const input=page.locator('input[name="'+(state==="email-focus"?"email":"password")+'"]')
      await input.focus()
      if(!await input.evaluate(el=>document.activeElement===el))throw Error("LOGIN_INPUT_FOCUS_BROKEN")
     }
     await captureState(state)
    }catch(error){recordFailure(label+" "+side+" "+state,error instanceof Error?error.message.split("\n")[0]:"LOGIN_INTERACTION_FAILED")}
    finally{
     if(state==="menu"&&await page.locator(menuSelector).getAttribute("aria-expanded")==="true")
      await toggleMenu(page,device,false)
     if(state==="password-visible"&&await page.locator(passwordSelector).getAttribute("type")==="text")
      await togglePassword(page,device,false)
    }
   }
  }
  current.assertReadOnly()
 }catch(error){recordFailure(label+" "+side,error instanceof Error?error.message.split("\n")[0]:"LOGIN_ROUTE_FAILED")}
 finally{await current?.page.close()}
 return states
}
try{
 for(const device of devices){
  for(const lang of languages){
   // Separate origins and one active page at any time. Same browser,
   // dimensions, locale, fonts, rasterizer, interaction and screenshot options.
   const options={viewport:device.viewport,isMobile:device.isMobile,hasTouch:device.hasTouch,
    locale:lang==="nl"?"nl-BE":lang==="fr"?"fr-BE":lang==="de"?"de-BE":"en-US",
    deviceScaleFactor:1,colorScheme:"dark",reducedMotion:"reduce"}
   const source=await browser.newContext(options)
   const candidateContext=await browser.newContext(options)
   try{
    for(const route of routes){
     lastRoute=device.name+"/"+lang+route
     const name=(device.name+"-"+lang+"-"+route.slice(1).replaceAll("/","-")).replace(/[^a-z0-9-]/gi,"")
     const failuresBefore=failures.length
     const legacy=await collect(source,baseline,route,lang,device,"legacy",lastRoute)
     const modern=await collect(candidateContext,candidate,route,lang,device,"modern",lastRoute)
     for(const state of route==="/login"?["base"]:["base","menu","password-visible","email-focus","password-focus"]){
      if(await comparePair(legacy.get(state),modern.get(state),lastRoute+" "+state,name+(state==="base"?"":"-"+state))){
       if(state==="base")comparisons++
       else interactionComparisons++
      }
     }
     if(failures.length===failuresBefore)console.log("PASS login screenshot "+lastRoute)
    }
   }finally{await source.close();await candidateContext.close()}
  }
 }
 const exactCoverage=comparisons===48&&interactionComparisons===160&&failures.length===0
 const report={loginVisualParityVerified:exactCoverage,
  exactScreens:routes.length,locales:languages.length,devices:devices.length,
  screenshotPairs:comparisons,interactionScreenshotPairs:interactionComparisons,authenticationNotExercised:true,
  expectedScreenshotPairs:48,expectedInteractionScreenshotPairs:160,
  comparisonMethod:"stable-exact-png",pixelTolerance:0,failures,unstableFrames,recoveredFrames,
  functionalAuthParityVerified:false,productionReady:false}
 await mkdir(reportDir,{recursive:true})
 await writeFile(resolve(reportDir,"report.json"),JSON.stringify(report,null,2))
 console.log(JSON.stringify(report))
 if(comparisons!==48||interactionComparisons!==160||failures.length)
  throw Error("LOGIN_PIXEL_PARITY_FAILED "+failures.length+" cases; exact screens "+comparisons+"/48, interactions "+interactionComparisons+"/160")
}finally{
 await browser.close()
}
