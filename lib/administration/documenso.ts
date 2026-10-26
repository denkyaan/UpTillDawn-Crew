/**
 * Server-only Documenso connection. No API token is ever sent to a browser.
 * Sending envelopes remains disabled until a signing instance is configured.
 */
import "server-only"

export type SigningConnectionStatus =
 | {configured:false;healthy:false;certificateReady:false;reason:"not_configured"}
 | {configured:true;healthy:boolean;certificateReady:boolean;reason:"ready"|"unreachable"|"certificate_missing"}

export function getDocumensoConfig(){
 const raw=process.env.DOCUMENSO_BASE_URL
 const token=process.env.DOCUMENSO_API_KEY
 if(!raw||!token)return null
 let url:URL
 try{url=new URL(raw)}catch{return null}
 if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash)return null
 if(!url.hostname||url.hostname==="localhost"||url.hostname.endsWith(".local"))return null
 return {baseUrl:url.origin,apiKey:token}
}

export async function checkSigningConnection():Promise<SigningConnectionStatus>{
 const config=getDocumensoConfig()
 if(!config)return {configured:false,healthy:false,certificateReady:false,reason:"not_configured"}
 try{
  const [health,certificate]=await Promise.all([
   fetch(config.baseUrl+"/api/health",{cache:"no-store",signal:AbortSignal.timeout(5000)}),
   fetch(config.baseUrl+"/api/certificate-status",{cache:"no-store",signal:AbortSignal.timeout(5000)})
  ])
  if(!health.ok||!certificate.ok)return {configured:true,healthy:false,certificateReady:false,reason:"unreachable"}
  const healthData:unknown=await health.json()
  const certData:unknown=await certificate.json()
  const status=(value:unknown)=>value!==null&&typeof value==="object"&&"status" in value?String(value.status):""
  const healthy=status(healthData)==="ok"
  const certificateReady=status(certData)==="ok"
  return {configured:true,healthy,certificateReady,reason:healthy&&certificateReady?"ready":"certificate_missing"}
 }catch{return {configured:true,healthy:false,certificateReady:false,reason:"unreachable"}}
}
