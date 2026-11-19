// Live non-promoted Cloudflare Free Preview validation of the same Main Worker.
// No production URLs, no application-data writes and no disclosure of credentials.
import {chromium} from 'playwright'

const raw=process.env.VINEXT_FREE_PREVIEW_URL||''
const password=process.env.MAIN_QA_BOT_PASSWORD||''
const accessClientId=process.env.MAIN_QA_CF_ACCESS_CLIENT_ID||''
const accessClientSecret=process.env.MAIN_QA_CF_ACCESS_CLIENT_SECRET||''
if(!accessClientId||!accessClientSecret)
 throw Error('Missing Cloudflare Access CI service token; refusing private Preview QA')
let base
try{
 const url=new URL(raw)
 if(url.protocol!=='https:'||url.username||url.password||url.port||
    !/^[a-z0-9-]+-uptilldawn-main[.]uptilldawn[.]workers[.]dev$/.test(url.hostname)||
    url.pathname!=='/'||url.search||url.hash)throw Error('Unapproved preview URL')
 base=url.origin
}catch{throw Error('Live preview QA is restricted to a non-promoted version of the Main Worker')}
if(password.length<24)throw Error('Missing 24+ character isolated Main QA password')

const roles=[
 {name:'head_admin',email:'e2e-head-admin@uptilldawn.test',portal:'admin',path:'/admin'},
 {name:'left_hand',email:'e2e-admin@uptilldawn.test',portal:'administration',path:'/portals/administration'},
 {name:'right_hand',email:'e2e-right-hand@uptilldawn.test',portal:'administration',path:'/portals/administration'},
 {name:'administration',email:'e2e-administration@uptilldawn.test',portal:'administration',path:'/portals/administration'},
 {name:'promotion',email:'e2e-promotion@uptilldawn.test',portal:'promotion',path:'/portals/promotion'},
 {name:'responsible',email:'e2e-responsible@uptilldawn.test',portal:'responsible',path:'/events'},
 {name:'staff',email:'e2e-staff@uptilldawn.test',portal:'staff',path:'/events'},
]
const errors=[]
let pass=0
const browser=await chromium.launch({headless:true})
async function check(role,index){
 const context=await browser.newContext({
  locale:['nl-BE','fr-BE','en-GB','de-DE'][index%4],
  viewport:index%2===0?{width:1280,height:800}:{width:390,height:844},
 })
 try{
  // Inject Access credentials ONLY for the exact isolated preview origin.
  // route.fetch(maxRedirects:0) prevents service-token headers being
  // forwarded across a possible cross-origin HTTP redirect.
  await context.route('**/*',async route=>{
   const target=new URL(route.request().url())
   if(target.origin!==base){await route.continue();return}
   const response=await route.fetch({
    headers:{
     ...route.request().headers(),
     'CF-Access-Client-Id':accessClientId,
     'CF-Access-Client-Secret':accessClientSecret,
    },
    maxRedirects:0,
   })
   await route.fulfill({response})
  })
  const page=await context.newPage()
  page.setDefaultTimeout(30000)
  const login=await page.goto(base+'/login/'+role.portal,{waitUntil:'commit',timeout:40000})
  if(login?.status()!==200)throw Error('Login GET HTTP '+(login?.status()??'none'))
  const form=page.locator('form[data-login-hydrated="true"]')
  await form.waitFor({timeout:35000})
  await form.locator('[name=email]').fill(role.email)
  await form.locator('[name=password]').fill(password)
  await form.locator('button[type=submit]').click()
  try{await page.waitForURL(v=>!v.pathname.startsWith('/login'),{waitUntil:'commit',timeout:35000})}
  catch{
    const code=await page.locator('[data-login-error-code]').first().getAttribute('data-login-error-code').catch(()=>null)
    throw Error('Login not completed'+(code?': '+code:''))
  }
  const cookieNames=(await context.cookies(base)).map(x=>x.name)
  if(!cookieNames.some(name=>/^sb-[a-z0-9]+-auth-token(?:[.][0-9]+)?$/i.test(name)))
   throw Error('Supabase session cookie not established')
  const allowed=await page.goto(base+role.path,{waitUntil:'commit',timeout:40000})
  if(!allowed||allowed.status()>=500)throw Error('Allowed route HTTP '+(allowed?.status()??'none'))
  if(!new URL(page.url()).pathname.startsWith(role.path))
   throw Error('Authorized route redirect to '+new URL(page.url()).pathname)
  if(role.name==='promotion'||role.name==='staff'){
   const denial=await page.goto(base+'/god-mode',{waitUntil:'commit',timeout:40000})
   if(!denial||denial.status()>=500)throw Error('Denied Maker route HTTP '+(denial?.status()??'none'))
   await page.waitForURL(v=>v.pathname!=='/god-mode',{waitUntil:'commit',timeout:35000}).catch(()=>{})
   if(new URL(page.url()).pathname==='/god-mode')throw Error('Maker access incorrectly granted')
  }
  pass++
  console.log('PASS Cloudflare Free Preview role '+role.name+' login, session, protected route and isolation')
 }catch(e){
  const message=String(e?.message||e).split(password).join('[redacted]').slice(0,280)
  errors.push({role:role.name,error:message})
  console.error('FAIL Cloudflare Free Preview role '+role.name+': '+message)
 }finally{await context.close()}
}
try{for(const [i,r] of roles.entries())await check(r,i)}
finally{await browser.close()}
console.log('CLOUDFLARE_FREE_VINEXT_ROLE_PARITY passed='+pass+' failed='+errors.length+' total=7')
if(errors.length)process.exitCode=1
