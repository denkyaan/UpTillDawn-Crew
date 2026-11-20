// Exhaustive static-page browser navigation on the isolated Main Worker.
// The existing six-role acceptance script enforces positive and negative role
// assertions; this complements it by crawling every static app page and logging
// every actual navigation/uncaught runtime error without mutating records.
import {chromium} from 'playwright'
import {readdirSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'

const base=new URL(process.env.E2E_BASE_URL||'')
if(base.origin!=='https://uptilldawn-main.uptilldawn.workers.dev'||process.env.E2E_ALLOW_MAIN_TEST!=='1'){
 throw Error('Main-only QA guard rejected the requested target')
}
const roles=[
 {role:'admin',login:'admin'},
 {role:'administration',login:'administration'},
 {role:'promotion',login:'promotion'},
 {role:'staff',login:'staff'},
 {role:'responsible',login:'responsible'},
 {role:'maker',login:'admin'},
]
for(const {role} of roles){
 if(!process.env['E2E_'+role.toUpperCase()+'_EMAIL']||!process.env['E2E_'+role.toUpperCase()+'_PASSWORD']){
  throw Error('Dedicated QA account missing for role '+role)
 }
}
const walk=folder=>readdirSync(folder,{withFileTypes:true})
 .flatMap(e=>e.isDirectory()?walk(join(folder,e.name)):[join(folder,e.name).replace(/\\/g,'/')])
const pages=walk('app').filter(p=>/\/page\.tsx$/.test(p)&&
 (p.startsWith('app/(app)/')||p==='app/god-mode/page.tsx'||p==='app/maker-mode/page.tsx'))
const discovered=pages.map(file=>{
 const parts=file.split('/').slice(1,-1).filter(x=>!x.startsWith('('))
 return {file,path:'/'+parts.join('/'),dynamic:parts.some(x=>x.startsWith('['))}
})
const staticPages=discovered.filter(p=>!p.dynamic)
const dynamicPages=discovered.filter(p=>p.dynamic)
const directory='test-results/main-adversarial'
mkdirSync(directory,{recursive:true})
const attempts=[],failures=[]
function fail(record,message){
 const row={...record,failure:message}
 failures.push(row)
 console.error('FAIL',record.role,record.path,message)
}
const browser=await chromium.launch({headless:true})
try{
 for(const config of roles){
  const role=config.role
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'nl',reducedMotion:'reduce'})
  try{
   const page=await context.newPage()
   await page.goto(new URL('/login/'+config.login,base).href,{waitUntil:'domcontentloaded',timeout:45000})
   await page.locator('form[data-login-hydrated="true"]').waitFor({state:'attached',timeout:30000})
   await page.locator('#email').fill(process.env['E2E_'+role.toUpperCase()+'_EMAIL'])
   await page.locator('#password').fill(process.env['E2E_'+role.toUpperCase()+'_PASSWORD'])
   await Promise.all([
    page.waitForURL(url=>!url.pathname.startsWith('/login'),{timeout:45000}),
    page.locator('button[type="submit"]').click(),
   ])
   const runtime=[]
   page.on('pageerror',error=>runtime.push(String(error?.message||error).slice(0,240)))
   for(const entry of staticPages){
    const record={role,path:entry.path,file:entry.file}
    const errorsBefore=runtime.length
    try{
     const response=await page.goto(new URL(entry.path,base).href,{waitUntil:'domcontentloaded',timeout:20000})
     await page.locator('body').waitFor({state:'visible',timeout:12000})
     // Await React hydration on protected pages before deciding that a blank
     // shell or an authorization redirect is functional.
     await page.waitForTimeout(200)
     const finalPath=new URL(page.url()).pathname
     const status=response?.status()??null
     const body=(await page.locator('body').innerText()).trim()
     const links=await page.locator('a[href]').count()
     const buttons=await page.locator('button').count()
     attempts.push({...record,finalPath,status,links,buttons})
     if(status!==null&&status>=500)fail(record,'HTTP '+status)
     if(body.length===0)fail(record,'Blank page / no fallback')
     if(runtime.length>errorsBefore)fail(record,'Uncaught browser exception: '+runtime.slice(errorsBefore).join('; '))
     if(finalPath.startsWith('/login'))fail(record,'Unexpected session loss')
    }catch(error){
     fail(record,'Browser navigation: '+(error instanceof Error?error.message:String(error)).slice(0,250))
     const filename=(role+'-'+entry.path).replace(/[^a-z0-9-]/gi,'-').slice(0,85)
     await page.screenshot({path:directory+'/'+filename+'.png',fullPage:true,timeout:5000}).catch(()=>{})
    }
   }
  }catch(error){
   fail({role,path:'/login/'+config.login,file:'authenticated-setup'},'QA login: '+(error instanceof Error?error.message:String(error)).slice(0,240))
  }finally{await context.close()}
 }
}finally{await browser.close()}
const report={
 source:'authenticated-main-breadth',
 target:base.origin,roleCount:roles.length,staticPages:staticPages.length,
 dynamicPages:dynamicPages.map(p=>p.path),attempts:attempts.length,failures,checks:attempts,
 note:'Read-only navigation and JavaScript failures for all static app pages. This does not click every action, seed dynamic IDs, or certify external provider delivery.',
}
writeFileSync(directory+'/authenticated-breadth.json',JSON.stringify(report,null,2)+'\n')
console.log('Main authenticated page breadth:',JSON.stringify({roles:roles.length,staticPages:staticPages.length,dynamicPages:dynamicPages.length,checks:attempts.length,failures:failures.length}))
if(failures.length)process.exitCode=1
