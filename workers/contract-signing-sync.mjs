// Isolated Cloudflare Worker: never import this into the Next.js application.
// Bind SUPABASE_URL, SUPABASE_SECRET, DOCUMENSO_URL, DOCUMENSO_TOKEN
// and INTERNAL_SIGNING_TOKEN only to this worker. No public route is enabled.
class PayloadTooLargeError extends Error {}
const validId=value=>typeof value==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(value)
const allowed={draft:["sent","completed","rejected","cancelled"],sent:["completed","rejected","cancelled"]}
const mapStatus={DRAFT:"draft",PENDING:"sent",COMPLETED:"completed",REJECTED:"rejected",CANCELLED:"cancelled"}
const unsafeHost=hostname=>{
 const host=hostname.toLowerCase().replace(/\.$/,"")
 if(host.length===0||host.includes("%"))return true
 if(host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host.endsWith(".internal")||host.endsWith(".test")||host.endsWith(".invalid"))return true
 if(host.startsWith("[")&&host.endsWith("]"))return true
 if(/^[0-9.]+$/.test(host)){
  const parts=host.split(".").map(Number)
  if(parts.length!==4||parts.some(x=>!Number.isInteger(x)||x<0||x>255))return true
  return parts[0]===0||parts[0]===10||parts[0]===127||parts[0]>=224||
   (parts[0]===169&&parts[1]===254)||(parts[0]===172&&parts[1]>=16&&parts[1]<=31)||
   (parts[0]===192&&parts[1]===168)||(parts[0]===100&&parts[1]>=64&&parts[1]<=127)||
   (parts[0]===198&&(parts[1]===18||parts[1]===19))
 }
 return false
}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}})
async function readBounded(stream,maxBytes){
 if(!stream)return new Uint8Array()
 const reader=stream.getReader()
 const chunks=[]
 let total=0
 try{
  while(true){
   const {done,value}=await reader.read()
   if(done)break
   total+=value.byteLength
   if(total>maxBytes)throw new PayloadTooLargeError("Payload too large")
   chunks.push(value)
  }
 }catch(error){
  await reader.cancel().catch(()=>{})
  throw error
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(total)
 let offset=0
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 return bytes
}
async function boundedJson(response){
 if(!response.ok)throw Error("Upstream rejected request")
 if(!/^application\/json(?:\s*;\s*charset\s*=\s*"?utf-8"?)?$/i.test(response.headers.get("content-type")||""))throw Error("Upstream JSON content type required")
 const rawLength=response.headers.get("content-length")
 if(rawLength!==null&&(!/^[0-9]+$/.test(rawLength)||Number(rawLength)>65536))throw Error("Upstream response too large")
 const bytes=await readBounded(response.body,65536)
 return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes))
}

export default {
 async fetch(request,env){
  if(request.method!=="POST"||new URL(request.url).pathname!=="/internal/signing/sync")return json({error:"Not found"},404)
  if(!env.INTERNAL_SIGNING_TOKEN||!env.SUPABASE_SECRET||!env.SUPABASE_URL||!env.DOCUMENSO_URL||!env.DOCUMENSO_TOKEN)return json({error:"Not configured"},503)
  const provided=request.headers.get("authorization")
  if(provided!==`Bearer ${env.INTERNAL_SIGNING_TOKEN}`)return json({error:"Unauthorized"},401)
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type")||""))return json({error:"JSON content type required"},415)
  try{
   const declared=request.headers.get("content-length")
   if(declared!==null&&(!/^[0-9]+$/.test(declared)||Number(declared)>2048))return json({error:"Request too large"},413)
   const body=await readBounded(request.body,2048)
   let input
   try{input=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(body))}
   catch(error){if(error instanceof SyntaxError||error instanceof TypeError)return json({error:"Invalid JSON request"},400);throw error}
   if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length!==1||!Object.hasOwn(input,"envelopeId")||!validId(input.envelopeId))return json({error:"Invalid envelope"},400)
   const base=new URL(env.SUPABASE_URL)
   const provider=new URL(env.DOCUMENSO_URL)
   if(base.protocol!=="https:"||provider.protocol!=="https:"||base.username||base.password||provider.username||provider.password||base.search||base.hash||provider.search||provider.hash||base.pathname!=="/"||provider.pathname!=="/"||base.port||provider.port||unsafeHost(base.hostname)||unsafeHost(provider.hostname))throw Error("Trusted HTTPS endpoints required")
   const headers={apikey:env.SUPABASE_SECRET,authorization:`Bearer ${env.SUPABASE_SECRET}`}
   const ledgerUrl=new URL("/rest/v1/administration_contract_signing_requests",base)
   ledgerUrl.searchParams.set("select","envelope_id,status,signed_pdf_path")
   ledgerUrl.searchParams.set("envelope_id",`eq.${input.envelopeId}`)
   const ledgerResponse=await fetch(ledgerUrl,{headers,redirect:"error",cache:"no-store"})
   const rows=await boundedJson(ledgerResponse)
   if(!Array.isArray(rows)||rows.length!==1||!rows[0]||typeof rows[0]!=="object"||Array.isArray(rows[0])||rows[0].envelope_id!==input.envelopeId||rows[0].signed_pdf_path!==null||typeof rows[0].status!=="string"||!["draft","sent","completed","rejected","cancelled"].includes(rows[0].status))return json({error:"Ledger not eligible"},409)
   const current=rows[0].status
   if(!allowed[current])return json({state:current,updated:false})
   const remoteUrl=new URL("/api/v2/envelope/"+encodeURIComponent(input.envelopeId),provider)
   const remote=await boundedJson(await fetch(remoteUrl,{headers:{authorization:`Bearer ${env.DOCUMENSO_TOKEN}`},redirect:"error",cache:"no-store"}))
   if(!remote||typeof remote!=="object"||Array.isArray(remote)||remote.id!==input.envelopeId||typeof remote.status!=="string"||!Object.hasOwn(mapStatus,remote.status))return json({error:"Remote evidence mismatch"},409)
   const next=mapStatus[remote.status]
   if(next===current)return json({state:current,updated:false})
   if(!allowed[current].includes(next))return json({error:"Invalid state transition"},409)
   const rpcUrl=new URL("/rest/v1/rpc/upt_server_transition_contract_signing",base)
   const result=await boundedJson(await fetch(rpcUrl,{method:"POST",redirect:"error",cache:"no-store",headers:{...headers,"content-type":"application/json"},body:JSON.stringify({p_envelope_id:input.envelopeId,p_expected_status:current,p_next_status:next})}))
   if(result!==true)return json({error:"Concurrent signing update"},409)
   return json({state:next,updated:true})
  }catch(error){
   if(error instanceof PayloadTooLargeError)return json({error:"Request too large"},413)
   return json({error:"Signing synchronization unavailable"},502)
  }
 }
}
