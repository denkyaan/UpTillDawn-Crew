// Source-compatible original Administration OAuth GET routes for SumUp, Billit
// (Peppol) and Weeztix. Never rely on browser provider claims or on a legacy
// Next.js service binding. The Worker guards every route before calling this
// module; this module additionally verifies the SQL business privilege.
import type {SupabaseClient} from "@supabase/supabase-js"
import {parseIntegrationConfiguration} from "../../../lib/administration/integration-credentials.ts"
import {WEEZTIX_AUTH_BASE,requestWeeztixOAuthTokens}
 from "../../../lib/administration/weeztix-oauth.ts"
import {validMasterKey,sealOAuthToken,openOAuthToken,
 tokenConfiguration,parseToken,type OAuthBindings,type OAuthProvider} from "./provider-oauth.ts"

type Env=OAuthBindings&{
 UPT_WEEZTIX_OAUTH_ORIGIN?:string
 UPT_WEEZTIX_OAUTH_CLIENT_ID?:string
 UPT_WEEZTIX_OAUTH_CLIENT_SECRET?:string
}
type Db=Pick<SupabaseClient,"rpc"|"from">
const noStore={"Cache-Control":"no-store","Referrer-Policy":"no-referrer",
 "X-Content-Type-Options":"nosniff"} as const
const json=(error:string,status:number)=>Response.json({error},{status,headers:noStore})
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}-[0-9a-f]{12}$/i
function same(a:string,b:string){
 if(a.length!==b.length||a.length!==64)return false
 let diff=0
 for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i)
 return diff===0
}
function state(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),
 byte=>byte.toString(16).padStart(2,"0")).join("")}
function cookie(request:Request,name:string){
 const found=(request.headers.get("cookie")||"").split(";").map(v=>v.trim())
  .filter(v=>v.startsWith(name+"="))
 return found.length===1?found[0].slice(name.length+1):""
}
function callback(request:Request,env:Env,kind:"weeztix"|OAuthProvider){
 const configured=kind==="weeztix"?env.UPT_WEEZTIX_OAUTH_ORIGIN:env.UPT_PROVIDER_OAUTH_ORIGIN
 if(!configured)return null
 try{
  const original=new URL(request.url),target=new URL(configured)
  if(target.protocol!=="https:"||target.origin!==configured||
    original.origin!==target.origin||target.username||target.password||
    target.pathname!=="/"||target.search||target.hash)return null
  const path=kind==="weeztix"?"/api/administration/integrations/weeztix/callback":
   "/api/administration/integrations/oauth/"+kind+"/callback"
  return target.origin+path
 }catch{return null}
}
async function privileged(db:Db){
 try{
  const {data,error}=await db.rpc("upt_can_manage_integrations")
  return error?503:data===true?200:403
 }catch{return 503}
}
async function vaultRead(db:Db,env:Env){
 if(!validMasterKey(env.UPT_INTEGRATION_ENCRYPTION_KEY))throw Error("master")
 const {data,error}=await db.rpc("upt_integration_credentials",{
  p_action:"read",p_provider:"weeztix",p_ciphertext:null
 })
 if(error||!data||typeof data!=="object"||Array.isArray(data))throw Error("vault")
 if(data.configured===false)return null
 if(data.configured!==true||typeof data.ciphertext!=="string")throw Error("vault")
 const decoded=await openOAuthToken("weeztix",data.ciphertext,env.UPT_INTEGRATION_ENCRYPTION_KEY!)
 const checked=parseIntegrationConfiguration("weeztix",decoded)
 if(!checked)throw Error("vault")
 return checked
}
async function save(db:Db,env:Env,provider:"weeztix"|OAuthProvider,fields:Record<string,string>){
 if(!validMasterKey(env.UPT_INTEGRATION_ENCRYPTION_KEY)||
  !parseIntegrationConfiguration(provider,fields))return false
 const encrypted=await sealOAuthToken(provider,fields,env.UPT_INTEGRATION_ENCRYPTION_KEY!)
 try{
  const {data,error}=await db.rpc("upt_integration_credentials",{
   p_action:"save",p_provider:provider,p_ciphertext:encrypted
  })
  return !error&&Boolean(data)&&typeof data==="object"&&data.configured===true
 }catch{return false}
}
function redirect(target:string,scope:string,name:string,value:string,clear=false){
 const headers=new Headers(noStore)
 headers.set("Location",target)
 headers.append("Set-Cookie",name+"="+value+"; Path="+scope+
  "; HttpOnly; Secure; SameSite=Lax; Max-Age="+(clear?"0":"600"))
 return new Response(null,{status:303,headers})
}
function finish(request:Request,kind:"weeztix"|OAuthProvider,outcome:string){
 const path=kind==="weeztix"?"/portals/administration/modules/ticketing":
  kind==="sumup"?"/portals/administration/modules/banking":
   "/portals/administration/modules/invoices"
 const dest=new URL(path,request.url)
 dest.searchParams.set((kind==="weeztix"?"weeztix":kind)+"_oauth",outcome)
 const scope=kind==="weeztix"?"/api/administration/integrations/weeztix":
  "/api/administration/integrations/oauth/"+kind
 const name=kind==="weeztix"?"upt_weeztix_oauth_state":
  "upt_provider_oauth_"+kind+"_state"
 return redirect(dest.toString(),scope,name,"",true)
}
function providerReady(env:Env,kind:OAuthProvider){
 const id=kind==="sumup"?env.UPT_SUMUP_OAUTH_CLIENT_ID:env.UPT_BILLIT_OAUTH_CLIENT_ID
 const secret=kind==="sumup"?env.UPT_SUMUP_OAUTH_CLIENT_SECRET:env.UPT_BILLIT_OAUTH_CLIENT_SECRET
 return typeof id==="string"&&id.trim().length>=3&&id.length<=256&&
  typeof secret==="string"&&secret.trim().length>=10&&secret.length<=2048&&
  (kind!=="peppol"||!env.UPT_BILLIT_OAUTH_ENV||
   ["sandbox","production"].includes(env.UPT_BILLIT_OAUTH_ENV))
}
function providerConsent(env:Env,kind:OAuthProvider,uri:string,s:string){
 const endpoint=kind==="sumup"?"https://api.sumup.com/authorize":
  env.UPT_BILLIT_OAUTH_ENV==="production"?"https://my.billit.be/Account/Logon":
   "https://my.sandbox.billit.be/Account/Logon"
 const target=new URL(endpoint)
 target.searchParams.set("client_id",kind==="sumup"?env.UPT_SUMUP_OAUTH_CLIENT_ID!:
  env.UPT_BILLIT_OAUTH_CLIENT_ID!)
 target.searchParams.set("redirect_uri",uri)
 target.searchParams.set("state",s)
 if(kind==="sumup"){
  target.searchParams.set("response_type","code")
  target.searchParams.set("scope","transactions.history user.profile_readonly")
 }
 return target.toString()
}
async function tokenResponse(result:Response){
 if(!result.ok||!result.body)return null
 const claimed=result.headers.get("content-length")
 if(claimed!==null&&(!/^[0-9]+$/.test(claimed)||Number(claimed)>16000))return null
 const reader=result.body.getReader()
 let size=0;const parts:Uint8Array[]=[]
 try{
  for(;;){
   const {done,value}=await reader.read()
   if(done)break
   size+=value.byteLength
   if(size>16000){await reader.cancel().catch(()=>{});return null}
   parts.push(value)
  }
 }catch{return null}
 finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let at=0
 for(const part of parts){bytes.set(part,at);at+=part.length}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)) as unknown}
 catch{return null}
}
async function exchange(env:Env,kind:OAuthProvider,code:string,uri:string){
 if(code.length<6||code.length>2048||/[\u0000-\u001f\u007f]/.test(code))return null
 const endpoint=kind==="sumup"?"https://api.sumup.com/token":
  env.UPT_BILLIT_OAUTH_ENV==="production"?"https://api.billit.be/OAuth2/token":
   "https://api.sandbox.billit.be/OAuth2/token"
 const body={grant_type:"authorization_code",code,redirect_uri:uri,
  client_id:kind==="sumup"?env.UPT_SUMUP_OAUTH_CLIENT_ID!:env.UPT_BILLIT_OAUTH_CLIENT_ID!,
  client_secret:kind==="sumup"?env.UPT_SUMUP_OAUTH_CLIENT_SECRET!:env.UPT_BILLIT_OAUTH_CLIENT_SECRET!}
 try{
  const result=await fetch(endpoint,{method:"POST",cache:"no-store",redirect:"error",
   signal:AbortSignal.timeout(8000),headers:{"Accept":"application/json",
    "Content-Type":kind==="sumup"?"application/x-www-form-urlencoded":"application/json"},
   body:kind==="sumup"?new URLSearchParams(body).toString():JSON.stringify(body)})
  return parseToken(await tokenResponse(result))
 }catch{return null}
}

export async function nativeOriginalProviderOAuth(
 db:Db,userId:string,request:Request,env:Env,
 provider:string,phase:"start"|"callback"
):Promise<Response>{
 if(provider!=="sumup"&&provider!=="peppol")return json("unsupported_provider",404)
 const allowed=await privileged(db)
 if(allowed!==200)return json("forbidden",allowed)
 if(!validMasterKey(env.UPT_INTEGRATION_ENCRYPTION_KEY))
  return json("integration_storage_not_configured",503)
 const uri=callback(request,env,provider)
 if(!uri)return phase==="start"?json("provider_callback_not_configured",503):
  finish(request,provider,"failed")
 if(phase==="start"){
  if(!providerReady(env,provider))return json("provider_app_registration_required",409)
  const s=state()
  return redirect(providerConsent(env,provider,uri,s),
   "/api/administration/integrations/oauth/"+provider,
   "upt_provider_oauth_"+provider+"_state",s+":"+userId)
 }
 const saved=cookie(request,"upt_provider_oauth_"+provider+"_state")
 const split=saved.indexOf(":")
 const stateParam=new URL(request.url).searchParams.get("state")||""
 if(split!==64||saved.slice(split+1)!==userId||!same(saved.slice(0,split),stateParam))
  return finish(request,provider,"expired")
 const query=new URL(request.url).searchParams
 if(query.has("error"))return finish(request,provider,"denied")
 if(!providerReady(env,provider))return finish(request,provider,"failed")
 const tokens=await exchange(env,provider,query.get("code")||"",uri)
 if(!tokens)return finish(request,provider,"failed")
 return finish(request,provider,await save(db,env,provider,
  tokenConfiguration(provider,tokens,env))?"authorized":"failed")
}

export async function nativeOriginalWeeztixOAuth(
 db:Db,userId:string,request:Request,env:Env,phase:"start"|"callback"
):Promise<Response>{
 const allowed=await privileged(db)
 if(allowed!==200)return json("forbidden",allowed)
 if(!validMasterKey(env.UPT_INTEGRATION_ENCRYPTION_KEY))
  return json("connection_unavailable",503)
 const uri=callback(request,env,"weeztix")
 if(!uri)return phase==="start"?json("oauth_not_configured",503):
  finish(request,"weeztix","failed")
 if(phase==="start"){
  let config:Awaited<ReturnType<typeof vaultRead>>
  try{config=await vaultRead(db,env)}catch{return json("connection_unavailable",503)}
  const clientId=env.UPT_WEEZTIX_OAUTH_CLIENT_ID||
    config?.WEEZTIX_CLIENT_ID
  const clientSecret=env.UPT_WEEZTIX_OAUTH_CLIENT_SECRET||
    config?.WEEZTIX_CLIENT_SECRET
  if(!clientId||clientId.length<3||!clientSecret)
   return json("oauth_app_registration_required",409)
  const eventId=new URL(request.url).searchParams.get("eventId")||""
  if(!uuid.test(eventId))return json("select_event_first",422)
  const {data:event,error}=await db.from("events").select("id").eq("id",eventId).maybeSingle()
  if(error)return json("events_unavailable",503)
  if(!event)return json("unknown_event",404)
  const s=state(),target=new URL(WEEZTIX_AUTH_BASE)
  target.searchParams.set("client_id",clientId)
  target.searchParams.set("redirect_uri",uri)
  target.searchParams.set("response_type","code")
  target.searchParams.set("state",s)
  return redirect(target.toString(),"/api/administration/integrations/weeztix",
   "upt_weeztix_oauth_state",s+":"+userId+":"+eventId)
 }
 const saved=cookie(request,"upt_weeztix_oauth_state")
 const first=saved.indexOf(":"),second=saved.indexOf(":",first+1)
 const user=first>=0&&second>first?saved.slice(first+1,second):""
 const eventId=second>0?saved.slice(second+1):""
 const query=new URL(request.url).searchParams
 if(first!==64||user!==userId||!uuid.test(eventId)||
  !same(saved.slice(0,first),query.get("state")||""))
  return finish(request,"weeztix","expired")
 if(query.has("error"))return finish(request,"weeztix","denied")
 const code=query.get("code")||""
 if(code.length<6||code.length>2048||/[\u0000-\u001f\u007f]/.test(code))
  return finish(request,"weeztix","failed")
 let config:Awaited<ReturnType<typeof vaultRead>>
 try{config=await vaultRead(db,env)}catch{return finish(request,"weeztix","failed")}
 const clientId=env.UPT_WEEZTIX_OAUTH_CLIENT_ID||config?.WEEZTIX_CLIENT_ID
 const clientSecret=env.UPT_WEEZTIX_OAUTH_CLIENT_SECRET||config?.WEEZTIX_CLIENT_SECRET
 if(!clientId||!clientSecret)return finish(request,"weeztix","failed")
 const {data:event,error}=await db.from("events").select("id").eq("id",eventId).maybeSingle()
 if(error||!event)return finish(request,"weeztix","failed")
 const tokens=await requestWeeztixOAuthTokens({
  grant_type:"authorization_code",client_id:clientId,client_secret:clientSecret,
  redirect_uri:uri,code
 })
 if(!tokens)return finish(request,"weeztix","failed")
 const next={WEEZTIX_CLIENT_ID:clientId,WEEZTIX_CLIENT_SECRET:clientSecret,
  WEEZTIX_ACTIVE_EVENT_ID:eventId,WEEZTIX_SCANNING_ENABLED:"true",...tokens}
 return finish(request,"weeztix",await save(db,env,"weeztix",next)?"connected":"failed")
}
