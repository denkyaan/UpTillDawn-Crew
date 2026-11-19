// Server-only implementation; no import from browser code. All credentials
// belong to the UpTillDawn operator, not to an end user's provider account.
// Provider-specific authorize/token hosts match the existing Next implementation
// and official SumUp / Billit OAuth documentation (checked 2026-11-19).
export type OAuthProvider="sumup"|"peppol"
export type OAuthBindings={
 UPT_MIGRATION_OAUTH_ENABLED?:string
 UPT_PROVIDER_OAUTH_ORIGIN?:string
 UPT_INTEGRATION_ENCRYPTION_KEY?:string
 UPT_SUMUP_OAUTH_CLIENT_ID?:string
 UPT_SUMUP_OAUTH_CLIENT_SECRET?:string
 UPT_BILLIT_OAUTH_CLIENT_ID?:string
 UPT_BILLIT_OAUTH_CLIENT_SECRET?:string
 UPT_BILLIT_OAUTH_ENV?:string
}
const encoder=new TextEncoder()
const decoder=new TextDecoder("utf-8",{fatal:true})
const providers={
 sumup:{client:"UPT_SUMUP_OAUTH_CLIENT_ID",secret:"UPT_SUMUP_OAUTH_CLIENT_SECRET"},
 peppol:{client:"UPT_BILLIT_OAUTH_CLIENT_ID",secret:"UPT_BILLIT_OAUTH_CLIENT_SECRET"}
} as const
export function isOAuthProvider(value:unknown):value is OAuthProvider{
 return value==="sumup"||value==="peppol"
}
function base64ToBytes(input:string):Uint8Array{
 if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input)||!input)
  throw Error("invalid_key")
 return Uint8Array.from(atob(input),char=>char.charCodeAt(0))
}
function bytesToBase64(value:Uint8Array):string{
 let binary=""
 for(const byte of value)binary+=String.fromCharCode(byte)
 return btoa(binary)
}
function hex(value:Uint8Array):string{
 return [...value].map(x=>x.toString(16).padStart(2,"0")).join("")
}
function decodeHex(value:string):Uint8Array{
 if(!/^(?:[0-9a-f]{2})+$/.test(value))throw Error("invalid_hex")
 return Uint8Array.from(value.match(/.{2}/g)!,x=>parseInt(x,16))
}
function masterBytes(value:unknown):Uint8Array{
 if(typeof value!=="string")throw Error("master_key_not_configured")
 const decoded=base64ToBytes(value)
 if(decoded.length!==32)throw Error("master_key_not_configured")
 return decoded
}
export function validMasterKey(value:unknown):boolean{
 try{return masterBytes(value).length===32}catch{return false}
}
export function oauthOrigin(env:OAuthBindings,requestUrl:string):string|null{
 const specified=env.UPT_PROVIDER_OAUTH_ORIGIN
 if(!specified)return null
 try{
  const target=new URL(specified)
  const current=new URL(requestUrl)
  if(target.protocol!=="https:"||target.href!==target.origin+"/"||
    target.username||target.password||target.search||target.hash||
    current.origin!==target.origin)return null
  return target.origin
 }catch{return null}
}
export function oauthReady(env:OAuthBindings,provider:OAuthProvider,requestUrl:string):boolean{
 if(env.UPT_MIGRATION_OAUTH_ENABLED!=="true"||!validMasterKey(env.UPT_INTEGRATION_ENCRYPTION_KEY)||
  !oauthOrigin(env,requestUrl))return false
 if(provider==="peppol"&&!["sandbox","production"].includes(env.UPT_BILLIT_OAUTH_ENV||"sandbox"))return false
 const config=providers[provider]
 const id=env[config.client],secret=env[config.secret]
 return typeof id==="string"&&id.trim().length>=3&&id.length<=256&&
  typeof secret==="string"&&secret.trim().length>=10&&secret.length<=2048
}
export function oauthCallback(origin:string,provider:OAuthProvider):string{
 return origin+"/integrations/oauth/callback/"+provider
}
export function authorizationUrl(env:OAuthBindings,provider:OAuthProvider,origin:string,state:string):string{
 if(!/^[0-9a-f]{64}$/.test(state))throw Error("invalid_state")
 const endpoint=provider==="sumup"?"https://api.sumup.com/authorize":
   env.UPT_BILLIT_OAUTH_ENV==="production"?"https://my.billit.be/Account/Logon":
   "https://my.sandbox.billit.be/Account/Logon"
 const url=new URL(endpoint)
 url.searchParams.set("client_id",env[providers[provider].client]||"")
 url.searchParams.set("redirect_uri",oauthCallback(origin,provider))
 url.searchParams.set("state",state)
 if(provider==="sumup"){
  url.searchParams.set("response_type","code")
  // These scopes cannot create payments; payment processing requires
  // independently approved SumUp authorization and tests.
  url.searchParams.set("scope","transactions.history user.profile_readonly")
 }
 return url.toString()
}
async function hmacKey(master:string):Promise<CryptoKey>{
 const root=await crypto.subtle.importKey("raw",masterBytes(master).buffer as ArrayBuffer,
  "HKDF",false,["deriveKey"])
 return crypto.subtle.deriveKey({name:"HKDF",hash:"SHA-256",
  salt:encoder.encode("uptilldawn-oauth-state-v1"),
  info:encoder.encode("http-only-browser-state")},root,
  {name:"HMAC",hash:"SHA-256",length:256},false,["sign","verify"])
}
export function oauthCookieName(provider:OAuthProvider):string{return "__Host-uptilldawn_"+provider+"_oauth"}
export function clearOAuthCookie(provider:OAuthProvider):string{
 return oauthCookieName(provider)+"=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
}
export async function startOAuthState(provider:OAuthProvider,uid:string,secret:string,now=Date.now()):Promise<{state:string;cookie:string}>{
 if(!/^[0-9a-f-]{36}$/i.test(uid))throw Error("invalid_actor")
 const state=hex(crypto.getRandomValues(new Uint8Array(32)))
 const expire=Math.floor(now/1000)+600
 const message=[state,uid,provider,expire].join(".")
 const signature=hex(new Uint8Array(await crypto.subtle.sign("HMAC",await hmacKey(secret),encoder.encode(message))))
 return {state,cookie:oauthCookieName(provider)+"="+message+"."+signature+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600"}
}
export async function verifyOAuthState(provider:OAuthProvider,uid:string,secret:string,
 cookieHeader:string,state:string,now=Date.now()):Promise<boolean>{
 if(!/^[0-9a-f]{64}$/.test(state)||!cookieHeader||cookieHeader.length>8192)return false
 const prefix=oauthCookieName(provider)+"="
 const matches=cookieHeader.split(";").map(x=>x.trim()).filter(x=>x.startsWith(prefix))
 if(matches.length!==1)return false
 const cookie=matches[0].slice(prefix.length)
 const match=/^([0-9a-f]{64})\.([0-9a-f-]{36})\.(sumup|peppol)\.([0-9]{10})\.([0-9a-f]{64})$/.exec(cookie)
 if(!match||match[2]!==uid||match[3]!==provider||
  Number(match[4])*1000<=now||Number(match[4])*1000>now+600000)return false
 let diff=0
 for(let i=0;i<state.length;i++)diff|=state.charCodeAt(i)^match[1].charCodeAt(i)
 if(diff!==0)return false
 const message=match.slice(1,5).join(".")
 try{return await crypto.subtle.verify("HMAC",await hmacKey(secret),
   decodeHex(match[5]).buffer as ArrayBuffer,encoder.encode(message))}
 catch{return false}
}
export async function sealOAuthToken(provider:OAuthProvider,config:Record<string,string>,secret:string):Promise<string>{
 const key=await crypto.subtle.importKey("raw",masterBytes(secret).buffer as ArrayBuffer,"AES-GCM",false,["encrypt"])
 const iv=crypto.getRandomValues(new Uint8Array(12))
 const data=encoder.encode(JSON.stringify(config))
 const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv,
  additionalData:encoder.encode("uptilldawn:"+provider+":v1")},key,data)
 return "v1:"+bytesToBase64(iv)+":"+bytesToBase64(new Uint8Array(encrypted))
}
export async function openOAuthToken(provider:OAuthProvider,ciphertext:string,secret:string):Promise<Record<string,string>>{
 const match=/^v1:([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+)$/.exec(ciphertext)
 if(!match)throw Error("invalid_ciphertext")
 const iv=base64ToBytes(match[1]),data=base64ToBytes(match[2])
 if(iv.length!==12||data.length<16||data.length>16384)throw Error("invalid_ciphertext")
 const key=await crypto.subtle.importKey("raw",masterBytes(secret).buffer as ArrayBuffer,"AES-GCM",false,["decrypt"])
 const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv,
  additionalData:encoder.encode("uptilldawn:"+provider+":v1")},key,data)
 const decoded:unknown=JSON.parse(decoder.decode(plain))
 if(!decoded||typeof decoded!=="object"||Array.isArray(decoded))throw Error("invalid_ciphertext")
 const record:Record<string,string>={}
 for(const [key,value] of Object.entries(decoded)){
  if(typeof value!=="string")throw Error("invalid_ciphertext")
  record[key]=value
 }
 return record
}
export type OAuthToken={access:string;refresh:string;expires:string}
export function parseToken(value:unknown,now=Date.now()):OAuthToken|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null
 const v=value as Record<string,unknown>
 if(v.token_type!==undefined&&String(v.token_type).toLowerCase()!=="bearer")return null
 if(typeof v.access_token!=="string"||typeof v.refresh_token!=="string"||
  v.access_token.length<10||v.access_token.length>4096||
  v.refresh_token.length<10||v.refresh_token.length>4096||
  /[\u0000-\u001f\u007f]/.test(v.access_token+v.refresh_token)||
  typeof v.expires_in!=="number"||!Number.isSafeInteger(v.expires_in)||
  v.expires_in<60||v.expires_in>31536000)return null
 return {access:v.access_token,refresh:v.refresh_token,
  expires:String(Math.floor(now/1000)+v.expires_in-30)}
}
export function tokenConfiguration(provider:OAuthProvider,token:OAuthToken,env:OAuthBindings):Record<string,string>{
 return provider==="sumup"?
 {SUMUP_OAUTH_ACCESS_TOKEN:token.access,SUMUP_OAUTH_REFRESH_TOKEN:token.refresh,SUMUP_OAUTH_EXPIRES_AT:token.expires}:
 {BILLIT_OAUTH_ACCESS_TOKEN:token.access,BILLIT_OAUTH_REFRESH_TOKEN:token.refresh,
  BILLIT_OAUTH_EXPIRES_AT:token.expires,BILLIT_OAUTH_ENV:env.UPT_BILLIT_OAUTH_ENV==="production"?"production":"sandbox"}
}
async function responseJsonLimited(response:Response):Promise<unknown>{
 if(!response.ok||!response.body)return null
 const length=response.headers.get("content-length")
 if(length&&(!/^\d+$/.test(length)||Number(length)>16000))return null
 let bytes=0;const chunks:Uint8Array[]=[]
 const reader=response.body.getReader()
 try{
  while(true){
   const {done,value}=await reader.read()
   if(done)break
   bytes+=value.byteLength
   if(bytes>16000){await reader.cancel().catch(()=>{});return null}
   chunks.push(value)
  }
 }catch{return null}
 finally{reader.releaseLock()}
 const merged=new Uint8Array(bytes);let offset=0
 for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.byteLength}
 try{return JSON.parse(decoder.decode(merged)) as unknown}catch{return null}
}
export async function exchangeOAuthCode(env:OAuthBindings,provider:OAuthProvider,code:string,origin:string):Promise<OAuthToken|null>{
 if(typeof code!=="string"||code.length<6||code.length>2048||/[\u0000-\u001f\u007f]/.test(code))return null
 const endpoint=provider==="sumup"?"https://api.sumup.com/token":
  env.UPT_BILLIT_OAUTH_ENV==="production"?"https://api.billit.be/OAuth2/token":
  "https://api.sandbox.billit.be/OAuth2/token"
 const payload={grant_type:"authorization_code",code,redirect_uri:oauthCallback(origin,provider),
  client_id:env[providers[provider].client]||"",client_secret:env[providers[provider].secret]||""}
 try{
  const result=await fetch(endpoint,{method:"POST",redirect:"error",cache:"no-store",
   signal:AbortSignal.timeout(8000),
   headers:{"Accept":"application/json",
    "Content-Type":provider==="sumup"?"application/x-www-form-urlencoded":"application/json"},
   body:provider==="sumup"?new URLSearchParams(payload).toString():JSON.stringify(payload)})
  return parseToken(await responseJsonLimited(result))
 }catch{return null}
}
