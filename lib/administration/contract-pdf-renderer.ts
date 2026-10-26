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
 let url:URL
 try{url=new URL(endpoint)}catch{throw new Error("Invalid PDF renderer URL")}
 if(url.protocol!=="https:"||url.username||url.password||url.hash||url.search||
  !url.hostname||url.hostname==="localhost"||url.hostname.endsWith(".local")){
  throw new Error("PDF renderer must use a dedicated HTTPS endpoint")
 }
 return async(html:string)=>{
  if(html.length>512_000)throw new Error("Contract HTML exceeds renderer limit")
  const response=await fetch(url.toString(),{
   method:"POST",
   headers:{"Authorization":"Bearer "+token,"Content-Type":"text/html; charset=utf-8","Accept":"application/pdf"},
   body:html,
   cache:"no-store",
   redirect:"error",
   signal:AbortSignal.timeout(30_000)
  })
  if(!response.ok||!response.headers.get("content-type")?.toLowerCase().includes("application/pdf")){
   throw new Error("Contract PDF rendering failed")
  }
  const length=Number(response.headers.get("content-length")??"0")
  if(length>15*1024*1024)throw new Error("Rendered PDF too large")
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
  }finally{reader.releaseLock()}
  const bytes=new Uint8Array(total)
  let offset=0
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  if(bytes.byteLength===0||bytes.byteLength>15*1024*1024||
   new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-"){
   throw new Error("Renderer returned invalid PDF")
  }
  return bytes
 }
}
