import {NextResponse} from "next/server"
import {administrationAccess,sameOrigin} from "@/lib/administration/access"
import {validateProviderEventMappings} from "@/lib/administration/provider-event-mapping"
export const dynamic="force-dynamic"
const respond=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}})
export async function GET(){
 const access=await administrationAccess()
 if(!access.ok)return respond({error:"access_denied"},access.status)
 const {data,error}=await access.db.from("admin_provider_event_mappings").select("id,provider,external_event_id,event_id,enabled,created_at").order("created_at",{ascending:false}).limit(200)
 return error?respond({error:"mapping_read_failed"},503):respond({mappings:data??[],canActivate:true})
}
export async function POST(request:Request){
 if(!sameOrigin(request))return respond({error:"forbidden"},403)
 const access=await administrationAccess()
 if(!access.ok)return respond({error:"access_denied"},access.status)
 let body:unknown
 try{const raw=await request.text();if(new TextEncoder().encode(raw).byteLength>8192)return respond({error:"payload_too_large"},413);body=JSON.parse(raw)}catch{return respond({error:"invalid_json"},400)}
 if(!body||typeof body!=="object"||Array.isArray(body))return respond({error:"invalid_mapping"},422)
 const input=body as Record<string,unknown>
 const check=validateProviderEventMappings([{provider:input.provider as "eventix"|"sumup",externalEventId:input.externalEventId as string,eventId:input.eventId as string,enabled:false}])
 if(check.errors.length)return respond({error:"invalid_mapping",details:check.errors},422)
 const m=check.mappings[0]
 const {data:event,error:eventError}=await access.db.from("events").select("id").eq("id",m.eventId).maybeSingle()
 if(eventError)return respond({error:"event_lookup_failed"},503)
 if(!event)return respond({error:"event_not_found"},422)
 const {data,error}=await access.db.from("admin_provider_event_mappings").insert({provider:m.provider,external_event_id:m.externalEventId,event_id:m.eventId,enabled:false,created_by:access.user.id}).select("id,provider,external_event_id,event_id,enabled").single()
 if(error)return respond({error:error.code==="23505"?"duplicate_mapping":"mapping_write_failed"},error.code==="23505"?409:503)
 return respond({mapping:data},201)
}
