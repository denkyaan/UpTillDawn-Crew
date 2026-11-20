// Real Main-QA modern Worker acceptance. HTTP only, no test credentials,
// mutation, browser cookies, prod endpoints or payment confirmation.
const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
if(process.env.E2E_MAIN_MODERN_QA_ORIGIN!==origin)
 throw Error("MODERN_MAIN_QA_EXACT_ORIGIN_REQUIRED")
const get=async(path,init={})=>{
 const response=await fetch(origin+path,{
  redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(12000),...init
 })
 return response
}
// A newly published Worker can take a few seconds to become visible in each
// Cloudflare edge POP. Retry ONLY bounded public GET probes, and record the
// actual response status rather than producing a context-free health failure.
// Authenticated and mutating probes below are never retried.
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function getAfterPropagation(path,expected,init={},accept=()=>true){
 let last
 for(let attempt=1;attempt<=10;attempt++){
  try{
   last=await get(path,init)
   if(last.status===expected&&accept(last))return last
   console.error("MODERN_MAIN_QA_EDGE "+path+" attempt "+attempt+
    "/10 HTTP "+last.status+" content-type="+(last.headers.get("content-type")||"none")+
    " cf-ray="+(last.headers.get("cf-ray")||"none")+
    " auth-protocol="+(last.headers.get('x-uptilldawn-auth-protocol')||'none'))
   await last.body?.cancel().catch(()=>{})
  }catch(error){
   console.error("MODERN_MAIN_QA_NETWORK "+path+" attempt "+attempt+
    "/10 "+(error instanceof Error?error.name:"unknown"))
   if(attempt===10)throw error
  }
  if(attempt<10)await pause(Math.min(1000+attempt*350,4000))
 }
 return last
}
function check(value,label){if(!value)throw Error("MODERN_MAIN_QA_"+label)}
const health=await getAfterPropagation("/api/v1/health",200)
check(health.status===200,"HEALTH_STATUS")
check(health.headers.get("x-content-type-options")==="nosniff","API_NOSNIFF")
check((health.headers.get("cache-control")||"").includes("no-store"),"API_NO_STORE")
check((await health.json()).service==="uptilldawn-local-first-api","REAL_HONO_WORKER")
// An old POP can return a perfectly healthy 200 from the previous Worker.
// Wait for this revision using a public GET before the single auth POST.
const nativeReady=await getAfterPropagation('/api/v1/health',200,{},response=>response.headers.get('x-uptilldawn-auth-protocol')==='main-auth-native-v1')
check(nativeReady.headers.get('x-uptilldawn-auth-protocol')==='main-auth-native-v1','NATIVE_AUTH_DEPLOYMENT_VISIBLE')
await nativeReady.body?.cancel()
const login=await getAfterPropagation("/login",200,{headers:{"Sec-Fetch-Mode":"navigate"}})
check(login.status===200,"LOGIN_DOCUMENT")
check((login.headers.get("content-type")||"").includes("text/html"),"LOGIN_HTML")
const html=await login.text()
check(html.includes('id="root"'),"REACT_SPA_SHELL")
const found=html.match(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/)
check(Boolean(found),"BUNDLED_ASSET_LINK")
const asset=await getAfterPropagation(found[1],200)
check(asset.ok,"BUNDLED_ASSET")
// Empty mandatory fields return BEFORE Supabase, login audit or mail. This
// checks the real internal service transport without credentials or writes.
const emptyForm=new FormData()
emptyForm.set("portal","staff");emptyForm.set("email","");emptyForm.set("password","")
const authTransport=await get("/api/auth/portal-login",{
 method:"POST",headers:{Origin:origin,"Sec-Fetch-Site":"same-origin"},body:emptyForm,
})
check(authTransport.status===200,"AUTH_TRANSPORT_HTTP_"+authTransport.status)
check(authTransport.headers.get('x-uptilldawn-auth-runtime')==='native-original-source','ORIGINAL_NATIVE_AUTH_RUNTIME')
const emptyResult=await authTransport.json()
check(emptyResult.error==="E-mail en wachtwoord zijn verplicht."&&emptyResult.success!==true,"AUTH_REQUIRED_FIELD_VALIDATION")
const noSession=await get("/api/v1/session")
check(noSession.status===401,"ANON_SESSION_DENIED")
check((await noSession.json()).error==="authentication_required","AUTH_DENY_BODY")
const noTickets=await get("/api/v1/tickets/weeztix/scan",{
 method:"POST",headers:{"Content-Type":"application/json","Origin":origin},body:"{}"
})
check(noTickets.status===401,"ANON_TICKET_WRITE_DENIED")
const noOauth=await get("/api/v1/integrations/oauth/start",{
 method:"POST",headers:{"Content-Type":"application/json","Origin":origin},body:"{}"
})
check(noOauth.status===401,"ANON_OAUTH_WRITE_DENIED")
const unknown=await get("/api/v1/not-a-route")
check(unknown.status===404,"UNKNOWN_API_NOT_SPA")
const missing=await getAfterPropagation("/nonexistent-path-123",200,{headers:{"Sec-Fetch-Mode":"navigate"}})
check(missing.status===200,"CLIENT_ROUTE_FALLBACK")
check((await missing.text()).includes('id="root"'),"SPA_FALLBACK_CONTENT")
console.log(JSON.stringify({ok:true,worker:"uptilldawn-modern-main",
 actualOrigin:origin,appShell:true,assetServed:true,honoHealth:true,originalAuthTransportVerified:true,
 anonymousSessionBlocked:true,anonymousScanBlocked:true,
 anonymousOauthBlocked:true,unknownApiFailsClosed:true,
 workerIsolatedFromLegacy:true,release:"Main QA only; production untouched",
 roleWriteParityNotVerified:true}))
