// Candidate-only anonymous browser acceptance: 4 languages x mobile/desktop.
// Does NOT impersonate real bots or claim authenticated portal parity.
import {spawn} from "node:child_process"
import {resolve} from "node:path"
import {chromium} from "playwright"

const root=resolve(import.meta.dirname,"../..")
const origin="http://127.0.0.1:4175"
const languageLabels={nl:"Personeel",fr:"Personnel",en:"Staff",de:"Personal"}
const responsibleLabels={nl:"Verantwoordelijke",fr:"Responsable",en:"Responsible",de:"Verantwortlicher"}
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
    // The original Main portal chooser is a single fully black, fixed
    // viewport; no body scroll, clipped controls or gray footer on iPhone.
    await page.locator('[data-portal-chooser="true"]').waitFor()
    const chooser=await page.evaluate(()=>{
      const page=document.querySelector('[data-portal-chooser="true"]')
      const root=document.querySelector('.auth-layout')
      const links=[...document.querySelectorAll('.portal-selection-links a')]
      const register=document.querySelector('a[href="/signup"]')
      const language=page?.querySelector('select')
      const all=[...links,register,language]
      const height=window.innerHeight
      return {
        htmlBackground:getComputedStyle(document.documentElement).backgroundColor,
        bodyBackground:getComputedStyle(document.body).backgroundColor,
        layoutBackground:root?getComputedStyle(root).backgroundColor:null,
        layoutHeight:root?.getBoundingClientRect().height,
        height,
        pageScrollable:Math.max(document.body.scrollHeight,document.documentElement.scrollHeight)>height+1,
        footerVisible:[...document.querySelectorAll('.auth-layout > footer')].some(el=>getComputedStyle(el).display!=='none'),
        visibleLinks:links.length,
        allControlsVisible:all.every(el=>{
          if(!el)return false
          const r=el.getBoundingClientRect()
          return r.top>=-1&&r.bottom<=height+1&&r.left>=-1&&r.right<=window.innerWidth+1
        })
      }
    })
    if(chooser.htmlBackground!=="rgb(0, 0, 0)"||
      chooser.bodyBackground!=="rgb(0, 0, 0)"||
      chooser.layoutBackground!=="rgb(0, 0, 0)")
      throw Error(device.name+"/"+language+" portal chooser background is not fully black")
    if(Math.abs(chooser.layoutHeight-chooser.height)>1||chooser.pageScrollable||
      chooser.footerVisible||chooser.visibleLinks!==3||!chooser.allControlsVisible)
      throw Error(device.name+"/"+language+" portal chooser must fit fixed viewport: "+JSON.stringify(chooser))
    await page.evaluate(()=>window.scrollTo(0,300))
    if(await page.evaluate(()=>window.scrollY)!==0)
      throw Error(device.name+"/"+language+" portal chooser still scrolls")
    await page.locator('a[href="/login/staff"]').click()
    await page.locator('input[name="email"]').waitFor({timeout:10000})
    // Portal selection AND every role form must be a black fixed viewport.
    // No login, credentials or network mutations: anonymous GET only.
    async function assertFixedPortalForm(route){
      await page.locator('[data-auth-portal="true"]').waitFor()
      const state=await page.evaluate(()=>{
        const root=document.querySelector('.auth-layout')
        const screen=document.querySelector('[data-auth-portal="true"]')
        const form=screen?.querySelector('form')
        const controls=[
          screen?.querySelector('input[name="email"]'),
          screen?.querySelector('input[name="password"]'),
          screen?.querySelector('button[type="submit"]'),
          screen?.querySelector('a[href="/forgot-password"]'),
          screen?.querySelector('a[href="/signup"]'),
          screen?.querySelector('select')
        ]
        const height=window.innerHeight,width=window.innerWidth
        return {
          height,
          layoutHeight:root?.getBoundingClientRect().height,
          background:[document.documentElement,document.body,root,screen]
            .map(el=>el?getComputedStyle(el).backgroundColor:null),
          footerVisible:[...document.querySelectorAll('.auth-layout > footer')]
            .some(el=>getComputedStyle(el).display!=='none'),
          scrollable:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)>height+1,
          formExists:!!form,
          allControlsVisible:controls.every(el=>{
            if(!el)return false
            const r=el.getBoundingClientRect()
            return r.width>0&&r.height>0&&r.top>=-1&&r.left>=-1&&
              r.bottom<=height+1&&r.right<=width+1
          })
        }
      })
      if(state.background.some(value=>value!=="rgb(0, 0, 0)")||
         state.footerVisible||state.scrollable||!state.formExists||
         !state.allControlsVisible||Math.abs(state.layoutHeight-state.height)>1)
        throw Error("PORTAL_LOGIN_NOT_FIXED_BLACK "+device.name+"/"+language+route+" "+JSON.stringify(state))
      await page.evaluate(()=>window.scrollTo(0,350))
      if(await page.evaluate(()=>window.scrollY)!==0)
        throw Error("PORTAL_LOGIN_SCROLLS "+device.name+"/"+language+route)
    }
    await assertFixedPortalForm("/login/staff")
    if(language==="nl"){
      for(const portal of ["responsible","promotion","admin","administration"]){
        await page.goto(origin+"/login/"+portal,{waitUntil:"domcontentloaded",timeout:15000})
        await assertFixedPortalForm("/login/"+portal)
      }
      await page.goto(origin+"/login/staff",{waitUntil:"domcontentloaded",timeout:15000})
      await page.locator('input[name="email"]').waitFor({timeout:10000})
    }
    await page.locator('select').selectOption(language)
    await page.waitForFunction(lang=>document.documentElement.lang===lang,language)
    await page.locator('input[type="password"]').waitFor({timeout:10000})
    const heading=await page.locator("h1").innerText()
    if(!heading.includes(label))throw Error(device.name+"/"+language+" incorrect translation: "+heading)
    if((await page.locator("html").getAttribute("lang"))!==language)
     throw Error(device.name+"/"+language+" html language mismatch")
    // The Vite screen has no SSR hydration. Opening its menu immediately must
    // already translate newly mounted labels; do not wait out a legacy timer.
    await page.locator('button[aria-expanded]').click()
    const responsible=await page.locator('a[href="/login/responsible"]').innerText()
    if(responsible.trim()!==responsibleLabels[language])
     throw Error(device.name+"/"+language+" new menu is not translated: "+responsible)
    await page.locator('button[aria-expanded]').click()
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
