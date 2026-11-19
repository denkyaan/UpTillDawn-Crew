import {readBoundedFormData} from "../../../lib/bounded-form-data.ts"

export const MAIN_AUTH_ORIGIN="https://uptilldawn-main.uptilldawn.workers.dev"
const CANDIDATE_ORIGIN="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const QA_DATABASE="https://npbjrtiolqperdgljnhi.supabase.co"
export type MainAuthBindings={SUPABASE_URL:string;MAIN_AUTH?:{fetch:(request:Request)=>Promise<Response>}}
const paths=new Set(["/api/auth/portal-login","/api/auth/account-action","/auth/callback"])
const portals=new Set(["staff","responsible","admin","promotion","administration"])
const actions=new Set(["signUp","forgotPassword","updatePassword","resendVerificationEmail","signOut"])
function rejected(status:number,code:string){
 return Response.json({error:"De aanmeldservice is tijdelijk niet bereikbaar. Probeer opnieuw.",code},{status,headers:{"Cache-Control":"private, no-store"}})
}

// Temporary migration boundary: only explicit authentication requests use the
// existing Main service. Static screens and navigation stay entirely on Vite.
// The service binding reuses the live audited action, its keys, IP context,
// mail alerts, cookie writes and denial rules; none is copied to the client.
export async function forwardMainAuth(request:Request,env:MainAuthBindings):Promise<Response>{
 const url=new URL(request.url)
 if(url.origin!==CANDIDATE_ORIGIN||env.SUPABASE_URL!==QA_DATABASE||!env.MAIN_AUTH)
  return rejected(503,"auth_service_unconfigured")
 if(!paths.has(url.pathname))return rejected(404,"auth_path_denied")
 const callback=url.pathname==="/auth/callback"
 if(request.method!==(callback?"GET":"POST"))return rejected(405,"method_not_allowed")
 let form:FormData|undefined
 if(!callback){
  const site=request.headers.get("sec-fetch-site")
  if(request.headers.get("origin")!==url.origin||(site&&site!=="same-origin"))return rejected(403,"invalid_origin")
  if(!(request.headers.get("content-type")||"").toLowerCase().startsWith("multipart/form-data;"))return rejected(415,"invalid_content_type")
  try{form=await readBoundedFormData(request,16_384)}
  catch(error){return rejected(error instanceof Error&&error.message==="too_large"?413:400,"invalid_form")}
  for(const [,value] of form)if(typeof value!=="string"||value.length>2048)return rejected(413,"form_too_large")
  if(url.pathname.endsWith("portal-login")&&!portals.has(String(form.get("portal")||"")))return rejected(403,"invalid_portal")
  if(url.pathname.endsWith("account-action")&&!actions.has(String(form.get("_action")||"")))return rejected(400,"invalid_action")
  if(url.pathname.endsWith("account-action"))form.set("_callback_origin",CANDIDATE_ORIGIN)
 }
 const upstreamUrl=new URL(url.pathname+(callback?url.search:""),MAIN_AUTH_ORIGIN)
 const headers=new Headers({Accept:callback?"text/html":"application/json"})
 // Explicit allowlist. No Authorization, client role, arbitrary host, external
 // redirect URL or provider credential can turn this into a general proxy.
 for(const key of ["cookie","user-agent","accept-language","cf-connecting-ip","cf-ipcity","cf-region","cf-ipcountry"]){
  const value=request.headers.get(key)
  if(value)headers.set(key,value)
 }
 if(!callback){headers.set("Origin",MAIN_AUTH_ORIGIN);headers.set("Sec-Fetch-Site","same-origin")}
 let response:Response
 try{
  response=await env.MAIN_AUTH.fetch(new Request(upstreamUrl,{method:request.method,headers,body:form,redirect:"manual",signal:AbortSignal.timeout(20_000)}))
 }catch{return rejected(503,"auth_temporarily_unavailable")}
 const output=new Headers({"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"})
 const location=response.headers.get("location")
 if(location){
  const target=new URL(location,MAIN_AUTH_ORIGIN)
  if(!callback||target.origin!==MAIN_AUTH_ORIGIN)return rejected(502,"invalid_auth_redirect")
  // Callback exchanges the same QA auth code/OTP, then returns to this host.
  output.set("Location",url.origin+target.pathname+target.search+target.hash)
 }else if(!(response.headers.get("content-type")||"").includes("application/json"))return rejected(503,"auth_temporarily_unavailable")
 else output.set("Content-Type","application/json; charset=utf-8")
 for(const cookie of response.headers.getSetCookie()){
  // Supabase uses host-only cookies. A foreign Domain must never be relayed.
  if(/;\s*domain=/i.test(cookie))return rejected(502,"invalid_auth_cookie")
  output.append("Set-Cookie",cookie)
 }
 return new Response(response.body,{status:response.status,headers:output})
}
