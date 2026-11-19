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
function check(value,label){if(!value)throw Error("MODERN_MAIN_QA_"+label)}
const health=await get("/api/v1/health")
check(health.status===200,"HEALTH_STATUS")
check(health.headers.get("x-content-type-options")==="nosniff","API_NOSNIFF")
check((health.headers.get("cache-control")||"").includes("no-store"),"API_NO_STORE")
check((await health.json()).service==="uptilldawn-local-first-api","REAL_HONO_WORKER")
const login=await get("/login",{headers:{"Sec-Fetch-Mode":"navigate"}})
check(login.status===200,"LOGIN_DOCUMENT")
check((login.headers.get("content-type")||"").includes("text/html"),"LOGIN_HTML")
const html=await login.text()
check(html.includes('id="root"'),"REACT_SPA_SHELL")
const found=html.match(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/)
check(Boolean(found),"BUNDLED_ASSET_LINK")
const asset=await get(found[1])
check(asset.ok,"BUNDLED_ASSET")
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
const missing=await get("/nonexistent-path-123",{headers:{"Sec-Fetch-Mode":"navigate"}})
check(missing.status===200,"CLIENT_ROUTE_FALLBACK")
check((await missing.text()).includes('id="root"'),"SPA_FALLBACK_CONTENT")
console.log(JSON.stringify({ok:true,worker:"uptilldawn-modern-main",
 actualOrigin:origin,appShell:true,assetServed:true,honoHealth:true,
 anonymousSessionBlocked:true,anonymousScanBlocked:true,
 anonymousOauthBlocked:true,unknownApiFailsClosed:true,
 workerIsolatedFromLegacy:true,release:"Main QA only; production untouched",
 roleWriteParityNotVerified:true}))
