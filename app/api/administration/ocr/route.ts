import {NextResponse} from "next/server"
import {administrationAccess,sameOrigin} from "@/lib/administration/access"
import {normalizeCloudmersiveOcr,verifiedOcrFileType} from "@/lib/administration/cloudmersive-ocr"
import {pendingPdfJobId,signOcrJob,verifyOcrJob} from "@/lib/administration/cloudmersive-ocr-job"

export const dynamic="force-dynamic"
const MAX_FILE=5*1024*1024
const MAX_REQUEST=MAX_FILE+250_000
const MAX_RESPONSE=350_000
const reply=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}})

async function readBoundedForm(request:Request):Promise<FormData|null>{
 const stream=request.body
 if(!stream)return null
 const reader=stream.getReader()
 const chunks:Uint8Array[]=[]
 let size=0
 try{
  while(true){
   const part=await reader.read()
   if(part.done)break
   size+=part.value.byteLength
   if(size>MAX_REQUEST){await reader.cancel();return null}
   chunks.push(part.value)
  }
  const buffer=new Uint8Array(size)
  let offset=0
  for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length}
  return await new Response(buffer,{headers:{"Content-Type":request.headers.get("content-type")||""}}).formData()
 }catch{return null}finally{reader.releaseLock()}
}

/** Cap untrusted upstream responses even if Content-Length is omitted. */
async function readProviderJson(response:Response):Promise<unknown|null>{
 const len=Number(response.headers.get("content-length")||0)
 if(!Number.isFinite(len)||len>MAX_RESPONSE)return null
 const stream=response.body
 if(!stream)return null
 const reader=stream.getReader()
 let size=0
 const chunks:Uint8Array[]=[]
 try{
  for(;;){
   const {done,value}=await reader.read()
   if(done)break
   size+=value.byteLength
   if(size>MAX_RESPONSE){await reader.cancel();return null}
   chunks.push(value)
  }
  const result=new Uint8Array(size)
  let pos=0
  for(const part of chunks){result.set(part,pos);pos+=part.byteLength}
  return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(result)) as unknown
 }catch{return null}finally{reader.releaseLock()}
}

async function handleProvider(response:Response,kind:"image"|"pdf",key:string,userId:string,pollToken?:string){
 if(!response.ok)return reply({error:response.status===401||response.status===403?"ocr_invalid_credentials":response.status===429?"ocr_rate_limited":"ocr_provider_unavailable"},503)
 const parsed=await readProviderJson(response)
 if(!parsed)return reply({error:"ocr_invalid_or_oversized_response"},502)
 if(kind==="pdf"){
  const job=pendingPdfJobId(parsed)
  if(job){
   const token=pollToken??signOcrJob(job,userId,key)
   if(!token)return reply({error:"ocr_invalid_job_identifier"},502)
   return reply({pending:true,token},202)
  }
 }
 const result=normalizeCloudmersiveOcr(parsed,kind)
 if(!result)return reply({error:kind==="pdf"?"ocr_pdf_unavailable_or_pending":"ocr_empty_or_invalid"},422)
 return reply({...result,provider:"cloudmersive",reviewRequired:true},200)
}

export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"forbidden"},403)
 const access=await administrationAccess()
 if(!access.ok)return reply({error:"access_denied"},access.status)
 const key=process.env.CLOUDMERSIVE_OCR_API_KEY
 if(!key)return reply({error:"ocr_not_configured"},503)

 // Resume an async PDF job. No provider ID is accepted without an HMAC bound
 // to the current authenticated Administration user; never send it in a URL.
 const pollToken=request.headers.get("x-ocr-job-token")
 if(pollToken!==null){
  if(request.body)return reply({error:"invalid_poll_request"},415)
  const id=verifyOcrJob(pollToken,access.user.id,key)
  if(!id)return reply({error:"ocr_job_expired_or_forbidden"},403)
  try{
   const response=await fetch("https://api.cloudmersive.com/ocr/pdf/get-job-status?"+new URLSearchParams({AsyncJobID:id}),{
    method:"GET",headers:{Apikey:key},signal:AbortSignal.timeout(20_000),cache:"no-store"
   })
   return await handleProvider(response,"pdf",key,access.user.id,pollToken)
  }catch{return reply({error:"ocr_provider_timeout_or_unavailable"},503)}
 }

 const type=request.headers.get("content-type")||""
 if(!type.startsWith("multipart/form-data;")||!request.body)return reply({error:"invalid_upload"},415)
 const form=await readBoundedForm(request)
 if(!form)return reply({error:"upload_too_large_or_invalid"},413)
 const file=form.get("file")
 if(!(file instanceof File)||file.size<8||file.size>MAX_FILE)return reply({error:"invalid_file"},422)
 const lang=form.get("language")
 const languages=new Set(["NLD","ENG","FRA","DEU"])
 if(typeof lang!=="string"||!languages.has(lang))return reply({error:"invalid_language"},422)
 let bytes:Uint8Array
 try{bytes=new Uint8Array(await file.arrayBuffer())}catch{return reply({error:"invalid_file"},422)}
 const verifiedType=verifiedOcrFileType(bytes,file.type,file.name)
 if(!verifiedType)return reply({error:"unsupported_file_format"},422)
 const kind=verifiedType==="application/pdf"?"pdf":"image"
 const path=kind==="pdf"?"/ocr/pdf/toText":"/ocr/photo/toText"
 const upload=new FormData()
 upload.append("imageFile",new Blob([bytes],{type:verifiedType}),file.name.slice(0,150))
 try{
  // The host and path are fixed. Never allow client-supplied URLs/API keys.
  const response=await fetch("https://api.cloudmersive.com"+path,{
   method:"POST",
   headers:{Apikey:key,language:lang,recognitionMode:"Basic"},
   body:upload,
   signal:AbortSignal.timeout(20_000),
   cache:"no-store"
  })
  return await handleProvider(response,kind,key,access.user.id)
 }catch{return reply({error:"ocr_provider_timeout_or_unavailable"},503)}
}
