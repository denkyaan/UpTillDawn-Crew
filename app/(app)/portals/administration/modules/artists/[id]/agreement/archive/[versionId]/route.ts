import {notFound,redirect} from "next/navigation"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {canOpenPortal,type PortalAssignment} from "@/lib/portal-access"
import {downloadContractArchive} from "@/lib/administration/contract-archive-server"
import {isContractArchivePath} from "@/lib/administration/contract-archive"

export const dynamic="force-dynamic"

/** Read an approved DJ contract from the private archive; no public object URL. */
export async function GET(request:Request,{params}:{params:Promise<{id:string;versionId:string}>}){
 const {id,versionId}=await params
 const valid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
 if(!valid(id)||!valid(versionId))notFound()
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 if((!user.approved||user.account_blocked)&&!user.isOwner)redirect("/portals")
 const db=await createClient()
 if(!user.isAdmin&&!user.isOwner){
  const {data,error}=await db.rpc("upt_my_portal_assignments")
  if(error||!canOpenPortal("administration",(data??[]) as PortalAssignment[],{approved:user.approved,blocked:Boolean(user.account_blocked)}))redirect("/portals")
 }
 const {data:version,error}=await db.from("admin_artist_agreement_versions")
  .select("id,version_number,approved_at").eq("id",versionId).eq("booking_id",id).maybeSingle()
 if(error||!version?.approved_at)notFound()
 const path=new URL(request.url).searchParams.get("path")
 if(!path||!isContractArchivePath(path))notFound()
 const prefix="artist/"+versionId+"/v"+version.version_number+"/"
 if(!path.startsWith(prefix)||!path.endsWith(".pdf"))notFound()
 try{
  const bytes=await downloadContractArchive(path,db)
  return new Response(new Blob([bytes],{type:"application/pdf"}),{headers:{
   "Content-Type":"application/pdf",
   "Content-Disposition":'attachment; filename="agreement-'+version.version_number+'.pdf"',
   "Cache-Control":"private, no-store",
   "X-Content-Type-Options":"nosniff"
  }})
 }catch{return new Response("Contract archive unavailable",{status:404,headers:{"Cache-Control":"no-store"}})}
}
