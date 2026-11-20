import "server-only"
import {getDocumensoConfig,checkSigningConnection,signingDispatchEnabled} from "./documenso"

/** Configuration report, not permission to dispatch. Never exposes secrets. */
export async function inspectContractServiceReadiness():Promise<{
 ready:false
 checks:{id:string;ok:boolean}[]
}>{
 const signing=getDocumensoConfig()
 const pdfUrl=process.env.CONTRACT_PDF_RENDER_URL
 const pdfToken=process.env.CONTRACT_PDF_RENDER_TOKEN
 let rendererConfigured=false
 try{
  if(pdfUrl&&pdfToken){
   const url=new URL(pdfUrl)
   rendererConfigured=url.protocol==="https:"&&!url.username&&!url.password&&!url.search&&!url.hash&&
    !!url.hostname&&url.hostname!=="localhost"&&!url.hostname.endsWith(".local")
  }
 }catch{rendererConfigured=false}
 const connection=await checkSigningConnection()
 return {ready:false,checks:[
  {id:"documenso_configured",ok:Boolean(signing)},
  {id:"documenso_reachable",ok:connection.healthy},
  {id:"certificate_ready",ok:connection.certificateReady},
  {id:"pdf_renderer_configured",ok:rendererConfigured},
  {id:"dispatch_enabled",ok:signingDispatchEnabled()}
 ]}
}
