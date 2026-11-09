import "server-only"

/**
 * Credential-only provider diagnostics. Not a payment, bank read, document
 * upload, contract send or invoice transmission. No provider response body
 * or secret leaves this module.
 */
export type ConnectionProvider="sumup"|"documenso"|"banking"
export type ConnectionState="not_configured"|"connected"|"unauthorized"|"unavailable"

function configured(v:string|undefined){return typeof v==="string"&&v.trim().length>0}

async function safeFetch(url:string,init:RequestInit):Promise<Response|null>{
 try{return await fetch(url,{...init,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(6500)})}
 catch{return null}
}

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
  try{
   const bytes=await response.text()
   if(bytes.length>8192)return "unavailable"
   const json:unknown=JSON.parse(bytes)
   return json&&typeof json==="object"&&"access_token" in json&&typeof json.access_token==="string"&&json.access_token.length>10?"connected":"unavailable"
  }catch{return "unavailable"}
 }
 return "not_configured"
}
