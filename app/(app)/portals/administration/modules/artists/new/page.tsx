import Link from "next/link"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/crew-server"
import { canOpenPortal, type PortalAssignment } from "@/lib/portal-access"
import { requestUiLocale } from "@/lib/server-locale"

const path="/portals/administration/modules/artists"
async function authorizedDb(){
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
async function createBooking(form:FormData){
 "use server"
 const db=await authorizedDb()
 const artist_name=String(form.get("artist_name")??"").trim()
 const event_id=String(form.get("event_id")??"")
 const agency_contact_id=String(form.get("agency_contact_id")??"")
 const rider_notes=String(form.get("rider_notes")??"").trim()
 const internal_notes=String(form.get("internal_notes")??"").trim()
 const rawFee=String(form.get("fee_amount")??"").trim()
 const fee_amount=rawFee===""?null:Number(rawFee)
 const performance=String(form.get("performance_at")??"")
 const performanceDate=performance?new Date(performance):null
 if(!artist_name||artist_name.length>180||!/^[0-9a-f-]{36}$/i.test(event_id)||rider_notes.length>5000||internal_notes.length>5000||agency_contact_id&&!/^[0-9a-f-]{36}$/i.test(agency_contact_id)||fee_amount!==null&&(!Number.isFinite(fee_amount)||fee_amount<0||fee_amount>999999999)||performanceDate&&Number.isNaN(performanceDate.getTime()))throw new Error("Invalid booking details")
 const {data:event}=await db.from("events").select("id").eq("id",event_id).maybeSingle()
 if(!event)throw new Error("Event unavailable")
 if(agency_contact_id){
  const {data:agency}=await db.from("admin_counterparties").select("id").eq("id",agency_contact_id).maybeSingle()
  if(!agency)throw new Error("Agency unavailable")
 }
 const {error}=await db.from("admin_artist_bookings").insert({
  artist_name,event_id,agency_contact_id:agency_contact_id||null,
  fee_amount,performance_at:performanceDate?.toISOString()??null,
  rider_notes:rider_notes||null,internal_notes:internal_notes||null,
  status:"enquiry",currency:"EUR"
 })
 if(error)throw new Error("Booking could not be saved")
 revalidatePath(path)
 redirect(path)
}
export const dynamic="force-dynamic"
export default async function NewArtistBooking(){
 const db=await authorizedDb()
 const locale=await requestUiLocale()
 const l=({
  nl: {title:"DJ-boeking toevoegen",artist:"Artiest / DJ",event:"Evenement",agency:"Agentschap (optioneel)",none:"Geen agentschap",date:"Optreden (datum en uur)",fee:"Vergoeding (EUR)",rider:"Rider / afspraken",notes:"Interne notities",save:"Aanvraag registreren",back:"Terug naar boekingen",empty:"Maak eerst een evenement aan.",migration:"Boekingsregister niet beschikbaar. Controleer de databasemigratie."},
  fr: {title:"Ajouter une réservation DJ",artist:"Artiste / DJ",event:"Événement",agency:"Agence (facultatif)",none:"Aucune agence",date:"Prestation (date et heure)",fee:"Cachet (EUR)",rider:"Rider / accords",notes:"Notes internes",save:"Enregistrer la demande",back:"Retour aux réservations",empty:"Créez d’abord un événement.",migration:"Registre indisponible. Vérifiez la migration."},
  en: {title:"Add DJ booking",artist:"Artist / DJ",event:"Event",agency:"Agency (optional)",none:"No agency",date:"Performance (date and time)",fee:"Fee (EUR)",rider:"Rider / agreements",notes:"Internal notes",save:"Register enquiry",back:"Back to bookings",empty:"Create an event first.",migration:"Booking register unavailable. Check the database migration."},
  de: {title:"DJ-Buchung hinzufügen",artist:"Künstler / DJ",event:"Veranstaltung",agency:"Agentur (optional)",none:"Keine Agentur",date:"Auftritt (Datum und Uhrzeit)",fee:"Gage (EUR)",rider:"Rider / Vereinbarungen",notes:"Interne Notizen",save:"Anfrage erfassen",back:"Zurück zu Buchungen",empty:"Erstellen Sie zuerst eine Veranstaltung.",migration:"Buchungsregister nicht verfügbar. Prüfen Sie die Migration."}
 } as const)[locale]
 const [events,agencies,bookings]=await Promise.all([
  db.from("events").select("id,name").order("start_at",{ascending:false}).limit(100),
  db.from("admin_counterparties").select("id,name").in("kind",["supplier","both"]).order("name").limit(100),
  db.from("admin_artist_bookings").select("id").limit(1)
 ])
 return <main className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6">
  <Link href={path} className="text-sm font-semibold text-violet-400">← {l.back}</Link>
  <h1 className="text-2xl font-bold">{l.title}</h1>
  {bookings.error?<p role="alert" className="rounded-xl border p-4">{l.migration}</p>:events.error||!events.data?.length?<p className="rounded-xl border p-4">{l.empty}</p>:
  <form action={createBooking} className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2">
   <label className="text-sm font-semibold">{l.artist}<input required name="artist_name" maxLength={180} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm font-semibold">{l.event}<select required name="event_id" className="mt-1 w-full rounded-lg border bg-background p-3">{events.data.map(event=><option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
   <label className="text-sm font-semibold">{l.agency}<select name="agency_contact_id" className="mt-1 w-full rounded-lg border bg-background p-3"><option value="">{l.none}</option>{(agencies.data??[]).map(agency=><option key={agency.id} value={agency.id}>{agency.name}</option>)}</select></label>
   <label className="text-sm font-semibold">{l.date}<input type="datetime-local" name="performance_at" className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm font-semibold">{l.fee}<input type="number" name="fee_amount" min="0" max="999999999" step="0.01" className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm font-semibold sm:col-span-2">{l.rider}<textarea name="rider_notes" maxLength={5000} rows={3} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm font-semibold sm:col-span-2">{l.notes}<textarea name="internal_notes" maxLength={5000} rows={3} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <button className="rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white sm:col-span-2">{l.save}</button>
  </form>}
 </main>
}
