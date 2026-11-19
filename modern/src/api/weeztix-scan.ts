import {openOAuthToken,sealOAuthToken,validMasterKey} from "./provider-oauth.ts"
import {validWeeztixBarcode,type ScanResult} from "../shared/weeztix-scan.ts"

export type ScannerBindings={
 UPT_MIGRATION_SCANNING_ENABLED?:string
 UPT_SCANNER_ORIGIN?:string
 UPT_INTEGRATION_ENCRYPTION_KEY?:string
}
export type RpcDb={
 rpc:(name:string,args:Record<string,unknown>)=>Promise<{data:unknown;error:unknown}>
}
export type ScanRequest={eventId:string;workplaceId:string;barcode:string}
type Configuration=Record<string,string>
type Scoped={ciphertext:string;config:Configuration}
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}-[0-9a-f]{12}$/i
const tokenEndpoint="https://auth.weeztix.com/tokens"
const scanEndpoint="https://api.weeztix.com/order/scanbarcode/"
// Strictly on and bound to the deployed HTTPS Worker origin. No dynamic
// forwarded hostname or unauthenticated local/test mode.
export function scannerOrigin(env:ScannerBindings,url:string):string|null{
 try{
  if(!env.UPT_SCANNER_ORIGIN)return null
  const expected=new URL(env.UPT_SCANNER_ORIGIN),actual=new URL(url)
  if(expected.protocol!=="https:"||expected.href!==expected.origin+"/"||
   expected.username||expected.password||expected.search||expected.hash||
   expected.origin!==actual.origin)return null
  return expected.origin
 }catch{return null}
}
export function scannerReady(env:ScannerBindings,url:string):boolean{
 return env.UPT_MIGRATION_SCANNING_ENABLED==="true"&&
  validMasterKey(env.UPT_INTEGRATION_ENCRYPTION_KEY)&&
  scannerOrigin(env,url)!==null
}
export function validScanRequest(value:unknown):value is ScanRequest{
 if(!value||typeof value!=="object"||Array.isArray(value))return false
 const x=value as Record<string,unknown>
 return Object.keys(x).length===3&&
  typeof x.eventId==="string"&&uuid.test(x.eventId)&&
  typeof x.workplaceId==="string"&&uuid.test(x.workplaceId)&&
  validWeeztixBarcode(x.barcode)
}
export function tokenResponse(value:unknown,now=Date.now()):Record<string,string>|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null
 const v=value as Record<string,unknown>
 if(v.token_type!=="Bearer"||typeof v.access_token!=="string"||
  typeof v.refresh_token!=="string"||
  v.access_token.length<10||v.access_token.length>4096||
  v.refresh_token.length<10||v.refresh_token.length>4096||
  /[\u0000-\u001f\u007f]/.test(v.access_token+v.refresh_token)||
  typeof v.expires_in!=="number"||!Number.isSafeInteger(v.expires_in)||
  v.expires_in<60||v.expires_in>31536000)return null
 return {WEEZTIX_ACCESS_TOKEN:v.access_token,WEEZTIX_REFRESH_TOKEN:v.refresh_token,
  WEEZTIX_TOKEN_EXPIRES_AT:String(Math.floor(now/1000)+v.expires_in-30)}
}
export function validScopedConfiguration(c:Configuration,eventId:string):boolean{
 if(c.WEEZTIX_ACTIVE_EVENT_ID!==eventId||c.WEEZTIX_SCANNING_ENABLED!=="true")return false
 return typeof c.WEEZTIX_ACCESS_TOKEN==="string"&&
  c.WEEZTIX_ACCESS_TOKEN.length>=10&&c.WEEZTIX_ACCESS_TOKEN.length<=4096&&
  !/[\u0000-\u001f\u007f]/.test(c.WEEZTIX_ACCESS_TOKEN)
}
function result(code:ScanResult["code"],status:number):{status:number;body:ScanResult}{
 return {status,body:{ok:code==="admitted",code}}
}
async function readScoped(db:RpcDb,eventId:string,workplaceId:string,key:string):
 Promise<{value:Scoped|null;status:403|503|null}>{
 const {data,error}=await db.rpc("upt_weeztix_scan_secrets",{
  p_event_id:eventId,p_workplace_id:workplaceId
 })
 if(error)return {value:null,status:403}
 if(!data||typeof data!=="object"||Array.isArray(data))return {value:null,status:503}
 const row=data as Record<string,unknown>
 if(row.configured===false)return {value:null,status:null}
 if(row.configured!==true||typeof row.ciphertext!=="string")return {value:null,status:503}
 try{
  const config=await openOAuthToken("weeztix",row.ciphertext,key)
  return {value:{ciphertext:row.ciphertext,config},status:null}
 }catch{return {value:null,status:503}}
}
async function readLimited(response:Response,max=16000):Promise<unknown>{
 if(!response.ok||!response.body)return null
 const size=response.headers.get("content-length")
 if(size&&(!/^\d+$/.test(size)||Number(size)>max))return null
 const reader=response.body.getReader(),chunks:Uint8Array[]=[]
 let length=0
 try{
  while(true){
   const part=await reader.read()
   if(part.done)break
   length+=part.value.byteLength
   if(length>max){await reader.cancel().catch(()=>{});return null}
   chunks.push(part.value)
  }
 }catch{return null}
 finally{reader.releaseLock()}
 const payload=new Uint8Array(length)
 let index=0
 for(const chunk of chunks){payload.set(chunk,index);index+=chunk.byteLength}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(payload)) as unknown}catch{return null}
}
async function fetchTokens(config:Configuration):Promise<Record<string,string>|null>{
 const body={
  grant_type:"refresh_token",refresh_token:config.WEEZTIX_REFRESH_TOKEN,
  client_id:config.WEEZTIX_CLIENT_ID,client_secret:config.WEEZTIX_CLIENT_SECRET
 }
 try{
  const response=await fetch(tokenEndpoint,{
   method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},
   body:JSON.stringify(body),cache:"no-store",redirect:"error",
   signal:AbortSignal.timeout(7000)
  })
  return tokenResponse(await readLimited(response))
 }catch{return null}
}
const usable=(token:unknown):token is string=>
 typeof token==="string"&&token.length>=10&&token.length<=4096&&
 !/[\u0000-\u001f\u007f]/.test(token)
async function resolveToken(db:RpcDb,scope:Scoped,eventId:string,workplaceId:string,key:string):
 Promise<{token:string|null;code:ScanResult["code"]}>{
 const c=scope.config,expires=Number(c.WEEZTIX_TOKEN_EXPIRES_AT)
 const hasExpiry=/^[0-9]{10,13}$/.test(c.WEEZTIX_TOKEN_EXPIRES_AT||"")&&
  Number.isSafeInteger(expires)&&expires>0
 const now=Math.floor(Date.now()/1000)
 const current=usable(c.WEEZTIX_ACCESS_TOKEN)?c.WEEZTIX_ACCESS_TOKEN:null
 const canRefresh=hasExpiry&&usable(c.WEEZTIX_REFRESH_TOKEN)&&
  usable(c.WEEZTIX_CLIENT_SECRET)&&
  typeof c.WEEZTIX_CLIENT_ID==="string"&&c.WEEZTIX_CLIENT_ID.length>=3
 if(!hasExpiry)return {token:current,code:current?"admitted":"provider_auth_expired"}
 if(expires>now+3600)return {token:current,code:current?"admitted":"provider_auth_expired"}
 if(!canRefresh)return {token:current&&expires>now+60?current:null,
  code:"provider_auth_expired"}
 let lease:string|null=null
 try{
  const {data,error}=await db.rpc("upt_weeztix_claim_refresh",{
   p_event_id:eventId,p_workplace_id:workplaceId
  })
  if(error)return {token:null,code:"provider_unavailable"}
  lease=typeof data==="string"&&uuid.test(data)?data:null
  if(!lease)return {token:current&&expires>now+60?current:null,
   code:"provider_auth_refreshing"}
  const rotated=await fetchTokens(c)
  if(!rotated)return {token:current&&expires>now+60?current:null,
   code:"provider_auth_expired"}
  const next={...c,...rotated}
  const cipher=await sealOAuthToken("weeztix",next,key)
  const {data:committed,error:commitError}=await db.rpc("upt_weeztix_commit_refresh",{
   p_event_id:eventId,p_workplace_id:workplaceId,p_claim_id:lease,
   p_previous_ciphertext:scope.ciphertext,p_new_ciphertext:cipher
  })
  if(!commitError&&committed===true)return {token:rotated.WEEZTIX_ACCESS_TOKEN,code:"admitted"}
  // An admin might have rotated/disconnected while this refresh was running.
  // Re-check the *scoped* new connection before using a token.
  const fresh=await readScoped(db,eventId,workplaceId,key)
  if(fresh.value&&validScopedConfiguration(fresh.value.config,eventId)){
   const exp=Number(fresh.value.config.WEEZTIX_TOKEN_EXPIRES_AT)
   if((!Number.isFinite(exp)||exp>now+60)&&usable(fresh.value.config.WEEZTIX_ACCESS_TOKEN))
    return {token:fresh.value.config.WEEZTIX_ACCESS_TOKEN,code:"admitted"}
  }
  return {token:null,code:"provider_auth_refreshing"}
 }catch{return {token:null,code:"provider_unavailable"}}
 finally{
  if(lease)try{await db.rpc("upt_weeztix_release_refresh",{
   p_event_id:eventId,p_workplace_id:workplaceId,p_claim_id:lease
  })}catch{/* The lease has an automatic 22-second expiration. */}
 }
}
export async function scanWeeztix(db:RpcDb,env:ScannerBindings,input:ScanRequest):
 Promise<{status:number;body:ScanResult}>{
 if(!validScanRequest(input))return result("invalid_request",422)
 const key=env.UPT_INTEGRATION_ENCRYPTION_KEY
 if(!key||!validMasterKey(key))return result("scanner_disabled",503)
 // The SECURITY DEFINER RPC alone enforces approved live user, entrance-post
 // label, matching non-archived event, staff shift / responsible or admin scope.
 // No service key; client event/workplace identifiers are never authoritative.
 const scoped=await readScoped(db,input.eventId,input.workplaceId,key)
 if(scoped.status===403)return result("forbidden",403)
 if(scoped.status===503)return result("authorization_unavailable",503)
 if(!scoped.value)return result("not_configured",503)
 if(!validScopedConfiguration(scoped.value.config,input.eventId))
  return result("not_configured",503)
 const access=await resolveToken(db,scoped.value,input.eventId,input.workplaceId,key)
 if(!access.token)return result(access.code,503)
 let response:Response
 try{
  response=await fetch(scanEndpoint+encodeURIComponent(input.barcode),{
   method:"POST",headers:{Authorization:"Bearer "+access.token,Accept:"application/json"},
   redirect:"error",cache:"no-store",signal:AbortSignal.timeout(8500)
  })
 }catch{return result("provider_unavailable",503)}
 // Never log/return a ticket barcode, provider token or full vendor response.
 try{await response.body?.cancel()}catch{}
 if(response.status===204)return result("admitted",200)
 if(response.status===400)return result("provider_rejected",409)
 if(response.status===403)return result("provider_denied",403)
 if(response.status===404)return result("ticket_not_found",404)
 if(response.status===401)return result("provider_auth_expired",503)
 if(response.status===429)return result("provider_busy",503)
 return result("provider_unavailable",503)
}
