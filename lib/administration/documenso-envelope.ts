import "server-only"
import {getDocumensoConfig,signingDispatchEnabled} from "./documenso"

/** Documenso v2 envelope API; deliberately separates creation from sending. */
function api(){
 const config=getDocumensoConfig()
 if(!config)throw new Error("Documenso is not configured")
 return {base:config.baseUrl+"/api/v2",token:config.apiKey}
}
async function request(path:string,options:RequestInit={}):Promise<unknown>{
 const {base,token}=api()
 const response=await fetch(base+path,{
  ...options,
  headers:{Authorization:token,...options.headers},
  cache:"no-store",redirect:"error",signal:AbortSignal.timeout(20000)
 })
 if(!response.ok)throw new Error("Documenso request failed ("+response.status+")")
 return response.json()
}
function envelopeId(value:unknown):string{
 if(!value||typeof value!=="object"||!("id" in value)||typeof value.id!=="string"||
  !/^[a-zA-Z0-9_-]{1,128}$/.test(value.id))throw new Error("Invalid Documenso envelope response")
 return value.id
}
export async function createContractSigningDraft(input:{
 pdf:Uint8Array
 reference:string
 title:string
 recipient:{name:string;email:string}
 signaturePage:number
}):Promise<{envelopeId:string}>{
 if(!/^((artist|staff)-[0-9a-f-]{36}-v[1-9][0-9]*)$/.test(input.reference))throw new Error("Invalid contract reference")
 if(!Number.isSafeInteger(input.signaturePage)||input.signaturePage<1)throw new Error("Invalid signature page")
 if(input.pdf.length===0||input.pdf.length>15*1024*1024||
  new TextDecoder().decode(input.pdf.slice(0,5))!=="%PDF-")throw new Error("Invalid signing PDF")
 if(!input.recipient.name.trim()||!/^\S+@\S+\.\S+$/.test(input.recipient.email))throw new Error("Invalid signer")
 const form=new FormData()
 form.set("payload",JSON.stringify({
  type:"DOCUMENT",title:input.title,externalId:input.reference,
  recipients:[{
   name:input.recipient.name,email:input.recipient.email,role:"SIGNER",
   fields:[{identifier:0,type:"SIGNATURE",page:input.signaturePage,
    positionX:10,positionY:80,width:35,height:8}]
  }]
 }))
 form.set("files",new Blob([input.pdf],{type:"application/pdf"}),"contract.pdf")
 const result=await request("/envelope/create",{method:"POST",body:form})
 return {envelopeId:envelopeId(result)}
}
/** Sending requires explicit authorization by the caller and an already-persisted envelope ID. */
export async function distributeContractSigningDraft(input:{
 envelopeId:string
 dispatchApproved:boolean
}):Promise<void>{
 if(input.dispatchApproved!==true)throw new Error("Contract dispatch approval required")
 if(!signingDispatchEnabled())throw new Error("Documenso distribution is disabled")
 if(!/^[a-zA-Z0-9_-]{1,128}$/.test(input.envelopeId))throw new Error("Invalid envelope ID")
 await request("/envelope/distribute",{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({envelopeId:input.envelopeId})
 })
}
export async function getContractSigningStatus(id:string):Promise<{
 id:string;status:"DRAFT"|"PENDING"|"COMPLETED"|"REJECTED"|"CANCELLED"
}>{
 if(!/^[a-zA-Z0-9_-]{1,128}$/.test(id))throw new Error("Invalid envelope ID")
 const data=await request("/envelope/"+encodeURIComponent(id))
 if(!data||typeof data!=="object"||!("id" in data)||data.id!==id||!("status" in data)||
  !["DRAFT","PENDING","COMPLETED","REJECTED","CANCELLED"].includes(String(data.status))){
  throw new Error("Invalid Documenso status")
 }
 return {id,status:data.status as "DRAFT"|"PENDING"|"COMPLETED"|"REJECTED"|"CANCELLED"}
}
