// Isolated Cloudflare Worker: never import this into the Next.js application.
// Bind SUPABASE_URL, SUPABASE_SECRET, DOCUMENSO_URL, DOCUMENSO_TOKEN
// and INTERNAL_SIGNING_TOKEN only to this worker. No public route is enabled.
const validId=value=>typeof value==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(value)
const allowed={draft:["sent","completed","rejected","cancelled"],sent:["completed","rejected","cancelled"]}
const mapStatus={DRAFT:"draft",PENDING:"sent",COMPLETED:"completed",REJECTED:"rejected",CANCELLED:"cancelled"}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}})
async function boundedJson(response){
 if(!response.ok)throw Error("Upstream rejected request")
 const size=Number(response.headers.get("content-length")||0)
 if(!Number.isSafeInteger(size)||size>65536)throw Error("Upstream response too large")
 const text=await response.text()
 if(text.length>65536)throw Error("Upstream response too large")
 return JSON.parse(text)
}
export default {
 async fetch(request,env){
  if(request.method!=="POST"||new URL(request.url).pathname!=="/internal/signing/sync")return json({error:"Not found"},404)
  if(!env.INTERNAL_SIGNING_TOKEN||!env.SUPABASE_SECRET||!env.SUPABASE_URL||!env.DOCUMENSO_URL||!env.DOCUMENSO_TOKEN)return json({error:"Not configured"},503)
  const provided=request.headers.get("authorization")
  if(provided!==`Bearer ${env.INTERNAL_SIGNING_TOKEN}`)return json({error:"Unauthorized"},401)
  try{
   if(Number(request.headers.get("content-length")||0)>2048)return json({error:"Request too large"},413)
   const input=await request.json()
   if(!validId(input.envelopeId))return json({error:"Invalid envelope"},400)
   const base=new URL(env.SUPABASE_URL)
   const provider=new URL(env.DOCUMENSO_URL)
   if(base.protocol!=="https:"||provider.protocol!=="https:")throw Error("HTTPS required")
   const headers={apikey:env.SUPABASE_SECRET,authorization:`Bearer ${env.SUPABASE_SECRET}`}
   const ledgerUrl=new URL("/rest/v1/administration_contract_signing_requests",base)
   ledgerUrl.searchParams.set("select","envelope_id,status,signed_pdf_path")
   ledgerUrl.searchParams.set("envelope_id",`eq.${input.envelopeId}`)
   const ledgerResponse=await fetch(ledgerUrl,{headers})
   const rows=await boundedJson(ledgerResponse)
   if(!Array.isArray(rows)||rows.length!==1||rows[0].envelope_id!==input.envelopeId||rows[0].signed_pdf_path)return json({error:"Ledger not eligible"},409)
   const current=rows[0].status
   if(!allowed[current])return json({state:current,updated:false})
   const remoteUrl=new URL("/api/v2/envelope/"+encodeURIComponent(input.envelopeId),provider)
   const remote=await boundedJson(await fetch(remoteUrl,{headers:{authorization:`Bearer ${env.DOCUMENSO_TOKEN}`}}))
   if(remote.id!==input.envelopeId||!Object.hasOwn(mapStatus,remote.status))return json({error:"Remote evidence mismatch"},409)
   const next=mapStatus[remote.status]
   if(next===current)return json({state:current,updated:false})
   if(!allowed[current].includes(next))return json({error:"Invalid state transition"},409)
   const rpcUrl=new URL("/rest/v1/rpc/upt_server_transition_contract_signing",base)
   const result=await boundedJson(await fetch(rpcUrl,{method:"POST",headers:{...headers,"content-type":"application/json"},body:JSON.stringify({p_envelope_id:input.envelopeId,p_expected_status:current,p_next_status:next})}))
   if(result!==true)return json({error:"Concurrent signing update"},409)
   return json({state:next,updated:true})
  }catch{return json({error:"Signing synchronization unavailable"},502)}
 }
}
