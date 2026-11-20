import "server-only"
import type {IntegrationConfiguration} from "./integration-credentials"

/** Provider application credentials belong to UpTillDawn's operator, NEVER to its customer. */
export type UserOAuthProvider="sumup"|"peppol"
const mainHost="uptilldawn-main.uptilldawn.workers.dev"
const callbackPath=(provider:UserOAuthProvider)=>"/api/administration/integrations/oauth/"+provider+"/callback"
const config={
 sumup:{client:"UPT_SUMUP_OAUTH_CLIENT_ID",secret:"UPT_SUMUP_OAUTH_CLIENT_SECRET",
        authorize:"https://api.sumup.com/authorize",token:"https://api.sumup.com/token"},
 peppol:{client:"UPT_BILLIT_OAUTH_CLIENT_ID",secret:"UPT_BILLIT_OAUTH_CLIENT_SECRET",
         authorize:"https://my.sandbox.billit.be/Account/Logon",token:"https://api.sandbox.billit.be/OAuth2/token"},
} as const

export function userOAuthReady(provider:UserOAuthProvider,env:NodeJS.ProcessEnv=process.env):boolean{
 const entry=config[provider]
 return Boolean(env[entry.client]?.trim()&&env[entry.secret]?.trim()&&
  (provider!=="peppol"||env.UPT_BILLIT_OAUTH_ENV===undefined||
   ["sandbox","production"].includes(env.UPT_BILLIT_OAUTH_ENV)))
}
export function userOAuthCallbackUrl(request:Request,provider:UserOAuthProvider,env:NodeJS.ProcessEnv=process.env):string{
 const host=request.headers.get("host")?.toLowerCase()
 if(host===mainHost)return "https://"+mainHost+callbackPath(provider)
 // Never trust a browser-controlled host or forwarded-host as a redirect URI.
 const origin=env.UPT_PROVIDER_OAUTH_ORIGIN
 if(origin&&host){
  const u=new URL(origin)
  if(u.protocol==="https:"&&u.origin===origin&&u.host.toLowerCase()===host&&
     u.pathname==="/"&&!u.username&&!u.password&&!u.search&&!u.hash)
   return u.origin+callbackPath(provider)
 }
 if(env.NODE_ENV!=="production"&&host&&/^(localhost|127\.0\.0\.1):\d{2,5}$/.test(host))
  return "http://"+host+callbackPath(provider)
 throw Error("oauth_origin_not_configured")
}
export function userOAuthCookie(provider:UserOAuthProvider){return "upt_provider_oauth_"+provider+"_state"}
export function userOAuthConsentUrl(provider:UserOAuthProvider,redirect:string,state:string,env:NodeJS.ProcessEnv=process.env):string{
 if(!userOAuthReady(provider,env))throw Error("oauth_app_not_configured")
 const entry=config[provider]
 const isProd=provider==="peppol"&&env.UPT_BILLIT_OAUTH_ENV==="production"
 const url=new URL(isProd?"https://my.billit.be/Account/Logon":entry.authorize)
 url.searchParams.set("client_id",env[entry.client]!)
 url.searchParams.set("redirect_uri",redirect)
 url.searchParams.set("state",state)
 if(provider==="sumup"){
  url.searchParams.set("response_type","code")
  // Read-only first: payments require separate manual SumUp approval.
  url.searchParams.set("scope","transactions.history user.profile_readonly")
 }
 return url.toString()
}
export function verifyOAuthState(expected:string,actual:string):boolean{
 if(expected.length!==64||actual.length!==64)return false
 let diff=0
 for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^actual.charCodeAt(i)
 return diff===0
}
export function oauthRandomState(){
 return Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,"0")).join("")
}
export function oauthTokenResponse(payload:unknown,now=Date.now(),existingRefresh?:string):{access:string;refresh:string;expires:string}|null{
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return null
 const p=payload as Record<string,unknown>
 // SumUp may omit a new refresh token during rotation. Reuse the old one
 // only on a refresh grant, never when initially authorizing an account.
 const refresh=typeof p.refresh_token==="string"?p.refresh_token:existingRefresh
 if(p.token_type!==undefined&&String(p.token_type).toLowerCase()!=="bearer")return null
 if(typeof p.access_token!=="string"||p.access_token.length<10||p.access_token.length>4096||
    typeof refresh!=="string"||refresh.length<10||refresh.length>4096||
    /[\u0000-\u001f\u007f]/.test(p.access_token+refresh)||
    typeof p.expires_in!=="number"||!Number.isSafeInteger(p.expires_in)||
    p.expires_in<60||p.expires_in>31536000||Number.isNaN(now))return null
 return {access:p.access_token,refresh,expires:String(Math.floor(now/1000)+p.expires_in-30)}
}
async function smallResponse(response:Response):Promise<unknown>{
 if(!response.ok)return null
 const declared=response.headers.get("content-length")
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>16000))return null
 if(!response.body)return null
 const reader=response.body.getReader()
 let length=0;const parts:Uint8Array[]=[]
 try{
  while(true){
   const {done,value}=await reader.read()
   if(done)break
   length+=value.byteLength
   if(length>16000){await reader.cancel().catch(()=>{});return null}
   parts.push(value)
  }
 }catch{return null}
 finally{reader.releaseLock()}
 const bytes=new Uint8Array(length);let offset=0
 for(const part of parts){bytes.set(part,offset);offset+=part.byteLength}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)) as unknown}catch{return null}
}
async function callToken(provider:UserOAuthProvider,params:Record<string,string>,env:NodeJS.ProcessEnv):Promise<ReturnType<typeof oauthTokenResponse>>{
 if(!userOAuthReady(provider,env))return null
 const entry=config[provider],isProd=provider==="peppol"&&env.UPT_BILLIT_OAUTH_ENV==="production"
 const token=isProd?"https://api.billit.be/OAuth2/token":entry.token
 const body={...params,client_id:env[entry.client]!,client_secret:env[entry.secret]!}
 try{
  const response=await fetch(token,{
   method:"POST",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000),
   headers:{"Accept":"application/json","Content-Type":provider==="sumup"?"application/x-www-form-urlencoded":"application/json"},
   body:provider==="sumup"?new URLSearchParams(body).toString():JSON.stringify(body)
  })
  return oauthTokenResponse(await smallResponse(response),Date.now(),params.grant_type==="refresh_token"?params.refresh_token:undefined)
 }catch{return null}
}
export async function exchangeUserOAuthCode(provider:UserOAuthProvider,code:string,redirect:string,env:NodeJS.ProcessEnv=process.env){
 if(code.length<6||code.length>2048||/[\u0000-\u001f\u007f]/.test(code))return null
 return callToken(provider,{grant_type:"authorization_code",code,redirect_uri:redirect},env)
}
export async function refreshUserOAuthToken(provider:UserOAuthProvider,refresh:string,env:NodeJS.ProcessEnv=process.env){
 if(refresh.length<10||refresh.length>4096||/[\u0000-\u001f\u007f]/.test(refresh))return null
 return callToken(provider,{grant_type:"refresh_token",refresh_token:refresh},env)
}
export function oauthStoredConfiguration(provider:UserOAuthProvider,token:{access:string;refresh:string;expires:string},env:NodeJS.ProcessEnv=process.env):IntegrationConfiguration{
 return provider==="sumup"
  ?{SUMUP_OAUTH_ACCESS_TOKEN:token.access,SUMUP_OAUTH_REFRESH_TOKEN:token.refresh,SUMUP_OAUTH_EXPIRES_AT:token.expires}
  :{BILLIT_OAUTH_ACCESS_TOKEN:token.access,BILLIT_OAUTH_REFRESH_TOKEN:token.refresh,
    BILLIT_OAUTH_EXPIRES_AT:token.expires,BILLIT_OAUTH_ENV:env.UPT_BILLIT_OAUTH_ENV==="production"?"production":"sandbox"}
}
