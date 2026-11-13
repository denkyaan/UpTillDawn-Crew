import "server-only"
import {validAccountAccess} from "./provider-account-access"

/**
 * Read-only provider diagnostics: Billit sandbox metadata and Ponto bank-account
 * authorization (without returning banking data). No money movement, invoice
 * transmission or signing; no secret or provider response body leaves this module.
 */
export type ConnectionProvider="sumup"|"documenso"|"banking"|"peppol"
export type ConnectionState="not_configured"|"connected"|"unauthorized"|"unavailable"|"needs_account_access"

function configured(v:string|undefined){return typeof v==="string"&&v.trim().length>0}

async function safeFetch(url:string,init:RequestInit):Promise<Response|null>{
 try{return await fetch(url,{...init,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(6500)})}
 catch{return null}
}

/** Bounded provider metadata parsing: never return account identities or secrets. */
async function safeMetadata(response:Response|null):Promise<unknown>{
 if(!response?.ok||!response.body)return null
 const claimed=Number(response.headers.get("content-length")??"0")
 if(!Number.isSafeInteger(claimed)||claimed<0||claimed>16384)return null
 const reader=response.body.getReader(),chunks:Uint8Array[]=[]
 let size=0
 try{
  while(true){
   const {done,value}=await reader.read()
   if(done)break
   size+=value.byteLength
   if(size>16384){await reader.cancel().catch(()=>{});return null}
   chunks.push(value)
  }
 }catch{return null}
 finally{reader.releaseLock()}
 const all=new Uint8Array(size)
 let i=0
 for(const chunk of chunks){all.set(chunk,i);i+=chunk.byteLength}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(all)) as unknown}
 catch{return null}
}
/** Ponto uses JSON:API. No account number, IBAN, balance or owner is returned. */

function result(response:Response|null):ConnectionState{
 if(!response)return "unavailable"
 if(response.status===401||response.status===403)return "unauthorized"
 if(response.ok)return "connected"
 return "unavailable"
}

function safeDocumensoOrigin(raw:string):string|null{
 try{
  const url=new URL(raw)
  if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/")return null
  const hostname=url.hostname.toLowerCase()
  if(hostname==="localhost"||hostname.endsWith(".local")||hostname.endsWith(".localhost")||hostname==="[::1]"||hostname==="[::]")return null
  const octets=hostname.split(".").map(Number)
  if(octets.length===4&&octets.every(n=>Number.isInteger(n)&&n>=0&&n<=255)){
   const [a,b]=octets
   if(a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a>=224)return null
  }
  return url.origin
 }catch{return null}
}

/** Called only on explicit administrator button click and no more often than the client UI allows. */
export async function checkProviderConnection(id:ConnectionProvider,env:NodeJS.ProcessEnv=process.env):Promise<ConnectionState>{
 if(id==="sumup"){
  const key=env.SUMUP_API_KEY,merchant=env.SUMUP_MERCHANT_CODE
  if(!configured(key)||!configured(merchant))return "not_configured"
  return result(await safeFetch("https://api.sumup.com/v0.1/me",{method:"GET",headers:{"Authorization":"Bearer "+key,"Accept":"application/json"}}))
 }
 if(id==="documenso"){
  const key=env.DOCUMENSO_API_KEY,origin=safeDocumensoOrigin(env.DOCUMENSO_BASE_URL||"")
  if(!configured(key)||!origin)return "not_configured"
  // Documenso v2 envelope list. No document contents are requested or returned.
  // API key auth is the raw token (not Bearer), per official Documenso reference.
  return result(await safeFetch(origin+"/api/v2/envelope?perPage=1",{method:"GET",headers:{"Authorization":key!,"Accept":"application/json"}}))
 }
 if(id==="banking"){
  const id=env.PONTO_CLIENT_ID,secret=env.PONTO_CLIENT_SECRET
  if(!configured(id)||!configured(secret))return "not_configured"
  // Ponto client-credentials grant is an authentication probe, not bank
  // authorization, consent, transaction retrieval or payment initiation.
  const response=await safeFetch("https://api.myponto.com/oauth2/token",{
   method:"POST",
   headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json","Authorization":"Basic "+Buffer.from(id+":"+secret).toString("base64")},
   body:"grant_type=client_credentials"
  })
  if(!response)return "unavailable"
  if(response.status===401||response.status===403)return "unauthorized"
  if(!response.ok)return "unavailable"
  // A 2xx without an access token would not prove successful authentication.
  const json=await safeMetadata(response)
  if(!json||typeof json!=="object"||!("access_token" in json)||
     typeof json.access_token!=="string"||json.access_token.length<11||
     json.access_token.length>4096||/[\u0000-\u001f\u007f]/.test(json.access_token)||
     !("scope" in json)||typeof json.scope!=="string"||
     !json.scope.split(" ").includes("ai"))return "unavailable"
  const accounts=await safeFetch("https://api.myponto.com/accounts?page%5Blimit%5D=1",{
   method:"GET",headers:{"Authorization":"Bearer "+json.access_token,"Accept":"application/json"}
  })
  if(!accounts)return "unavailable"
  if(accounts.status===401||accounts.status===403)return "unauthorized"
  if(!accounts.ok)return "unavailable"
  return validAccountAccess(await safeMetadata(accounts))
 }
 if(id==="peppol"){
  const party=env.BILLIT_SANDBOX_PARTY_ID,key=env.BILLIT_SANDBOX_API_KEY
  if(!configured(party)||!configured(key)||!/^[1-9][0-9]{2,14}$/.test(party??"")||
     /[\u0000-\u001f\u007f]/.test(key??""))return "not_configured"
  // Official Billit sandbox only: GET list, never create/send a document.
  // Verifies the PartyID + ApiKey pair without revealing invoice contents.
  return result(await safeFetch("https://api.sandbox.billit.be/v1/orders",{
   method:"GET",headers:{"ApiKey":key!,"PartyID":party!,"Accept":"application/json"}
  }))
 }
 return "not_configured"
}
