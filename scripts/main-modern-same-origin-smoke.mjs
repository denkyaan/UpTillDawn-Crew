// Read-only live check of the lightweight SPA mounted on the EXISTING Main
// hostname. Tests actual Cloudflare static assets, guarded Hono read proxy and
// continued availability of the legacy Main login. Production is not touched.
const origin="https://uptilldawn-main.uptilldawn.workers.dev"
const get=path=>fetch(origin+path,{method:"GET",redirect:"follow",cache:"no-store",
 signal:AbortSignal.timeout(10000)})
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const verify=async(path,expected,contentType)=>{
 let last
 for(let attempt=1;attempt<=8;attempt++){
  try{
   last=await get(path)
   if(last.status===expected&&(!contentType||(last.headers.get("content-type")||"").includes(contentType)))return last
   console.error("MAIN_MODERN_EDGE "+path+" "+attempt+"/8 HTTP "+last.status+
    " type="+(last.headers.get("content-type")||"none"))
   await last.body?.cancel().catch(()=>{})
  }catch(error){
   console.error("MAIN_MODERN_NETWORK "+path+" "+attempt+"/8 "+
    (error instanceof Error?error.name:"unknown"))
   if(attempt===8)throw error
  }
  if(attempt<8)await sleep(2000)
 }
 throw Error("MAIN_MODERN_UNAVAILABLE "+path+" HTTP "+last?.status)
}
const entry=await verify("/modern",200,"text/html")
const html=await entry.text()
if(!html.includes('id="root"'))throw Error("MAIN_MODERN_ROOT_NOT_SPA")
const asset=html.match(/(?:src|href)="(\/modern\/assets\/[^"]+\.(?:js|css))"/)
if(!asset)throw Error("MAIN_MODERN_ASSET_PATH_NOT_MOUNTED")
const bundle=await verify(asset[1],200)
const mime=bundle.headers.get("content-type")||""
if(!mime.includes("javascript")&&!mime.includes("css"))throw Error("MAIN_MODERN_ASSET_NOT_CODE")
const login=await verify("/modern/login",200,"text/html")
if(!(await login.text()).includes('id="root"'))throw Error("MAIN_MODERN_CLIENT_ROUTE_NOT_SPA")
const health=await verify("/api/v1/health",200,"application/json")
if((await health.json()).service!=="uptilldawn-local-first-api")throw Error("MAIN_MODERN_HONO_PROXY_MISMATCH")
const session=await verify("/api/v1/session",401,"application/json")
if((await session.json()).error!=="authentication_required")throw Error("MAIN_MODERN_ANON_GUARD")
const legacy=await verify("/login/admin",200,"text/html")
if(legacy.headers.get("x-uptilldawn-static-login")!=="1")throw Error("MAIN_LEGACY_LOGIN_REPLACED")
console.log(JSON.stringify({passed:true,hostname:new URL(origin).host,modernPath:"/modern",
 staticAsset:true,clientRoute:true,honoReadBridge:true,anonymousDenied:true,
 legacyLoginIntact:true,writeOperationsAttempted:0,productionUntouched:true}))
