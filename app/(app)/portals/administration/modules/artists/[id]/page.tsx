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
async function recordCommunication(form:FormData){
 "use server"
 const db=await access()
 const id=String(form.get("id")??"")
 const kind=String(form.get("kind")??"")
 const details=String(form.get("details")??"").trim()
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||!["email_sent","reply_received","follow_up"].includes(kind)||details.length<3||details.length>1500)throw new Error("Invalid communication record")
 const {data:booking,error}=await db.from("admin_artist_bookings").select("id").eq("id",id).single()
 if(error||!booking)notFound()
 const {error:insertError}=await db.from("admin_artist_booking_communications").insert({booking_id:id,kind,details})
 if(insertError)throw new Error("Communication record could not be saved")
 // Recording an actual follow-up closes its outstanding reminder. Other contact
 // types must not silently clear a scheduled follow-up.
 if(kind==="follow_up"){
  const {error:clearError}=await db.from("admin_artist_bookings").update({follow_up_at:null,updated_at:new Date().toISOString()}).eq("id",id).in("status",["enquiry","negotiating"])
  if(clearError)throw new Error("Follow-up was recorded, but its reminder could not be cleared")
 }
 revalidatePath(base)
 revalidatePath(`${base}/${id}`)
 redirect(`${base}/${id}`)
}
async function updateBooking(form:FormData){
 "use server"
 const db=await access()
 const id=String(form.get("id")??"")
 const status=String(form.get("status")??"")
 const rider_notes=String(form.get("rider_notes")??"").trim()
 const internal_notes=String(form.get("internal_notes")??"").trim()
 const followUpInput=String(form.get("follow_up_at")??"").trim()
 const followUpDate=followUpInput?new Date(`${followUpInput}Z`):null
 if(followUpDate&&(!Number.isFinite(followUpDate.getTime())||followUpDate.getTime()<Date.now()-60000))throw new Error("Invalid follow-up date")
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||!["enquiry","negotiating","confirmed","cancelled"].includes(status)||rider_notes.length>5000||internal_notes.length>5000)throw new Error("Invalid booking update")
 const {data:booking,error:readError}=await db.from("admin_artist_bookings").select("id,status,internal_notes,agency_contact_id,performance_at,fee_amount").eq("id",id).single()
 if(readError||!booking)notFound()
 const transitions:Record<string,string[]>={enquiry:["enquiry","negotiating","cancelled"],negotiating:["negotiating","confirmed","cancelled"],confirmed:["confirmed","cancelled"],cancelled:["cancelled"]}
 if(!transitions[booking.status]?.includes(status))throw new Error("Invalid booking status transition")
 if(status==="confirmed"&&booking.status!=="confirmed"){
  if(!booking.agency_contact_id||!booking.performance_at||booking.fee_amount===null)throw new Error("Complete the agency, performance date and agreed fee before confirming")
  const {data:agency,error:agencyError}=await db.from("admin_counterparties").select("id,email").eq("id",booking.agency_contact_id).maybeSingle()
  if(agencyError||!agency?.email||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(agency.email))throw new Error("A valid agency email is required before confirmation")
 }

 const history=(booking.internal_notes??"").split("\n").filter(line=>/^\[\d{4}-\d{2}-\d{2}T.*\] \[(email_sent|reply_received|follow_up)\] \[[0-9a-f-]{36}\] /.test(line))
 const notes=[internal_notes,...history].filter(Boolean).join("\n")
 const updateQuery=db.from("admin_artist_bookings").update({status,rider_notes:rider_notes||null,internal_notes:notes||null,follow_up_at:["confirmed","cancelled"].includes(status)?null:followUpDate?.toISOString()??null,updated_at:new Date().toISOString()}).eq("id",id).eq("status",booking.status)
 const {error}=await (booking.internal_notes===null?updateQuery.is("internal_notes",null):updateQuery.eq("internal_notes",booking.internal_notes)).select("id").single()
 if(error)throw new Error("Booking update failed")
 revalidatePath(base)
 redirect(base)
}
export const dynamic="force-dynamic"
export default async function BookingDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound()
 const db=await access()
 const {data:booking,error}=await db.from("admin_artist_bookings").select("id,artist_name,status,rider_notes,internal_notes,event_id,agency_contact_id,performance_at,fee_amount,currency,follow_up_at").eq("id",id).single()
 if(error||!booking)notFound()
 const [eventResult,agencyResult]=await Promise.all([db.from("events").select("name,start_at").eq("id",booking.event_id).maybeSingle(),booking.agency_contact_id?db.from("admin_counterparties").select("name,email").eq("id",booking.agency_contact_id).maybeSingle():Promise.resolve({data:null})])
 const event=eventResult.data
 const agency=agencyResult.data
 const {data:communications,error:communicationError}=await db.from("admin_artist_booking_communications").select("id,kind,details,actor_id,created_at").eq("booking_id",id).order("created_at",{ascending:false}).limit(100)
 if(communicationError)throw new Error("Communication history could not be loaded")
 const locale=await requestUiLocale()
 const labels=({
 nl:{followUp:"Opvolging gepland op (UTC)",history:"Communicatie registreren",kind:"Type contact",details:"Beschrijving of samenvatting",sent:"E-mail verzonden",reply:"Antwoord ontvangen",followup:"Opvolging",record:"Registratie bewaren",communication:"Communicatie met artiest / agentschap",recipient:"Ontvanger",contacts:"Contacten",noEmail:"Geen e-mailadres bij het agentschap. Voeg dit toe bij Contacten.",draft:"E-mailconcept openen",review:"Controleer de gegevens en verstuur de e-mail zelf vanuit je mailapp. Er wordt niets automatisch verzonden.",back:"Terug naar boekingen",status:"Boekingsstatus",rider:"Rider en afspraken",notes:"Interne notities",save:"Wijzigingen opslaan",enquiry:"Aanvraag",negotiating:"Onderhandeling",confirmed:"Bevestigd",cancelled:"Geannuleerd"},
 fr:{followUp:"Suivi prévu le (UTC)",history:"Enregistrer la communication",kind:"Type de contact",details:"Description ou résumé",sent:"E-mail envoyé",reply:"Réponse reçue",followup:"Suivi",record:"Enregistrer",communication:"Communication avec l’artiste / l’agence",recipient:"Destinataire",contacts:"Contacts",noEmail:"Aucune adresse e-mail pour cette agence. Ajoutez-la dans Contacts.",draft:"Ouvrir le brouillon",review:"Vérifiez les informations et envoyez le message depuis votre messagerie. Aucun envoi automatique.",back:"Retour aux réservations",status:"Statut de réservation",rider:"Rider et accords",notes:"Notes internes",save:"Enregistrer les modifications",enquiry:"Demande",negotiating:"Négociation",confirmed:"Confirmé",cancelled:"Annulé"},
 en:{followUp:"Follow-up scheduled for (UTC)",history:"Record communication",kind:"Contact type",details:"Description or summary",sent:"Email sent",reply:"Reply received",followup:"Follow-up",record:"Save record",communication:"Artist / agency communication",recipient:"Recipient",contacts:"Contacts",noEmail:"No email address for this agency. Add one in Contacts.",draft:"Open email draft",review:"Review the details and send the email yourself from your mail app. Nothing is sent automatically.",back:"Back to bookings",status:"Booking status",rider:"Rider and agreements",notes:"Internal notes",save:"Save changes",enquiry:"Enquiry",negotiating:"Negotiating",confirmed:"Confirmed",cancelled:"Cancelled"},
 de:{followUp:"Nachverfolgung geplant am (UTC)",history:"Kommunikation erfassen",kind:"Kontaktart",details:"Beschreibung oder Zusammenfassung",sent:"E-Mail gesendet",reply:"Antwort erhalten",followup:"Nachverfolgung",record:"Eintrag speichern",communication:"Kommunikation mit Künstler / Agentur",recipient:"Empfänger",contacts:"Kontakte",noEmail:"Keine E-Mail-Adresse für diese Agentur. Ergänzen Sie diese unter Kontakte.",draft:"E-Mail-Entwurf öffnen",review:"Prüfen Sie die Angaben und senden Sie die E-Mail selbst. Es wird nichts automatisch versendet.",back:"Zurück zu Buchungen",status:"Buchungsstatus",rider:"Rider und Vereinbarungen",notes:"Interne Notizen",save:"Änderungen speichern",enquiry:"Anfrage",negotiating:"Verhandlung",confirmed:"Bestätigt",cancelled:"Storniert"}
 } as const)[locale]
 const date=booking.performance_at?new Intl.DateTimeFormat(({nl:"nl-BE",fr:"fr-BE",en:"en-GB",de:"de-DE"} as const)[locale],{dateStyle:"full",timeStyle:"short",timeZone:"Europe/Brussels"}).format(new Date(booking.performance_at)):null
 const subject=`Up Till Dawn — ${booking.artist_name} — ${event?.name??""} — ${labels[booking.status as "enquiry"|"negotiating"|"confirmed"|"cancelled"]}`
 const body=[`${booking.artist_name} — ${event?.name??""}`,date??"",`${labels.status}: ${labels[booking.status as "enquiry"|"negotiating"|"confirmed"|"cancelled"]}`,booking.fee_amount!=null?`${booking.fee_amount} ${booking.currency}`:"",booking.rider_notes??""].filter(Boolean).join("\\n\\n")
 const mailto=agency?.email&&/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(agency.email)?`mailto:${encodeURIComponent(agency.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`:null
 const logEntries=(booking.internal_notes??"").split("\n").filter(line=>/^\[\d{4}-\d{2}-\d{2}T.*\] \[(email_sent|reply_received|follow_up)\] \[[0-9a-f-]{36}\] /.test(line))
 const editableNotes=(booking.internal_notes??"").split("\n").filter(line=>!logEntries.includes(line)).join("\n")
 const allowed:Record<string,("enquiry"|"negotiating"|"confirmed"|"cancelled")[]>={enquiry:["enquiry","negotiating","cancelled"],negotiating:["negotiating","confirmed","cancelled"],confirmed:["confirmed","cancelled"],cancelled:["cancelled"]}
 return <main className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6">
  <Link href={base} className="text-sm font-semibold text-violet-400">← {labels.back}</Link>
  <h1 className="text-2xl font-bold">{booking.artist_name}</h1>
  <section className="space-y-3 rounded-2xl border bg-card p-5">
   <h2 className="text-lg font-semibold">{labels.communication}</h2>
   <p className="text-sm">{labels.recipient}: {agency?.name??"—"} · {agency?.email??"—"}</p>
   {mailto?<a href={mailto} className="inline-flex rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white">{labels.draft}</a>:<p className="text-sm text-muted-foreground">{labels.noEmail} <Link href="/portals/administration/contacts" className="text-violet-400 underline">{labels.contacts}</Link></p>}
   <p className="text-xs text-muted-foreground">{labels.review}</p>
   <Link href={`/portals/administration/modules/ai?bookingId=${booking.id}`} className="inline-flex rounded-xl border px-4 py-3 text-sm font-semibold">{({nl:"Notities met AI-werkruimte bewerken",fr:"Modifier les notes dans l’espace IA",en:"Edit notes in AI workspace",de:"Notizen im KI-Arbeitsbereich bearbeiten"} as const)[locale]}</Link>
   <Link href={`${base}/${booking.id}/agreement`} className="inline-flex rounded-xl border px-4 py-3 text-sm font-semibold">{({nl:"Boekingsafspraak voorbereiden",fr:"Préparer l’accord de réservation",en:"Prepare booking agreement",de:"Buchungsvereinbarung vorbereiten"} as const)[locale]}</Link>
  </section>
  <form action={recordCommunication} className="grid gap-3 rounded-2xl border bg-card p-5">
   <h2 className="text-lg font-semibold">{labels.history}</h2>
   {(communications?.length||logEntries.length>0)&&<ol className="max-h-64 space-y-2 overflow-auto rounded-lg border p-3 text-xs">{(communications??[]).map(entry=><li key={entry.id} className="whitespace-pre-wrap break-words border-b pb-2">{new Date(entry.created_at).toLocaleString()} · {entry.kind} · {entry.actor_id}: {entry.details}</li>)}{logEntries.slice().reverse().map((entry,index)=><li key={index} className="whitespace-pre-wrap break-words border-b pb-2 last:border-0">{entry}</li>)}</ol>}
   <input type="hidden" name="id" value={booking.id}/>
   <label className="text-sm font-semibold">{labels.kind}<select name="kind" className="mt-1 w-full rounded-lg border bg-background p-3"><option value="email_sent">{labels.sent}</option><option value="reply_received">{labels.reply}</option><option value="follow_up">{labels.followup}</option></select></label>
   <label className="text-sm font-semibold">{labels.details}<textarea name="details" required minLength={3} maxLength={1500} rows={3} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <button className="rounded-xl border px-4 py-3 font-semibold">{labels.record}</button>
  </form>
  <form action={updateBooking} className="grid gap-4 rounded-2xl border bg-card p-5">
   <input type="hidden" name="id" value={booking.id}/>
   {booking.status!=="confirmed"&&booking.status!=="cancelled"&&<p className="rounded-lg border p-3 text-sm text-muted-foreground">{({nl:"Voor bevestiging zijn een agentschap met geldig e-mailadres, een optreedtijdstip en een overeengekomen vergoeding verplicht. Bevestiging verstuurt geen e-mail of contract automatisch.",fr:"La confirmation exige une agence avec une adresse e-mail valide, une date de prestation et un cachet convenu. Aucun e-mail ni contrat n’est envoyé automatiquement.",en:"Confirmation requires an agency with a valid email, a performance date and an agreed fee. No email or contract is sent automatically.",de:"Zur Bestätigung sind eine Agentur mit gültiger E-Mail-Adresse, ein Auftrittstermin und eine vereinbarte Gage erforderlich. E-Mails oder Verträge werden nicht automatisch versendet."} as const)[locale]}</p>}
   <label className="text-sm font-semibold">{labels.status}<select name="status" defaultValue={booking.status} className="mt-1 w-full rounded-lg border bg-background p-3">{(allowed[booking.status]??[booking.status as "enquiry"]).map(status=><option key={status} value={status}>{labels[status]}</option>)}</select></label>
   <label className="text-sm font-semibold">{labels.rider}<textarea name="rider_notes" maxLength={5000} rows={5} defaultValue={booking.rider_notes??""} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm font-semibold">{labels.followUp}<input type="datetime-local" name="follow_up_at" defaultValue={booking.follow_up_at?new Date(booking.follow_up_at).toISOString().slice(0,16):""} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <label className="text-sm font-semibold">{labels.notes}<textarea name="internal_notes" maxLength={5000} rows={5} defaultValue={editableNotes} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
   <button className="rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white">{labels.save}</button>
  </form>
 </main>
}
