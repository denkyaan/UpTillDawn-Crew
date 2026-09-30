import { chromium } from 'playwright'

const baseUrl=process.env.BOT_TEST_BASE_URL||'http://127.0.0.1:3000'
const roles=['admin','responsible',...Array(13).fill('staff')]
const locales=['nl','fr','en','de']
const viewports=[
 {width:390,height:844},{width:430,height:932},{width:768,height:1024},
 {width:1280,height:800},{width:1440,height:900},
]
const failures=[]
const browser=await chromium.launch({headless:true})
try{
 await Promise.all(roles.map(async(role,index)=>{
  const locale=locales[index%locales.length]
  const context=await browser.newContext({locale,viewport:viewports[index%viewports.length]})
  const page=await context.newPage()
  const bot=`bot-${String(index+1).padStart(2,'0')}-${role}-${locale}`
  try{
   const response=await page.goto(`${baseUrl}/login/${role}`,{waitUntil:'networkidle',timeout:30000})
   if(!response?.ok())throw new Error(`HTTP ${response?.status()}`)
   const email=page.locator('input[name="email"]')
   const password=page.locator('input[name="password"]')
   if(await email.count()!==1||await password.count()!==1)throw new Error('login controls missing')
   await email.fill(`${bot}@bots.uptilldawn.test`)
   await password.fill('synthetic-not-submitted')
   const menu=page.getByRole('button',{name:/inlogmenu/i})
   if(await menu.count())await menu.click()
   for(const target of ['staff','responsible','admin']){
    if(await page.locator(`a[href="/login/${target}"]`).count()!==1)throw new Error(`portal link missing: ${target}`)
   }
   const body=await page.locator('body').innerText()
   if(!body.trim())throw new Error('empty UI')
   console.log(`PASS ${bot} ${viewports[index%viewports.length].width}x${viewports[index%viewports.length].height}`)
  }catch(error){
   failures.push(`${bot}: ${error instanceof Error?error.message:String(error)}`)
  }finally{await context.close()}
 }))
}finally{await browser.close()}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('PASS: 15 concurrent browser bots across Admin/Responsible/Staff, NL/FR/EN/DE and mobile/tablet/desktop viewports')
