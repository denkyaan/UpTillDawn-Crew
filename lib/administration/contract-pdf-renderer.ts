import "server-only"
import type {ContractPdfRenderer} from "./contract-generation-pipeline"

/**
 * Optional dedicated HTML-to-PDF renderer, hosted separately from Cloudflare Workers.
 * No contract is sent unless the operator explicitly configures the endpoint.
 * The renderer must return an actual application/pdf response.
 */
export function createContractPdfRenderer():ContractPdfRenderer{
 const endpoint=process.env.CONTRACT_PDF_RENDER_URL
 const token=process.env.CONTRACT_PDF_RENDER_TOKEN
 if(!endpoint||!token)throw new Error("Contract PDF rendering is not configured")
 if(new TextEncoder().encode(token).byteLength<32||/[\r\n]/.test(token))throw new Error("Invalid PDF renderer authentication token")
 let url:URL
 try{url=new URL(endpoint)}catch{throw new Error("Invalid PDF renderer URL")}
 if(url.protocol!=="https:"||url.username||url.password||url.hash||url.search||
  !url.hostname||url.hostname==="localhost"||url.hostname.endsWith(".local")||
  url.hostname.endsWith(".internal")||url.hostname.endsWith(".localhost")||
  /^(?:127|10|0|192\.168)\./.test(url.hostname)||
  /^172\.(?:1[6-9]|2[0-9]|3[01])\./.test(url.hostname)||
  /^169\.254\./.test(url.hostname)||
  url.hostname.startsWith("[")||/^\d+(?:\.\d+){3}$/.test(url.hostname)){
  throw new Error("PDF renderer must use a dedicated HTTPS endpoint")
 }
 return async(html:string)=>{
  if(new TextEncoder().encode(html).byteLength>512_000)throw new Error("Contract HTML exceeds renderer limit")
  const response=await fetch(url.toString(),{
   method:"POST",
   headers:{"Authorization":"Bearer "+token,"Content-Type":"text/html; charset=utf-8","Accept":"application/pdf"},
   body:html,
   cache:"no-store",
   redirect:"error",
   signal:AbortSignal.timeout(30_000)
  })
  if(!response.ok||!/^application\/pdf(?:\s*;|\s*$)/i.test(response.headers.get("content-type")??"")){
   throw new Error("Contract PDF rendering failed")
  }
  const lengthHeader=response.headers.get("content-length")
  const length=lengthHeader===null?null:Number(lengthHeader)
  if(length!==null&&(!Number.isSafeInteger(length)||length<0))throw new Error("Invalid renderer response length")
  if(length!==null&&length>15*1024*1024)throw new Error("Rendered PDF too large")
  const reader=response.body?.getReader()
  if(!reader)throw new Error("PDF renderer returned an empty stream")
  const chunks:Uint8Array[]=[]
  let total=0
  try{
   while(true){
    const {done,value}=await reader.read()
    if(done)break
    total+=value.byteLength
    if(total>15*1024*1024)throw new Error("Rendered PDF too large")
    chunks.push(value)
   }
  }catch(error){
   // Stop downloading immediately when the remote renderer exceeds limits or fails.
   await reader.cancel().catch(()=>{})
   throw error
  }finally{reader.releaseLock()}
  const bytes=new Uint8Array(total)
  let offset=0
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  // Fetch can transparently decompress a response; encoded Content-Length is then unreliable.
  const encoding=(response.headers.get("content-encoding")??"identity").trim().toLowerCase()
  if(encoding!=="identity")throw new Error("Compressed PDF responses are not supported")
  if(length!==null&&bytes.byteLength!==length)throw new Error("Renderer response length mismatch")
  if(bytes.byteLength===0||bytes.byteLength>15*1024*1024||
   new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-"){
   throw new Error("Renderer returned invalid PDF")
  }
  const tail=new TextDecoder("latin1").decode(bytes.slice(-1024))
  if(!/%%EOF\s*$/.test(tail))throw new Error("Renderer returned incomplete PDF")
  return bytes
 }
}
