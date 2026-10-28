import {z} from "zod"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {canOpenPortal,type PortalAssignment} from "@/lib/portal-access"
export const runtime="nodejs"
const schema=z.object({
 bookingId:z.string().uuid(),
 expectedNotes:z.string().max(5000).nullable(),
 notes:z.string().trim().max(5000),
 confirmed:z.literal(true)
}).strict()
export async function GET(request:Request){
 const user=await getCurrentUser()
 if(!user)return Response.json({error:"Unauthorized"},{status:401})
 if((!user.approved||user.account_blocked)&&!user.isOwner)return Response.json({error:"Forbidden"},{status:403})
 const bookingId=new URL(request.url).searchParams.get("bookingId")
 if(bookingId&&!z.string().uuid().safeParse(bookingId).success)return Response.json({error:"Invalid booking"},{status:400})
 const db=await createClient()
 if(!user.isAdmin&&!user.isOwner){
  const {data,error}=await db.rpc("upt_my_portal_assignments")
  if(error||!canOpenPortal("administration",(data??[]) as PortalAssignment[],{approved:user.approved,blocked:Boolean(user.account_blocked)}))return Response.json({error:"Forbidden"},{status:403})
 }
 if(!bookingId){
  const {data,error}=await db.from("admin_artist_bookings").select("id,artist_name,status").neq("status","cancelled").order("artist_name",{ascending:true}).limit(100)
  if(error)return Response.json({error:"Read failed"},{status:500})
  return Response.json({bookings:data??[],limited:true})
 }
 const {data,error}=await db.from("admin_artist_bookings").select("id,artist_name,status,internal_notes").eq("id",bookingId).maybeSingle()
 if(error)return Response.json({error:"Read failed"},{status:500})
 if(!data)return Response.json({error:"Not found"},{status:404})
 return Response.json({booking:data})
}
export async function POST(request:Request){
 const origin=request.headers.get("origin")
 if(request.headers.get("sec-fetch-site")==="cross-site"||(origin&&origin!==new URL(request.url).origin))return Response.json({error:"Forbidden"},{status:403})
 const user=await getCurrentUser()
 if(!user)return Response.json({error:"Unauthorized"},{status:401})
 if((!user.approved||user.account_blocked)&&!user.isOwner)return Response.json({error:"Forbidden"},{status:403})
 const db=await createClient()
 if(!user.isAdmin&&!user.isOwner){
  const {data,error}=await db.rpc("upt_my_portal_assignments")
  if(error||!canOpenPortal("administration",(data??[]) as PortalAssignment[],{approved:user.approved,blocked:Boolean(user.account_blocked)}))return Response.json({error:"Forbidden"},{status:403})
 }
 const parsed=schema.safeParse(await request.json().catch(()=>null))
 if(!parsed.success)return Response.json({error:"Invalid request"},{status:400})
 const {bookingId,expectedNotes,notes}=parsed.data
 const {data:booking,error:readError}=await db.from("admin_artist_bookings").select("id,status,internal_notes").eq("id",bookingId).maybeSingle()
 if(readError)return Response.json({error:"Read failed"},{status:500})
 if(!booking)return Response.json({error:"Not found"},{status:404})
 if(booking.status==="cancelled")return Response.json({error:"Cancelled booking is locked"},{status:409})
 if(booking.internal_notes!==expectedNotes)return Response.json({error:"Notes changed; refresh before saving"},{status:409})
 // Never let AI-assisted edits overwrite communication audit entries embedded in notes.
 const auditLine=/^\[\d{4}-\d{2}-\d{2}T.*\] \[(email_sent|reply_received|follow_up)\] \[[0-9a-f-]{36}\] /
 const preserved=(booking.internal_notes??"").split("\n").filter(line=>auditLine.test(line))
 const newNotes=[notes,...preserved].filter(Boolean).join("\n")
 if(newNotes.length>5000)return Response.json({error:"Notes too long"},{status:400})
 const query=db.from("admin_artist_bookings").update({internal_notes:newNotes||null,updated_at:new Date().toISOString()}).eq("id",bookingId).eq("status",booking.status)
 const {data:updated,error:writeError}=await (expectedNotes===null?query.is("internal_notes",null):query.eq("internal_notes",expectedNotes)).select("id").maybeSingle()
 if(writeError)return Response.json({error:"Write failed"},{status:500})
 if(!updated)return Response.json({error:"Notes changed; refresh before saving"},{status:409})
 return Response.json({saved:true,bookingId})
}
