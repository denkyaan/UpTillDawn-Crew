// Main-only bounded acceptance of THIRTY DISTINCT temporary staff identities.
// No production, external providers, money, GPS spoofing, paid time entries,
// persisted chat messages, or permanent QA users. Always clean fixtures.
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {createClient} from '@supabase/supabase-js'
import {createServerClient} from '@supabase/ssr'
import {chromium} from 'playwright'

const MAIN='https://uptilldawn-main.uptilldawn.workers.dev'
const DATABASE='https://npbjrtiolqperdgljnhi.supabase.co'
const PUBLIC_KEY='sb_publishable_zStTw3n8wZ271PehDRDvGg_rs0JOy84'
const RUN=process.env.GITHUB_RUN_ID||''
const COUNT=30
const HOLD_MS=65_000
const EVENT_NAME='UPT-QA-30-'+RUN
const OUTPUT='test-results/main-30-unique'
if(process.env.E2E_MAIN_QA_BASE_URL!==MAIN||
 process.env.E2E_MAIN_QA_SUPABASE_URL!==DATABASE||
 process.env.E2E_MAIN_QA_PUBLISHABLE_KEY!==PUBLIC_KEY||
 process.env.E2E_MAIN_QA_ALLOW_WRITE!=='1'||
 !process.env.E2E_MAIN_QA_SERVICE_KEY||
 !/^\d{8,}$/.test(RUN))
 throw Error('Thirty-user acceptance is restricted to explicitly authorized isolated Main')
const service=createClient(DATABASE,process.env.E2E_MAIN_QA_SERVICE_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
})
const expectedEmails=Array.from({length:COUNT},(_,i)=>'e2e-load30-'+RUN+'-'+String(i+1).padStart(2,'0')+'@uptilldawn.test')
const safeMessage=error=>String(error?.message||error||'unknown')
 .replace(/Bearer\s+[a-z0-9._-]+/gi,'Bearer [redacted]')
 .replace(/sb_secret_[a-z0-9_-]+/gi,'[redacted]')
 .replace(/e2e-load30-\d+-\d+@uptilldawn\.test/gi,'[qa-account]')
 .slice(0,190)
const report={
 target:'isolated-main-worker',identityCount:0,authenticated:0,browserReady:0,
 realtimeSubscribed:0,realtimeReceived:0,chatReads:0,availabilityReads:0,
 checkinDenied:0,timesheetReads:0,http5xx:0,failures:[],
 holdMs:HOLD_MS,cleanupVerified:false,
 scope:'30 separate Auth accounts, JWTs and browser contexts; RLS reads of crew/chat/check-in/time; 30 Realtime subscriptions and ephemeral broadcast. Check-ins are rejected for a future QA draft event; positive GPS/time writes are NOT simulated on shared Main.',
}
const errors=report.failures
const record=(step,error,index)=>{
 const item={step,index:index??null,message:safeMessage(error)}
 errors.push(item)
 console.error('MAIN_30_DISTINCT_ERROR '+JSON.stringify(item))
}
function throwIfError(result,label){
 if(result.error)throw Error(label+': '+String(result.error.code||result.error.status||'unknown'))
 return result.data
}
async function pool(items,max,label,work,{allowPartial=false,stopOnError=false}={}){
 const values=new Array(items.length)
 let next=0
 let stopped=false
 await Promise.all(Array.from({length:max},async()=>{
  for(;;){
   if(stopped)return
   const i=next++
   if(i>=items.length)return
   try{values[i]=await work(items[i],i)}catch(error){record(label,error,i+1);if(stopOnError)stopped=true}
  }
 }))
 if(Array.from({length:items.length},(_,i)=>values[i]).some(x=>x===undefined)&&!allowPartial)
  throw Error(label+' did not complete for all '+items.length+' unique users')
 return allowPartial?values.filter(x=>x!==undefined):values
}
async function scanAccounts(){
 const matched=[]
 for(let page=1;page<=50;page++){
  const {data,error}=await service.auth.admin.listUsers({page,perPage:100})
  if(error)throw Error('QA-only Auth enumeration failed: '+String(error.status||error.code||'unknown'))
  for(const user of data.users){
   if(expectedEmails.includes(String(user.email||'').toLowerCase())){
    const marker=String(user.user_metadata?.upt_main_30_run||'')
    if(marker!==RUN)throw Error('Unexpected account occupies a reserved QA email; refusing to modify it')
    matched.push(user)
   }
  }
  if(data.users.length<100)return matched
 }
 throw Error('QA-only Auth inventory exceeded safe pagination bound')
}
async function cleanup(){
 // During an overloaded Data API, never skip Auth cleanup just because
 // event lookup is unavailable. Each owned resource is cleaned independently.
 const failures=[]
 let deletedAccounts=0,deletedEvent=0
 let owned=[]
 try{owned=await scanAccounts()}
 catch(error){failures.push('Auth inventory: '+safeMessage(error))}
 for(const user of owned){
  try{
   const {error}=await service.auth.admin.deleteUser(user.id)
   if(error)throw Error(String(error.status||error.code||'unknown'))
   deletedAccounts++
  }catch(error){failures.push('Auth deletion: '+safeMessage(error))}
 }
 try{
  const {data:events,error:eventError}=await service.from('events')
   .select('id,name,status').eq('name',EVENT_NAME).limit(2)
   .abortSignal(AbortSignal.timeout(12000))
  if(eventError)throw Error('Scoped QA event lookup failed')
  if(events.length>1)throw Error('Multiple QA events, refusing event cleanup')
  if(events.length){
   const event=events[0]
   if(event.status!=='draft')throw Error('QA event became non-draft; refusing deletion')
   const {error}=await service.from('events').delete()
    .eq('id',event.id).eq('name',EVENT_NAME).eq('status','draft')
    .abortSignal(AbortSignal.timeout(12000))
   if(error)throw Error('Scoped QA event deletion failed')
   deletedEvent=1
  }
 }catch(error){failures.push('Event cleanup: '+safeMessage(error))}
 try{
  const remaining=await scanAccounts()
  if(remaining.length)failures.push('Owned QA Auth accounts remain: '+remaining.length)
 }catch(error){failures.push('Auth cleanup verification: '+safeMessage(error))}
 try{
  const {data,error}=await service.from('events').select('id').eq('name',EVENT_NAME).limit(1)
   .abortSignal(AbortSignal.timeout(12000))
  if(error||data?.length)failures.push('QA event remains or cannot be verified')
 }catch(error){failures.push('Event cleanup verification: '+safeMessage(error))}
 if(failures.length)throw Error(failures.slice(0,6).join('; '))
 return {deletedAccounts,deletedEvent,verified:true}
}
if(process.argv.includes('--cleanup')){
 try{
  const result=await cleanup()
  console.log('MAIN_30_DISTINCT_CLEANUP '+JSON.stringify(result))
 }catch(error){
  console.error('MAIN_30_DISTINCT_CLEANUP_FAILED '+safeMessage(error))
  process.exitCode=1
 }
}else{
 await mkdir(OUTPUT,{recursive:true})
 let browser
 const clients=[]
 const contexts=[]
 const started=Date.now()
 const failOnResponse=(response,index)=>{
  let pathname
  try{const address=new URL(response.url());if(address.origin!==MAIN)return;pathname=address.pathname}catch{return}
  if(response.status()>=500){
   report.http5xx++
   record('main-http5xx '+pathname,Error('HTTP '+response.status()),index)
  }
 }
 try{
  // Recover only fixtures for this exact GitHub Actions run identifier.
  // Never reuse unknown staff identities or rotate any human password.
  assert.equal((await scanAccounts()).length,0,'Existing same-run QA accounts need cleanup before a new attempt')
  const existing=await service.from('events').select('id').eq('name',EVENT_NAME).limit(1)
  throwIfError(existing,'QA event preflight')
  assert.equal(existing.data.length,0,'Previous QA event remains; invoke scoped cleanup')
  const people=[]
  for(let i=0;i<COUNT;i++){
   const email=expectedEmails[i]
   const password=randomBytes(32).toString('base64url')+'Aa9!'
   const response=await service.auth.admin.createUser({
    email,password,email_confirm:true,
    user_metadata:{full_name:'QA Load Staff '+String(i+1).padStart(2,'0'),
     upt_main_30_run:RUN,qa_fixture:true},
   })
   if(response.error||!response.data.user)throw Error('Temporary QA account provisioning failed at '+(i+1))
   const user=response.data.user
   const profile=await service.from('profiles').upsert({
    id:user.id,full_name:'QA Load Staff '+String(i+1).padStart(2,'0'),
    role:'staff',approved:true,account_blocked:false,
    app_profile_required:false,updated_at:new Date().toISOString(),
   },{onConflict:'id'})
   throwIfError(profile,'QA scoped profile')
   people.push({id:user.id,email,password,index:i+1})
  }
  assert.equal(new Set(people.map(p=>p.id)).size,COUNT,'Not thirty unique Auth identities')
  report.identityCount=people.length
  console.log('MAIN_30_DISTINCT_PROVISIONED count='+people.length)

  const start=new Date(Date.now()+2*86400_000).toISOString()
  const end=new Date(Date.now()+3*86400_000).toISOString()
  const event=throwIfError(await service.from('events').insert({
   name:EVENT_NAME,status:'draft',venue:'Isolated QA test only',
   start_at:start,end_at:end,start_date:start,end_date:end,
   onboarding_required:false,
  }).select('id').single(),'QA private draft event')
  const workplace=throwIfError(await service.from('workplaces').insert({
   event_id:event.id,name:EVENT_NAME+' post',minimum_staff:1,target_staff:COUNT,
  }).select('id').single(),'QA private workpost')
  const membership=await service.from('event_members').insert(
   people.map(p=>({event_id:event.id,user_id:p.id,event_role:'employee'})))
  throwIfError(membership,'QA scoped memberships')

  const sessions=await pool(people,3,'authenticated-session',async person=>{
   const client=createClient(DATABASE,PUBLIC_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
   })
   const {data,error}=await client.auth.signInWithPassword({
    email:person.email,password:person.password,
   })
   if(error||data.user?.id!==person.id||!data.session)
    throw Error('Temporary staff JWT authentication failed')
   // Let the official SSR library create exactly the cookie format understood
   // by the deployed Next middleware; no hand-built JWT/cookie encoding.
   const jar=new Map()
   const ssr=createServerClient(DATABASE,PUBLIC_KEY,{
    cookies:{
     getAll:()=>Array.from(jar,([name,value])=>({name,value})),
     setAll:values=>values.forEach(({name,value})=>jar.set(name,value)),
    },
   })
   const saved=await ssr.auth.setSession({
    access_token:data.session.access_token,
    refresh_token:data.session.refresh_token,
   })
   if(saved.error||!saved.data.session)throw Error('Supabase SSR cookie session could not be stored')
   const cookies=Array.from(jar,([name,value])=>({
    name,value,url:MAIN,path:'/',secure:true,httpOnly:false,sameSite:'Lax',
   }))
   // Use domain/path, not both url and path: Playwright validates their shape.
   cookies.forEach(c=>{delete c.path;delete c.secure})
   if(!cookies.some(c=>c.name.includes('-auth-token')))
    throw Error('Official SSR adapter returned no authentication cookies')
   clients.push(client)
   report.authenticated++
   return {person,client,cookies}
  })
  console.log('MAIN_30_DISTINCT_AUTHENTICATED count='+sessions.length)
  browser=await chromium.launch({headless:true})
  const pages=await pool(sessions,3,'browser-route',async ({person,cookies})=>{
   const context=await browser.newContext({
    locale:['nl','fr','en','de'][person.index%4],
    viewport:person.index%2?{width:390,height:844}:{width:1280,height:800},
    reducedMotion:'reduce',
   })
   contexts.push(context)
   await context.addCookies(cookies)
   const page=await context.newPage()
   page.on('pageerror',error=>record('browser-exception',error,person.index))
   page.on('response',response=>failOnResponse(response,person.index))
   const path=['/events','/tasks','/chat'][(person.index-1)%3]
   const response=await page.goto(MAIN+path,{waitUntil:'commit',timeout:45_000})
   assert.ok(response&&response.status()<400,'Protected Main URL failed to load')
   await page.locator('main').first().waitFor({state:'visible',timeout:35_000})
   assert.equal(new URL(page.url()).pathname,path,'SSR session lost or portal redirected')
   const text=(await page.locator('body').innerText()).trim()
   assert.ok(text.length>20,'Authenticated page remained blank')
   assert.doesNotMatch(text,/Worker exceeded resource limits|Application error: a server-side exception/i)
   report.browserReady++
   return {page,person}
  },{allowPartial:true})
  console.log('MAIN_30_DISTINCT_BROWSERS success='+pages.length+' of='+COUNT)
  // Continue isolated backend/Realtime checks even if Worker SSR is degraded;
  // this distinguishes Cloudflare CPU exhaustion from Auth, RLS or Realtime.
  // The final verdict still REQUIRES all thirty browser routes to succeed.

  await pool(sessions,3,'real-routes-and-rls',async ({person,client})=>{
   const member=throwIfError(await client.from('event_members')
    .select('user_id').eq('event_id',event.id).eq('user_id',person.id).abortSignal(AbortSignal.timeout(8000)),
    'RLS membership query')
   assert.equal(member.length,1,'Staff cannot read own membership')
   report.availabilityReads++
   const channels=throwIfError(await client.from('chat_channels')
    .select('id,name').eq('kind','organization').abortSignal(AbortSignal.timeout(8000)),'RLS chat directory')
   assert.deepEqual(channels.map(ch=>ch.name).sort(),['Algemene chat evenementen'],
    'Crew must see only its standard organization chat')
   throwIfError(await client.rpc('upt_chat_unread_total').abortSignal(AbortSignal.timeout(8000)),'Real chat badge RPC')
   report.chatReads++
   throwIfError(await client.from('check_ins').select('id')
    .eq('event_id',event.id).eq('user_id',person.id).limit(1).abortSignal(AbortSignal.timeout(8000)),
    'Own check-in history')
   const denied=await client.rpc('upt_request_check_in',{
    p_event:event.id,p_workplace:workplace.id,p_remote:false,
    p_gps_status:'not_checked',
   }).abortSignal(AbortSignal.timeout(8000))
   assert.ok(denied.error,'Future unpublished event accepted an unassigned check-in')
   assert.ok(denied.status<500,'Check-in service outage is not a valid authorization denial')
   assert.match(String(denied.error.message),/dienst|Werk & pauze/i,
    'Check-in was not rejected by the expected shift or operations guard')
   // Do not create synthetic attendance or GPS records.
   report.checkinDenied++
   throwIfError(await client.from('timesheets').select('id,status')
    .eq('event_id',event.id).eq('user_id',person.id).limit(1).abortSignal(AbortSignal.timeout(8000)),
    'Own time records')
   report.timesheetReads++
   return true
  },{stopOnError:true})
  console.log('MAIN_30_DISTINCT_CREW_READS '+JSON.stringify({
   chat:report.chatReads,checkinGuards:report.checkinDenied,
   timesheets:report.timesheetReads,
  }))

  // Realtime fan-out stays inside an isolated, ephemeral QA-only topic.
  // No public chat messages or database notifications are created.
  const topic='upt-main-qa-30-'+RUN
  // Five bounded subscription handshakes at a time: fail promptly if Realtime
  // is unavailable without keeping 30 temporary Auth accounts for minutes.
  const channels=await pool(sessions,5,'realtime-subscription',async ({client})=>{
   const ch=client.channel(topic,{config:{broadcast:{self:true,ack:true}}})
   ch.on('broadcast',{event:'qa-ping'},packet=>{
    if(packet.payload?.run===RUN)report.realtimeReceived++
   })
   const joined=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('Realtime subscribe timeout')),15_000)
    ch.subscribe(status=>{
     if(status==='SUBSCRIBED'){clearTimeout(timeout);resolve(true)}
     else if(status==='TIMED_OUT'||status==='CHANNEL_ERROR'||status==='CLOSED'){
      clearTimeout(timeout);reject(Error('Realtime '+status))
     }
    })
   })
   assert.ok(joined,'Realtime did not confirm subscribed status')
   report.realtimeSubscribed++
   return ch
  },{stopOnError:true})
  assert.equal(channels.length,COUNT)
  const delivery=await channels[0].send({
   type:'broadcast',event:'qa-ping',payload:{run:RUN},
  })
  assert.equal(delivery,'ok','Realtime broadcast could not be acknowledged')
  await new Promise(resolve=>setTimeout(resolve,5_000))
  assert.ok(report.realtimeReceived>=COUNT-1,
   'Realtime fan-out was not received by the distinct subscribed identities')
  console.log('MAIN_30_DISTINCT_REALTIME subscribed='+report.realtimeSubscribed+
   ' delivered='+report.realtimeReceived)
  console.log('MAIN_30_DISTINCT_HOLD sessions='+pages.length+' duration_ms='+HOLD_MS)
  await new Promise(resolve=>setTimeout(resolve,HOLD_MS))
  for(const {page,person} of pages){
   if(page.isClosed())record('unexpected-browser-close',Error('Browser closed'),person.index)
  }
  if(errors.length||report.http5xx)throw Error('Observed browser/server failures during concurrent test')
 }catch(error){record('acceptance',error,null)
 }finally{
  for(const context of contexts)await context.close().catch(()=>{})
  if(browser)await browser.close().catch(()=>{})
  for(const client of clients){
   await client.removeAllChannels().catch(()=>{})
   client.realtime.disconnect()
  }
  try{
   const cleaned=await cleanup()
   report.cleanupVerified=cleaned.verified
   console.log('MAIN_30_DISTINCT_CLEANUP '+JSON.stringify(cleaned))
  }catch(error){record('cleanup',error,null)}
  report.durationMs=Date.now()-started
  report.pass=report.identityCount===COUNT&&report.authenticated===COUNT&&
   report.browserReady===COUNT&&report.realtimeSubscribed===COUNT&&
   report.realtimeReceived>=COUNT-1&&report.chatReads===COUNT&&
   report.checkinDenied===COUNT&&report.timesheetReads===COUNT&&
   report.http5xx===0&&errors.length===0&&report.cleanupVerified
  await writeFile(OUTPUT+'/report.json',JSON.stringify(report,null,2)+'\n')
  console.log('MAIN_30_DISTINCT_RESULT '+JSON.stringify({
   pass:report.pass,identities:report.identityCount,authenticated:report.authenticated,
   browsers:report.browserReady,realtime:report.realtimeSubscribed,
   delivered:report.realtimeReceived,http5xx:report.http5xx,
   failed:errors.length,cleaned:report.cleanupVerified,
  }))
  if(!report.pass)process.exitCode=1
 }
}