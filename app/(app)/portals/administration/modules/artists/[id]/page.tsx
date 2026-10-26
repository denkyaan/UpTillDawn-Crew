import Link from "next/link"
import { revalidatePath } from "next/cache"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/crew-server"
import { canOpenPortal, type PortalAssignment } from "@/lib/portal-access"
import { requestUiLocale } from "@/lib/server-locale"

const base="/portals/administration/modules/artists"
async function access(){
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 if((!user.approved||user.account_blocked)&&!user.isOwner)redirect("/portals")
 const db=await createClient()
 if(!user.isAdmin&&!user.isOwner){
  const {data,error}=await db.rpc("upt_my_portal_assignments")
  if(error||!canOpenPortal("administration",(data??[]) as PortalAssignment[],{approved:user.approved,blocked:Boolean(user.account_blocked)}))redirect("/portals")
 }
 return db
}
async function updateBooking(form:FormData){
 "use server"
 const db=await access()
 const id=String(form.get("id")??"")
 const status=String(form.get("status")??"")
 const rider_notes=String(form.get("rider_notes")??"").trim()
 const internal_notes=String(form.get("internal_notes")??"").trim()
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||!["enquiry","negotiating","confirmed","cancelled"].includes(status)||rider_notes.length>5000||internal_notes.length>5000)throw new Error("Invalid booking update")
 const {data:booking,error:readError}=await db.from("admin_artist_bookings").select("id,status").eq("id",id).single()
 if(readError||!booking)notFound()
 const transitions:Record<string,string[]>={enquiry:["enquiry","negotiating","cancelled"],negotiating:["negotiating","confirmed","cancelled"],confirmed:["confirmed","cancelled"],cancelled:["cancelled"]}
 if(!transitions[booking.status]?.includes(status))throw new Error("Invalid booking status transition")
 const {error}=await db.from("admin_artist_bookings").update({status,rider_notes:rider_notes||null,internal_notes:internal_notes||null,updated_at:new Date().toISOString()}).eq("id",id).eq("status",booking.status).select("id").single()
 if(error)throw new Error("Booking update failed")
 revalidatePath(base)
 redirect(base)
}
export const dynamic="force-dynamic"
export default async function BookingDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound()
 const db=await access()
 const {data:booking,error}=await db.from("admin_artist_bookings").select("id,artist_name,status,rider_notes,internal_notes").eq("id",id).single()
 if(error||!booking)notFound()
 const locale=await requestUiLocale()
 const labels=({
 nl:{back:"Terug naar boekingen",status:"Boekingsstatus",rider:"Rider en afspraken",notes:"Interne notities",save:"Wijzigingen opslaan",enquiry:"Aanvraag",negotiating:"Onderhandeling",confirmed:"Bevestigd",cancelled:"Geannuleerd"},
 fr:{back:"Retour aux réservations",status:"Statut de réservation",rider:"Rider et accords",notes:"Notes internes",save:"Enregistrer les modifications",enquiry:"Demande",negotiating:"Négociation",confirmed:"Confirmé",cancelled:"Annulé"},
 en:{back:"Back to bookings",status:"Booking status",rider:"Rider and agreements",notes:"Internal notes",save:"Save changes",enquiry:"Enquiry",negotiating:"Negotiating",confirmed:"Confirmed",cancelled:"Cancelled"},
 de:{back:"Zurück zu Buchungen",status:"Buchungsstatus",rider:"Rider und Vereinbarungen",notes:"Interne Notizen",save:"Änderungen speichern",enquiry:"Anfrage",negotiating:"Verhandlung",confirmed:"Bestätigt",cancelled:"Storniert"}
 } as const)[locale]
 const allowed:Record<string,("enquiry"|"negotiating"|"confirmed"|"cancelled")[]>={enquiry:["enquiry","negotiating","cancelled"],negotiating:["negotiating","confirmed","cancelled"],confirmed:["confirmed","cancelled"],cancelled:["cancelled"]}
 return <main className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6">
  <Link href={base} className="text-sm font-semibold text-violet-400">← {labels.back}</Link>
  <h1 className="text-2xl font-bold">{booking.artist_name}</h1>
  <form action={updateBooking} className="grid gap-4 rounded-2xl border bg-card p-5">
   <input type="hidden" name="id" value={booking.id}/>
   <label className="text-sm font-semibold">{labels.status}<select name="status" defaultValue={booking.status} className="mt-1 w-full rounded-lg border bg-background p-3">{(allowed[booking.status]??[booking.status as "enquiry"]).map(status=><option key={status} value={status}>{labels[status]}</option>)}</select></label>
   <label className="text-sm font-semibold">{labels.rider}<textarea name="rider_notes" maxLength={5000} rows={5} defaultValue={booking.rider_notes??""} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm font-semibold">{labels.notes}<textarea name="internal_notes" maxLength={5000} rows={5} defaultValue={booking.internal_notes??""} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <button className="rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white">{labels.save}</button>
  </form>
 </main>
}
