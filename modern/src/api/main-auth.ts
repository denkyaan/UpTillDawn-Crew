import {readBoundedFormData} from "../../../lib/bounded-form-data.ts"
import {nativeOriginalAuth,type MainAuthRuntimeBinding} from './native-auth.ts'
import {MAIN_AUTH_PRIVATE_ENV_KEYS} from "../../../lib/migration/main-auth-runtime-config.ts"
import {runtimeForRequest,MAIN_ORIGIN} from "./runtime-scope.ts"

export const MAIN_AUTH_ORIGIN=MAIN_ORIGIN
export type MainAuthBindings={
 SUPABASE_URL:string;SUPABASE_ANON_KEY?:string;
 UPT_MIGRATION_NATIVE_AUTH_ENABLED?:string;
 UPT_MIGRATION_RUNTIME_TARGET?:string;
 MAIN_AUTH_RUNTIME?:MainAuthRuntimeBinding;
 MAIN_AUTH?:{fetch:(request:Request)=>Promise<Response>}
 RESEND_API_KEY?:string;SECURITY_ALERT_EMAIL?:string;
 SECURITY_FROM_EMAIL?:string;GEOAPIFY_API_KEY?:string;
 UPT_MIGRATION_EMAIL_CALLBACK_READY?:string
}
const paths=new Set(["/api/auth/admin-login","/api/auth/portal-login","/api/auth/account-action","/auth/callback"])
const portals=new Set(["staff","responsible","admin","promotion","administration"])
const actions=new Set(["signUp","forgotPassword","updatePassword","resendVerificationEmail","signOut"])
function rejected(status:number,code:string){
 return Response.json({error:"De aanmeldservice is tijdelijk niet bereikbaar. Probeer opnieuw.",code},{status,headers:{"Cache-Control":"private, no-store"}})
}

export function authResponseCookies(headers:Headers):string[]{
 const runtime=headers as Headers&{getAll?:(name:string)=>string[]}
 if(typeof runtime.getSetCookie==="function")return runtime.getSetCookie()
 // Workers deliberately retains getAll for Set-Cookie. Never split a folded
 // header: cookie expiry dates contain commas and sessions may be chunked.
 if(typeof runtime.getAll==="function")return runtime.getAll("Set-Cookie")
 if(headers.has("Set-Cookie"))throw Error("UNSUPPORTED_AUTH_COOKIE_API")
 return []
}

// Temporary migration boundary: only explicit authentication requests use the
// existing Main service. Static screens and navigation stay entirely on Vite.
// The service binding reuses the live audited action, its keys, IP context,
// mail alerts, cookie writes and denial rules; none is copied to the client.
export async function forwardMainAuth(request:Request,env:MainAuthBindings):Promise<Response>{
 const url=new URL(request.url)
 const direct=env.UPT_MIGRATION_NATIVE_AUTH_ENABLED==="true"
 const scope=runtimeForRequest(request.url,env)
 if(!scope||(!direct&&!env.MAIN_AUTH&&!env.MAIN_AUTH_RUNTIME))
  return rejected(503,"auth_service_unconfigured")
 if(!paths.has(url.pathname))return rejected(404,"auth_path_denied")
 const callback=url.pathname==="/auth/callback"
 const adminLogin=url.pathname==="/api/auth/admin-login"
 if(request.method!==(callback?"GET":"POST"))return rejected(405,"method_not_allowed")
 let form:FormData|undefined
 if(!callback){
  const site=request.headers.get("sec-fetch-site")
  if(request.headers.get("origin")!==url.origin||(site&&site!=="same-origin"))return rejected(403,"invalid_origin")
  const contentType=(request.headers.get("content-type")||"").toLowerCase()
  // For no-JS Admin submission permit only exact UTF-8 url-encoded forms.
  // Reject bad/unsupported charsets as media types before reading credentials.
  if(!contentType.startsWith("multipart/form-data;")&&
     !(adminLogin&&/^application\/x-www-form-urlencoded(?:;\s*charset=utf-8)?$/.test(contentType.trim())))
   return rejected(415,"invalid_content_type")
  try{form=await readBoundedFormData(request,16_384,adminLogin)}
  catch(error){return rejected(error instanceof Error&&error.message==="too_large"?413:400,"invalid_form")}
  for(const [,value] of form)if(typeof value!=="string"||value.length>2048)return rejected(413,"form_too_large")
  if(url.pathname.endsWith("portal-login")&&!portals.has(String(form.get("portal")||"")))return rejected(403,"invalid_portal")
  if(url.pathname.endsWith("account-action")&&!actions.has(String(form.get("_action")||"")))return rejected(400,"invalid_action")
  if(url.pathname.endsWith("account-action"))form.set("_callback_origin",scope.requestOrigin)
 }
 const upstreamUrl=new URL(url.pathname+(callback?url.search:""),scope.appOrigin)
 const headers=new Headers({Accept:callback?"text/html":"application/json"})
 // A service-binding Request does not acquire the network fetch's Host header.
 // OpenNext constructs Next's request origin from Host/X-Forwarded-Host. Pin
 // both to the SAME fixed service URL so the original CSRF check still holds.
 headers.set("Host",upstreamUrl.host)
 headers.set("X-Forwarded-Host",upstreamUrl.host)
 headers.set("X-Forwarded-Proto",upstreamUrl.protocol.slice(0,-1))
 // Protect the fallback Main service from recursive modern->modern calls
 // in any future deploy topology. The original backend ignores this header.
 headers.set("X-UpTillDawn-Main-Bridge","original-read-v1")
 // Explicit allowlist. No Authorization, client role, arbitrary host, external
 // redirect URL or provider credential can turn this into a general proxy.
 for(const key of ["cookie","user-agent","accept-language","cf-connecting-ip","cf-ipcity","cf-region","cf-ipcountry","cf-iplatitude","cf-iplongitude"]){
  const value=request.headers.get(key)
  if(value)headers.set(key,value)
 }
 if(!callback){headers.set("Origin",scope.appOrigin);headers.set("Sec-Fetch-Site","same-origin")}
 let response:Response
 try{
  const originalRequest=new Request(upstreamUrl,{method:request.method,headers,body:form,redirect:"manual",signal:AbortSignal.timeout(20_000)})
  if(direct){
   if(!env.SUPABASE_ANON_KEY?.startsWith("sb_publishable_"))
    return rejected(503,"auth_service_unconfigured")
   // Same audited original login, verification, account and callback code
   // compiled without Next. Only names in the original trusted private
   // environment allowlist can be forwarded into the per-request scope.
   const privateValues:Record<string,string>={}
   for(const name of MAIN_AUTH_PRIVATE_ENV_KEYS){
    const value=env[name]
    if(typeof value==="string")privateValues[name]=value
   }
   const configuration={protocol:"main-auth-native-v1",projectUrl:scope.projectUrl,values:privateValues}
   response=await nativeOriginalAuth(originalRequest,{
    runtimeConfiguration:async()=>configuration
   },env.SUPABASE_ANON_KEY,{appOrigin:scope.appOrigin,projectUrl:scope.projectUrl})
  }else if(env.MAIN_AUTH_RUNTIME){
   if(!env.SUPABASE_ANON_KEY?.startsWith('sb_publishable_'))return rejected(503,'auth_service_unconfigured')
   response=await nativeOriginalAuth(originalRequest,env.MAIN_AUTH_RUNTIME,env.SUPABASE_ANON_KEY)
  }else if(env.MAIN_AUTH)response=await env.MAIN_AUTH.fetch(originalRequest)
  else return rejected(503,'auth_service_unconfigured')
 }catch{return rejected(503,"auth_temporarily_unavailable")}
 const output=new Headers({"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"})
 const runtime=response.headers.get('x-uptilldawn-auth-runtime');if(runtime)output.set('X-UpTillDawn-Auth-Runtime',runtime)
 const location=response.headers.get("location")
 if(location){
  const target=new URL(location,scope.appOrigin)
  if((!callback&&!adminLogin)||target.origin!==scope.appOrigin)return rejected(502,"invalid_auth_redirect")
  // Callback exchanges the same QA auth code/OTP, then returns to this host.
  output.set("Location",url.origin+target.pathname+target.search+target.hash)
 }else if(!(response.headers.get("content-type")||"").includes("application/json"))return rejected(503,"auth_temporarily_unavailable")
 else output.set("Content-Type","application/json; charset=utf-8")
 let cookies:string[]
 try{cookies=authResponseCookies(response.headers)}catch{return rejected(503,"auth_cookie_transport_unavailable")}
 for(const cookie of cookies){
  // Supabase uses host-only cookies. A foreign Domain must never be relayed.
  if(/;\s*domain=/i.test(cookie))return rejected(502,"invalid_auth_cookie")
  output.append("Set-Cookie",cookie)
 }
 return new Response(response.body,{status:response.status,headers:output})
}

 // The actual Hono Worker never supplies the historical HTTP binding.
 // Explicitly copy only the permitted native configuration fields.
export function nativeMainAuthResponse(request:Request,env:Omit<MainAuthBindings,"MAIN_AUTH">):Promise<Response>{
 return forwardMainAuth(request,{
  SUPABASE_URL:env.SUPABASE_URL,SUPABASE_ANON_KEY:env.SUPABASE_ANON_KEY,
  UPT_MIGRATION_NATIVE_AUTH_ENABLED:env.UPT_MIGRATION_NATIVE_AUTH_ENABLED,
  UPT_MIGRATION_RUNTIME_TARGET:env.UPT_MIGRATION_RUNTIME_TARGET,
  MAIN_AUTH_RUNTIME:env.MAIN_AUTH_RUNTIME,
  RESEND_API_KEY:env.RESEND_API_KEY,SECURITY_ALERT_EMAIL:env.SECURITY_ALERT_EMAIL,
  SECURITY_FROM_EMAIL:env.SECURITY_FROM_EMAIL,GEOAPIFY_API_KEY:env.GEOAPIFY_API_KEY,
  UPT_MIGRATION_EMAIL_CALLBACK_READY:env.UPT_MIGRATION_EMAIL_CALLBACK_READY
 })
}
