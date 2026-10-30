import {NextResponse} from "next/server"
import {createHash} from "node:crypto"
import type {SupabaseClient} from "@supabase/supabase-js"
import {administrationAccess,sameOrigin} from "@/lib/administration/access"
import {validateTicketSalesCsv} from "@/lib/administration/ticket-import"

export const dynamic="force-dynamic"
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}})
export async function POST(request:Request){
 if(!sameOrigin(request))return fail("forbidden",403)
 const access=await administrationAccess()
 if(!access.ok)return fail("access_denied",access.status)
 // Read a bounded stream before parsing multipart data; Content-Length is untrusted.
 const reader=request.body?.getReader()
 if(!reader)return fail("invalid_file",400)
 const chunks:Uint8Array[]=[];let length=0
 try{
  while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>2_100_000){await reader.cancel();return fail("file_too_large",413)}chunks.push(part.value)}
 }catch{return fail("invalid_file",400)}
 const bytes=new Uint8Array(length);let offset=0
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 let form:FormData
 try{form=await new Response(bytes,{headers:{"Content-Type":request.headers.get("content-type")??""}}).formData()}catch{return fail("invalid_file",400)}
 const file=form.get("file"),eventId=String(form.get("eventId")??""),source=String(form.get("source")??"").trim()
 if(!(file instanceof File)||!file.name.toLowerCase().endsWith(".csv")||file.size===0)return fail("invalid_file",422)
 if(file.size>2_000_000)return fail("file_too_large",413)
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(eventId)||!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(source))return fail("invalid_target",422)
 const csv=await file.text()
 const validation=validateTicketSalesCsv(csv,eventId)
 if(validation.errors.length)return NextResponse.json({error:"invalid_rows",errors:validation.errors.slice(0,20)},{status:422})
 const sha=createHash("sha256").update(csv).digest("hex")
 const {data,error}=await (access.db as unknown as SupabaseClient).rpc("upt_import_ticket_sales",{
  p_event:eventId,p_source:source,p_sha256:sha,p_rows:validation.rows,
 })
 if(error){
  const code=error.code==="42501"?403:error.code==="23505"?409:422
  return fail(code===409?"conflicting_sale":"import_rejected",code)
 }
 return NextResponse.json({result:data},{headers:{"Cache-Control":"private, no-store"}})
}
