import {NextResponse} from "next/server"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {requestHasSameOrigin} from "@/lib/request-origin"
import {isEntranceWorkplace,validWeeztixBarcode} from "@/lib/weeztix-scanner"

export const dynamic="force-dynamic"
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const fail=(code:string,status:number)=>NextResponse.json({ok:false,code},{status,headers:{"Cache-Control":"no-store"}})

async function boundedBody(request:Request):Promise<unknown>{
 const reader=request.body?.getReader()
 if(!reader)return null
 let length=0
 const chunks:Uint8Array[]=[]
 while(true){
  const next=await reader.read()
  if(next.done)break
  length+=next.value.byteLength
  if(length>1024){await reader.cancel().catch(()=>{});return null}
  chunks.push(next.value)
 }
 const buffer=new Uint8Array(length);let offset=0
 for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(buffer))}catch{return null}
}

/**
 * Online Weeztix admission is authoritative: a QR decode alone never grants entrance.
 * UpTillDawn only exposes a single operator-approved event at a time. Provider credentials
 * MUST be restricted by Weeztix event permissions where possible; the scan API does not
 * return an event GUID, so this cannot certify arbitrary cross-event ticket ownership.
 */
export async function POST(request:Request){
 if(!requestHasSameOrigin(request))return fail("forbidden",403)
 if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return fail("invalid_request",415)
 const user=await getCurrentUser()
 if(!user)return fail("unauthorized",401)
 if((!user.approved||user.account_blocked)&&!user.isOwner)return fail("forbidden",403)
 let input:unknown
 try{input=await boundedBody(request)}catch{return fail("invalid_request",400)}
 if(!input||typeof input!=="object"||Array.isArray(input))return fail("invalid_request",422)
 const raw=input as Record<string,unknown>
 const eventId=raw.eventId,workplaceId=raw.workplaceId,barcode=raw.barcode
 if(typeof eventId!=="string"||!uuid.test(eventId)||typeof workplaceId!=="string"||!uuid.test(workplaceId)||!validWeeztixBarcode(barcode))return fail("invalid_request",422)
 const db=await createClient()
 const {data:workplace,error:workplaceError}=await db.from("workplaces").select("id,event_id,name,is_active").eq("id",workplaceId).eq("event_id",eventId).maybeSingle()
 if(workplaceError)return fail("authorization_unavailable",503)
 if(!workplace||!workplace.is_active||!isEntranceWorkplace(workplace.name))return fail("forbidden",403)
 const {data:event,error:eventError}=await db.from("events").select("id,status").eq("id",eventId).maybeSingle()
 if(eventError)return fail("authorization_unavailable",503)
 if(!event||event.status==="archived")return fail("forbidden",403)
 const isAdmin=Boolean(user.isAdmin||user.realIsAdmin||user.isOwner)
 if(!isAdmin){
  const [{data:shift,error:shiftError},{data:responsible,error:responsibleError}]=await Promise.all([
   db.from("shifts").select("id").eq("user_id",user.id).eq("event_id",eventId).eq("workplace_id",workplaceId).neq("status","cancelled").neq("response_status","declined").limit(1),
   db.from("responsible_assignments").select("workplace_id").eq("user_id",user.id).eq("event_id",eventId).eq("workplace_id",workplaceId).limit(1),
  ])
  if(shiftError||responsibleError)return fail("authorization_unavailable",503)
  if(!shift?.length&&!responsible?.length)return fail("forbidden",403)
 }
 // Never send anything upstream until the operator explicitly enables this
 // event and installs a provider-issued server-side token. No client tokens.
 if(process.env.WEEZTIX_SCANNING_ENABLED!=="true"||
    process.env.WEEZTIX_ACTIVE_EVENT_ID!==eventId||
    !process.env.WEEZTIX_ACCESS_TOKEN)return fail("not_configured",503)
 let response:Response
 try{
  response=await fetch("https://api.weeztix.com/order/scanbarcode/"+encodeURIComponent(barcode),{
   method:"POST",
   headers:{Authorization:"Bearer "+process.env.WEEZTIX_ACCESS_TOKEN,Accept:"application/json"},
   redirect:"error",cache:"no-store",signal:AbortSignal.timeout(8500),
  })
 }catch{return fail("provider_unavailable",503)}
 if(response.status===204)return NextResponse.json({ok:true,code:"admitted"},{headers:{"Cache-Control":"no-store"}})
 if(response.status===400)return fail("provider_rejected",409)
 if(response.status===403)return fail("provider_denied",403)
 if(response.status===404)return fail("ticket_not_found",404)
 if(response.status===401)return fail("provider_auth_expired",503)
 if(response.status===429)return fail("provider_busy",503)
 return fail("provider_unavailable",503)
}
