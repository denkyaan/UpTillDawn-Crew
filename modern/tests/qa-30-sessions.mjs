// 30 separately-issued signed Main-QA sessions and bounded live read fanout.
// Browser/Worker performance requires separate deployment telemetry: this
// directly tests the existing Supabase Auth + RLS database path.
import {createClient} from "@supabase/supabase-js"
const target=new URL(process.env.E2E_MAIN_QA_BASE_URL||"")
if(target.origin!=="https://npbjrtiolqperdgljnhi.supabase.co"||
 target.pathname!=="/"||target.search||target.hash)throw Error("QA_ONLY_ENDPOINT_REQUIRED")
const remoteWorker=process.env.E2E_MAIN_MODERN_QA_ORIGIN||""
if(remoteWorker&&remoteWorker!=="https://uptilldawn-modern-main.uptilldawn.workers.dev")
 throw Error("EXACT_MODERN_MAIN_QA_WORKER_REQUIRED")
const key=process.env.E2E_MAIN_QA_PUBLISHABLE_KEY||""
const password=process.env.E2E_MAIN_QA_PASSWORD||""
if(!key.startsWith("sb_publishable_")||password.length<24)throw Error("QA_CREDENTIALS_NOT_CONFIGURED")
if(process.env.VITE_MIGRATION_ALLOW_WRITES!=="false")throw Error("QA_READ_ONLY_REQUIRED")
const emails=[
 "e2e-head-admin@uptilldawn.test","e2e-admin@uptilldawn.test",
 "e2e-right-hand@uptilldawn.test","e2e-responsible@uptilldawn.test",
 "e2e-staff@uptilldawn.test","e2e-promotion@uptilldawn.test",
 "e2e-administration@uptilldawn.test",
]
const url=target.origin
const sessions=[]
const sessionIds=new Set()
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function signedSession(email){
 const client=createClient(url,key,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
 })
 let authenticated=null
 for(let trial=0;trial<3;trial++){
  const {data,error}=await client.auth.signInWithPassword({email,password})
  if(!error&&data.session&&data.user){authenticated=data;break}
  if(!error||error.status!==429||trial===2)throw Error("QA_SESSION_LOGIN_REJECTED")
  await sleep((trial+1)*1500)
 }
 if(!authenticated?.session||!authenticated.user)throw Error("QA_SESSION_MISSING")
 const payload=JSON.parse(Buffer.from(authenticated.session.access_token.split(".")[1],"base64url").toString("utf8"))
 if(!payload.session_id||typeof payload.session_id!=="string"||sessionIds.has(payload.session_id))
  throw Error("QA_DUPLICATE_SESSION_ID")
 sessionIds.add(payload.session_id)
 return {client,uid:authenticated.user.id,email,token:authenticated.session.access_token}
}
async function checkSession(record){
 const started=performance.now()
 if(remoteWorker){
  // Real Hono Worker: JWT signature verification + one verified RLS identity
  // per request. Read-only, noncached and no shared Worker user/session state.
  const response=await fetch(remoteWorker+"/api/v1/session",{
   method:"GET",headers:{Authorization:"Bearer "+record.token,Accept:"application/json"},
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)
  })
  if(response.status!==200)throw Error("MODERN_QA_SIGNED_WORKER_HTTP_"+response.status)
  const data=await response.json()
  if(!data||data.id!==record.uid||typeof data.role!=="string"||
   data.owner!==true&&data.owner!==false)throw Error("MODERN_QA_WORKER_IDENTITY_INVALID")
 }else{
  const {data,error}=await record.client.rpc("upt_current_session_context")
   .abortSignal(AbortSignal.timeout(15000))
  if(error||!Array.isArray(data)||data.length!==1||data[0]?.id!==record.uid||
   data[0]?.approved!==true||data[0]?.account_blocked===true)
   throw Error("QA_RLS_SESSION_UNAVAILABLE")
 }
 return Math.round(performance.now()-started)
}
try{
 // Graceful authentication ramp: avoid creating 30 sessions in one burst.
 for(let i=0;i<30;i++){
  sessions.push(await signedSession(emails[i%emails.length]))
  await sleep(180)
 }
 if(sessionIds.size!==30)throw Error("QA_THIRTY_DISTINCT_SIGNED_SESSIONS_REQUIRED")
 // Two bounded stages, then one controlled 30-request peak for resource evidence.
 let totalQueries=0
 let worst=0
 let finalP95=0
 for(const size of [6,12,30]){
  const elapsed=await Promise.all(sessions.slice(0,size).map(checkSession))
  totalQueries+=elapsed.length
  const sorted=[...elapsed].sort((a,b)=>a-b)
  const p95=sorted[Math.ceil(sorted.length*.95)-1]
  finalP95=p95
  worst=Math.max(worst,...sorted)
  console.log(JSON.stringify({qaSessionReadStage:size,passed:size,p95Millis:p95,maxMillis:Math.max(...sorted)}))
  if(p95>12500)throw Error("QA_SESSION_LATENCY_EXCEEDED")
  await sleep(250)
 }
 console.log(JSON.stringify({
  signedSessions:sessionIds.size,distinctAccounts:emails.length,
  qaReadQueries:totalQueries,peakConcurrentReads:30,
  p95Millis:finalP95,maxMillis:worst,failures:0,
  target:remoteWorker?"deployed-modern-main-qa-worker":"isolated-main-qa-supabase",cloudflareWorkerMeasured:Boolean(remoteWorker),
  businessWrites:0,productionReady:false
 }))
}finally{
 // Revoke only the individual QA session, not global sign-out for a bot.
 for(const entry of sessions){
  try{await entry.client.auth.signOut({scope:"local"})}catch{}
 }
}
