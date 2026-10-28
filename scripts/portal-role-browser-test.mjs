import {chromium} from 'playwright'
import {createClient} from '@supabase/supabase-js'

const base=process.env.BOT_TEST_BASE_URL||'http://127.0.0.1:3000'
const url=process.env.BOT_SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL
const key=process.env.BOT_SERVICE_ROLE_KEY
const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const password=process.env.BOT_TEST_PASSWORD
if(!url||!key||!anon||!password)throw Error('Missing isolated E2E credentials')
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const cases=[
 {name:'administration',portal:'administration',role:'administrative_staff',allowed:'/portals/administration',denied:'/portals/promotion'},
 {name:'promotion',portal:'promotion',role:'promoter',allowed:'/portals/promotion',denied:'/portals/administration'},
]
const browser=await chromium.launch({headless:true})
try{
 for(const entry of cases){
  const email=`portal-e2e-${entry.name}@bots.uptilldawn.test`
  const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true})
  if(createError||!created.user)throw Error(`create ${entry.name}: ${createError?.message}`)
  const id=created.user.id
  try{
   const {error:profileError}=await admin.from('profiles').upsert({id,full_name:`E2E ${entry.name}`,role:'staff',approved:true,account_blocked:false,updated_at:new Date().toISOString()},{onConflict:'id'})
   if(profileError)throw profileError
   const {data:approver,error:approverError}=await admin.from('profiles').select('id').eq('role','admin').eq('approved',true).limit(1).single()
   if(approverError||!approver)throw Error('No approved admin fixture to authorize portal grants')
   const {error:grantError}=await admin.from('portal_role_assignments').insert({user_id:id,portal:entry.portal,role:entry.role,approved:true,approved_by:approver.id,approved_at:new Date().toISOString()})
   if(grantError)throw grantError
   const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}})
   const {data:session,error:loginError}=await client.auth.signInWithPassword({email,password})
   if(loginError||!session.session)throw Error(`login ${entry.name}: ${loginError?.message}`)
   const context=await browser.newContext()
   try{
    const bridge=await context.request.post(`${base}/api/test-auth-session`,{data:{access_token:session.session.access_token,refresh_token:session.session.refresh_token}})
    if(!bridge.ok())throw Error(`session bridge HTTP ${bridge.status()}`)
    const page=await context.newPage()
    for(const route of [entry.allowed,entry.denied]){
     const response=await page.goto(`${base}${route}`,{waitUntil:'domcontentloaded',timeout:45000})
     const actual=new URL(page.url()).pathname
     if(route===entry.allowed){
      if(!response?.ok()||actual!==route)throw Error(`${entry.name} allowed ${route} failed: HTTP ${response?.status()}, landed ${actual}`)
      if(!(await page.locator('body').innerText()).trim())throw Error(`${entry.name}: blank portal`)
     }else{
      if(actual===route&&response?.ok()){
       const body=(await page.locator('body').innerText()).toLowerCase()
       if(!/not found|niet gevonden|geen toegang|access denied|forbidden|404/.test(body))throw Error(`${entry.name} accessed unauthorized portal ${route}`)
      }
     }
    }
    console.log(`PASS: ${entry.name} authenticates, opens own portal, and cannot open the other portal`)
   }finally{await context.close()}
  }finally{
   const {error:deleteError}=await admin.auth.admin.deleteUser(id)
   if(deleteError)console.error(`E2E cleanup warning: ${deleteError.message}`)
  }
 }
}finally{await browser.close()}
