// Explicit opt-in Main QA, real signed native Hono requests in-process.
// Public Worker writes stay OFF. The service key is used ONLY to locate,
// verify and delete this run's uniquely named draft fixture and children.
// No provider calls, payment, invoice, live event, auth user creation,
// role changes, uploads or Maker authority are exercised here.
import assert from "node:assert/strict"
import {mkdir,writeFile} from "node:fs/promises"
import {resolve} from "node:path"
import {createClient} from "@supabase/supabase-js"
import {createServerClient,serializeCookieHeader,parseCookieHeader} from "@supabase/ssr"
import app from "../src/api/worker.ts"
import {sourceReadSession} from "../src/api/native-main-reads.ts"
import {MAIN_ORIGIN,CANDIDATE_ORIGIN,MAIN_QA_DATABASE} from "../src/api/runtime-scope.ts"
import {encode} from "../../lib/migration/wire.ts"

const qa=MAIN_QA_DATABASE,origin=MAIN_ORIGIN
const key=process.env.E2E_MAIN_QA_PUBLISHABLE_KEY||""
const secret=process.env.E2E_MAIN_QA_SERVICE_KEY||""
const password=process.env.E2E_MAIN_QA_PASSWORD||""
const run=process.env.GITHUB_RUN_ID||"",attempt=process.env.GITHUB_RUN_ATTEMPT||""
if(process.env.E2E_MAIN_MODERN_QA_ORIGIN!==CANDIDATE_ORIGIN||
 process.env.E2E_MAIN_QA_BASE_URL!==qa+"/"||
 process.env.VITE_MIGRATION_ALLOW_WRITES!=="false"||
 process.env.E2E_MAIN_QA_ALLOW_NATIVE_FIXTURE!=="1"||
 !/^\d+$/.test(run)||!/^\d+$/.test(attempt)||
 key!=="sb_publishable_zStTw3n8wZ271PehDRDvGg_rs0JOy84"||
 !secret||secret===key||password.length<24)throw Error("NATIVE_FIXTURE_EXACT_MAIN_QA_ONLY")
const prefix="UPT-QA-NATIVE-"+run+"-"+attempt
const names=[prefix+" Draft",prefix+" Edited",prefix+" Denied"]
const workplaceNames=[prefix+" Post",prefix+" Updated post"]
const briefingTitles=[prefix+" Briefing",prefix+" Updated briefing"]
const bookingName=prefix+" Artist"
const cleanupOnly=process.argv.includes("--cleanup")
const reportDir=resolve(import.meta.dirname,"../../test-results/modern-native-fixtures")
const checks=[],sessions=[]
const service=createClient(qa,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:key,UPT_MIGRATION_NATIVE_AUTH_ENABLED:"true",
 UPT_MIGRATION_RUNTIME_TARGET:"main-standalone",UPT_MIGRATION_ALLOW_WRITES:"true"}
const draftAction="app/(app)/portals/administration/modules/[slug]/page.tsx#saveAdministrationEventDraft"
const bookingAction="app/(app)/portals/administration/modules/artists/new/page.tsx#createBooking"
const crew=(name)=>"lib/actions/uptilldawn.ts#"+name
let office,head,staff,fixtureId=null,failed=null,cleaned=false
const tick=name=>{checks.push(name);console.log("PASS native fixture "+name)}
async function rows(query,label){
 const {data,error}=await query
 if(error)throw Error(label+"_"+(error.code||"DB_ERROR"))
 return data||[]
}
async function one(query,label){
 const data=await rows(query,label)
 assert.equal(data.length,1,label+"_EXPECTED_ONE")
 return data[0]
}
async function actor(email,expectedAdmin){
 const jar=new Map()
 const db=createServerClient(qa,key,{cookies:{
  getAll:()=>Array.from(jar,([name,value])=>({name,value})),
  setAll:changes=>{for(const {name,value,options} of changes)if(options?.maxAge===0)jar.delete(name);else jar.set(name,value)}
 }})
 const {data,error}=await db.auth.signInWithPassword({email,password})
 if(error||data.user?.email!==email||!data.session)throw Error("NATIVE_FIXTURE_BOT_SIGNIN")
 const result={db,id:data.user.id,jar,cookie:()=>Array.from(jar,([name,value])=>serializeCookieHeader(name,value).split(";")[0]).join("; ")}
 sessions.push(result)
 const verified=await sourceReadSession(new Request(origin+"/api/push/config",{headers:{Cookie:result.cookie()}}),env)
 assert.equal(verified.ok,true)
 assert.equal(verified.identity.id,result.id)
 assert.equal(verified.identity.is_owner,false)
 const {data:admin,error:adminError}=await db.rpc("upt_is_admin",{uid:result.id})
 assert.ifError(adminError);assert.equal(admin,expectedAdmin)
 return result
}
async function invoke(identity,id,fields,expected=200){
 const fd=new FormData()
 for(const [name,value] of Object.entries(fields))fd.set(name,String(value))
 const body=new FormData();body.set("_id",id);body.set("_args",JSON.stringify(encode([fd],body)))
 const response=await app.request(new Request(origin+"/api/migration/actions",{
  method:"POST",headers:{Origin:origin,"Sec-Fetch-Site":"same-origin",
   Cookie:identity.cookie(),"X-UpTillDawn-Action-Hint":id},body
 }),{},env)
 assert.equal(response.status,expected,id.split("#")[1]+"_HTTP")
 for(const value of response.headers.getSetCookie()){
  for(const c of parseCookieHeader(value.split(";")[0]))identity.jar.set(c.name,c.value||"")
 }
 const data=await response.json()
 if(expected===200)assert.ok(data.refresh===true||typeof data.redirect==="string")
 else assert.equal(data.code,"action_failed")
 return data
}
async function findFixtures(){
 const data=await rows(service.from("events").select("id,name,created_by,status").in("name",names).eq("created_by",office.id),"FIND_FIXTURE")
 for(const r of data)assert.equal(r.status,"draft","REFUSE_NON_DRAFT_CLEANUP")
 return data
}
async function remove(table,event,field,allowed){
 const existing=await rows(service.from(table).select("id,"+field).eq("event_id",event.id).in(field,allowed),"FIND_"+table)
 for(const row of existing){
  const deleted=await rows(service.from(table).delete().eq("id",row.id).eq("event_id",event.id).eq(field,row[field]).select("id"),"DELETE_"+table)
  assert.equal(deleted.length,1,"CLEANUP_COUNT_"+table)
 }
 const remaining=await rows(service.from(table).select("id").eq("event_id",event.id).in(field,allowed),"VERIFY_"+table)
 assert.equal(remaining.length,0,"CLEANUP_RESIDUAL_"+table)
}
async function cleanup(){
 if(!office)throw Error("CLEANUP_IDENTITY_UNVERIFIED")
 for(const event of await findFixtures()){
  assert.equal(event.created_by,office.id)
  assert.ok(names.includes(event.name))
  await remove("admin_artist_bookings",event,"artist_name",[bookingName])
  await remove("briefings",event,"title",briefingTitles)
  await remove("workplaces",event,"name",workplaceNames)
  // Event removal only after rechecking the exact owner, draft status and name.
  // The original QA fixture cleanup already exercises this delete path.
  let removed=false
  for(let i=1;i<=3;i++){
   const {data,error}=await service.from("events").delete().eq("id",event.id)
    .eq("created_by",office.id).eq("status","draft").eq("name",event.name).select("id")
   if(!error&&data?.length===1){removed=true;break}
   if(!error){
    const residual=await rows(service.from("events").select("id").eq("id",event.id),"CHECK_DELETE")
    if(!residual.length){removed=true;break}
    throw Error("CLEANUP_OWNERSHIP_CHANGED")
   }
   if(error.code!=="57014"||i===3)throw Error("CLEANUP_EVENT_"+(error.code||"DB_ERROR"))
   await new Promise(done=>setTimeout(done,i*500))
  }
  assert.equal(removed,true)
 }
 assert.equal((await findFixtures()).length,0,"NATIVE_FIXTURE_RESIDUAL")
 if(fixtureId)assert.equal((await rows(service.from("events").select("id").eq("id",fixtureId),"VERIFY_ID")).length,0)
 cleaned=true;tick("exact owned draft and fixture children removed")
}

try{
 office=await actor("e2e-administration@uptilldawn.test",false)
 if(!cleanupOnly){
  head=await actor("e2e-head-admin@uptilldawn.test",true)
  staff=await actor("e2e-staff@uptilldawn.test",false)
  assert.equal(new Set([office.id,head.id,staff.id]).size,3)
  assert.equal((await findFixtures()).length,0,"RUN_FIXTURE_ALREADY_EXISTS")
  const start=new Date(Date.now()+5*86400000).toISOString()
  const end=new Date(Date.parse(start)+12*3600000).toISOString()
  const eventFields={name:names[0],venue:"QA only",start_at:start,end_at:end}
  await invoke(office,draftAction,eventFields)
  const created=await one(office.db.from("events").select("id,name,status,created_by")
   .eq("name",names[0]).eq("created_by",office.id),"DRAFT_CREATED")
  assert.equal(created.status,"draft");fixtureId=created.id
  tick("Administration native action creates an owned unpublished draft")
  await invoke(office,draftAction,{...eventFields,event_id:fixtureId,name:names[1]})
  assert.equal((await one(office.db.from("events").select("name").eq("id",fixtureId),"DRAFT_EDITED")).name,names[1])
  tick("Administration native edit persists")
  await invoke(staff,draftAction,{...eventFields,event_id:fixtureId,name:names[2]},422)
  assert.equal((await one(office.db.from("events").select("name").eq("id",fixtureId),"DRAFT_DENIAL")).name,names[1])
  tick("Staff cannot edit the administrative draft")
  const post={event_id:fixtureId,name:workplaceNames[0],default_shift_start:start,default_shift_end:end,minimum_staff:"1",target_staff:"1",sort_order:"999"}
  await invoke(staff,crew("addWorkplace"),post,422)
  assert.equal((await rows(head.db.from("workplaces").select("id").eq("event_id",fixtureId).eq("name",workplaceNames[0]),"WORKPOST_DENIAL")).length,0)
  tick("Staff cannot add a workplace")
  await invoke(head,crew("addWorkplace"),post)
  const workplace=await one(head.db.from("workplaces").select("id,name,event_id").eq("event_id",fixtureId).eq("name",workplaceNames[0]),"WORKPOST_CREATED")
  tick("Head Admin native workplace creation persists")
  await invoke(head,crew("updateWorkplace"),{...post,workplace_id:workplace.id,name:workplaceNames[1],is_active:"on"})
  assert.equal((await one(head.db.from("workplaces").select("name").eq("id",workplace.id),"WORKPOST_UPDATED")).name,workplaceNames[1])
  tick("Head Admin native workplace update persists")
  const briefing={event_id:fixtureId,workplace_id:workplace.id,title:briefingTitles[0],body:"QA draft only"}
  await invoke(head,crew("createBriefing"),briefing)
  const b=await one(head.db.from("briefings").select("id,title,event_id").eq("event_id",fixtureId).eq("title",briefingTitles[0]),"BRIEFING_CREATED")
  tick("Native briefing creation persists")
  await invoke(head,crew("updateBriefing"),{...briefing,id:b.id,title:briefingTitles[1],body:"QA corrected"})
  assert.equal((await one(head.db.from("briefings").select("title").eq("id",b.id),"BRIEFING_EDITED")).title,briefingTitles[1])
  tick("Native briefing edit persists")
  await invoke(staff,bookingAction,{event_id:fixtureId,artist_name:bookingName,fee_amount:"120"},422)
  assert.equal((await rows(office.db.from("admin_artist_bookings").select("id").eq("event_id",fixtureId).eq("artist_name",bookingName),"BOOKING_DENIAL")).length,0)
  tick("Staff cannot create a booking")
  await invoke(office,bookingAction,{event_id:fixtureId,artist_name:bookingName,fee_amount:"120"})
  const booking=await one(office.db.from("admin_artist_bookings").select("status,created_by").eq("event_id",fixtureId).eq("artist_name",bookingName),"BOOKING_CREATED")
  assert.equal(booking.status,"enquiry");assert.equal(booking.created_by,office.id)
  tick("Native Administration booking creation persists")
 }
}catch(error){
 // Avoid serializing request URLs, cookie headers, credentials or full DB errors.
 failed=error instanceof Error?error.message.split("\n")[0].replaceAll(secret,"[redacted]").replaceAll(password,"[redacted]").slice(0,180):"NATIVE_FIXTURE_FAILED"
 console.error("FAIL native fixture "+failed)
}finally{
 try{await cleanup()}catch(error){
  failed=(failed?failed+" | ":"")+"cleanup:"+(error instanceof Error?error.name:"Error")
  console.error("FAIL native fixture cleanup")
 }
 for(const identity of sessions)try{await identity.db.auth.signOut({scope:"local"})}catch{}
 await mkdir(reportDir,{recursive:true})
 const report={scope:"exact Main QA database; in-process native standalone Main; public writes unchanged",cleanupOnly,checks,positiveActions:cleanupOnly?0:checks.filter(x=>/persists|creates an owned/.test(x)).length,
  cleaned,failed:Boolean(failed),failure:failed,all163ActionsVerified:false,productionReady:false}
 await writeFile(resolve(reportDir,cleanupOnly?"cleanup.json":"transactions.json"),JSON.stringify(report,null,2)+"\n")
 console.log(JSON.stringify(report))
}
if(failed||!cleaned||(!cleanupOnly&&checks.length!==11))process.exitCode=1
