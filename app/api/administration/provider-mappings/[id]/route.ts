import {NextResponse} from "next/server"
import {administrationAccess,sameOrigin} from "@/lib/administration/access"
export const dynamic="force-dynamic"
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}})
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return reply({error:"forbidden"},403)
 const access=await administrationAccess()
 if(!access.ok)return reply({error:"access_denied"},access.status)
 if(!access.user.isAdmin&&!access.user.isOwner)return reply({error:"admin_approval_required"},403)
 const {id}=await params
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))return reply({error:"invalid_id"},422)
 let body:unknown
 try{const raw=await request.text();if(new TextEncoder().encode(raw).byteLength>4096)return reply({error:"payload_too_large"},413);body=JSON.parse(raw)}catch{return reply({error:"invalid_json"},400)}
 if(!body||typeof body!=="object"||Array.isArray(body))return reply({error:"invalid_payload"},422)
 const input=body as Record<string,unknown>
 if(Object.keys(input).length!==1||typeof input.enabled!=="boolean")return reply({error:"invalid_payload"},422)
 const {data,error}=await access.db.from("admin_provider_event_mappings").update({enabled:input.enabled,updated_at:new Date().toISOString()}).eq("id",id).select("id,enabled").maybeSingle()
 if(error)return reply({error:"mapping_update_failed"},503)
 return data?reply({mapping:data}):reply({error:"not_found"},404)
}
