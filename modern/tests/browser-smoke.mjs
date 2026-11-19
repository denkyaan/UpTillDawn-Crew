// Candidate-only anonymous browser acceptance: 4 languages x mobile/desktop.
// Does NOT impersonate real bots or claim authenticated portal parity.
import {spawn} from "node:child_process"
import {resolve} from "node:path"
import {chromium} from "playwright"

const root=resolve(import.meta.dirname,"../..")
const origin="http://127.0.0.1:4175"
const languageLabels={nl:"Personeel",fr:"Personnel",en:"Staff",de:"Personal"}
const views=[
 {name:"desktop",viewport:{width:1440,height:900},isMobile:false},
 {name:"mobile",viewport:{width:390,height:844},isMobile:true,hasTouch:true},
]
const preview=spawn(process.execPath,[resolve(root,"modern/node_modules/vite/bin/vite.js"),"preview","--host","127.0.0.1","--port","4175","--strictPort"],{
 cwd:resolve(root,"modern"),stdio:"ignore"
})
let browser
let count=0
try{
 let up=false
 for(let i=0;i<80;i++){
  if(preview.exitCode!==null)throw Error("Preview server exited: "+preview.exitCode)
  try{
   const response=await fetch(origin+"/login",{signal:AbortSignal.timeout(1000)})
   if(response.ok){up=true;break}
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,250))
 }
 if(!up)throw Error("Vite candidate preview not reachable")
 browser=await chromium.launch({headless:true})
 for(const [language,label] of Object.entries(languageLabels)){
  for(const device of views){
   const context=await browser.newContext({
    viewport:device.viewport,isMobile:device.isMobile,
    hasTouch:device.hasTouch||false,locale:language,
   })
   try{
    await context.addInitScript(lang=>{
     localStorage.setItem("uptilldawn-modern-locale",lang)
    },language)
    const page=await context.newPage()
    const errors=[]
    page.on("pageerror",error=>errors.push(error.message))
    await page.goto(origin+"/login",{waitUntil:"networkidle",timeout:15000})
    await page.locator('a[href="/login/staff"]').click()
    await page.locator('input[name="email"]').waitFor({timeout:10000})
    await page.locator('select').selectOption(language)
    await page.waitForFunction(lang=>document.documentElement.lang===lang,language)
    await page.locator('input[type="password"]').waitFor({timeout:10000})
    const heading=await page.locator("h1").innerText()
    if(!heading.includes(label))throw Error(device.name+"/"+language+" incorrect translation: "+heading)
    if((await page.locator("html").getAttribute("lang"))!==language)
     throw Error(device.name+"/"+language+" html language mismatch")
    if(errors.length)throw Error(device.name+"/"+language+" JavaScript errors: "+errors.join("; ").slice(0,500))
    await page.goto(origin+"/maker/diagnostics",{waitUntil:"domcontentloaded",timeout:12000})
    await page.waitForURL("**/login",{timeout:10000})
    if(await page.locator("button").filter({hasText:"Haal makerdiagnostiek op"}).count())
     throw Error("Anonymous access to maker diagnostics")
    if(errors.length)throw Error(device.name+"/"+language+" route errors: "+errors.join("; ").slice(0,500))
    count++
    console.log("PASS candidate anonymous browser: "+language+" / "+device.name)
   }finally{await context.close()}
  }
 }
 console.log(JSON.stringify({anonymousBrowserScenarios:count,locales:4,deviceProfiles:2,authenticatedRoleScenarios:0,productionReady:false}))
}finally{
 if(browser)await browser.close()
 preview.kill("SIGTERM")
}
