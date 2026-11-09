import {NextResponse} from "next/server"
import {administrationAccess,sameOrigin} from "@/lib/administration/access"
import {normalizeCloudmersiveOcr,verifiedOcrFileType} from "@/lib/administration/cloudmersive-ocr"

export const dynamic="force-dynamic"
const MAX_FILE=5*1024*1024
const MAX_REQUEST=MAX_FILE+250_000
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

export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"forbidden"},403)
 const access=await administrationAccess()
 if(!access.ok)return reply({error:"access_denied"},access.status)
 const key=process.env.CLOUDMERSIVE_OCR_API_KEY
 if(!key)return reply({error:"ocr_not_configured"},503)
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
  // The host and path are fixed. Never allow a client-selected URL or API key.
  const response=await fetch("https://api.cloudmersive.com"+path,{
   method:"POST",
   headers:{Apikey:key,language:lang,recognitionMode:"Basic"},
   body:upload,
   signal:AbortSignal.timeout(20_000),
   cache:"no-store",
  })
  if(!response.ok)return reply({error:response.status===401||response.status===403?"ocr_invalid_credentials":response.status===429?"ocr_rate_limited":"ocr_provider_unavailable"},503)
  const len=Number(response.headers.get("content-length")||0)
  if(len>350_000)return reply({error:"ocr_response_too_large"},502)
  const raw=await response.text()
  if(raw.length>350_000)return reply({error:"ocr_response_too_large"},502)
  let parsed:unknown
  try{parsed=JSON.parse(raw)}catch{return reply({error:"ocr_invalid_response"},502)}
  const result=normalizeCloudmersiveOcr(parsed,kind)
  if(!result)return reply({error:kind==="pdf"?"ocr_pdf_unavailable_or_pending":"ocr_empty_or_invalid"},422)
  return reply({...result,provider:"cloudmersive",reviewRequired:true},200)
 }catch{return reply({error:"ocr_provider_timeout_or_unavailable"},503)}
}
