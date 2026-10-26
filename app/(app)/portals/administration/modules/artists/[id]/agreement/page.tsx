import Link from "next/link"
import { revalidatePath } from "next/cache"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/crew-server"
import { canOpenPortal, type PortalAssignment } from "@/lib/portal-access"
import { requestUiLocale } from "@/lib/server-locale"

export const dynamic="force-dynamic"
async function saveTerms(form:FormData){
 "use server"
 const id=String(form.get("id")??"")
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound()
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 if((!user.approved||user.account_blocked)&&!user.isOwner)redirect("/portals")
 const db=await createClient()
 if(!user.isAdmin&&!user.isOwner){
  const {data,error}=await db.rpc("upt_my_portal_assignments")
  if(error||!canOpenPortal("administration",(data??[]) as PortalAssignment[],{approved:user.approved,blocked:Boolean(user.account_blocked)}))redirect("/portals")
 }
 const fields=["agreement_payment_terms","agreement_cancellation_terms","agreement_liability_terms","agreement_governing_law"] as const
 const values=Object.fromEntries(fields.map(field=>[field,String(form.get(field)??"").trim()||null]))
 if(Object.values(values).some(value=>value!==null&&value.length>3000))throw new Error("Agreement condition is too long")
 const {data,error}=await db.from("admin_artist_bookings").update({...values,updated_at:new Date().toISOString()}).eq("id",id).in("status",["enquiry","negotiating"]).select("id").maybeSingle()
 if(error||!data)throw new Error("Agreement terms cannot be changed for this booking")
 revalidatePath(base+"/"+id+"/agreement")
 redirect(base+"/"+id+"/agreement")
}
async function snapshotAgreement(form:FormData){
 "use server"
 const id=String(form.get("id")??"")
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound()
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 if((!user.approved||user.account_blocked)&&!user.isOwner)redirect("/portals")
 const db=await createClient()
 if(!user.isAdmin&&!user.isOwner){
  const {data,error}=await db.rpc("upt_my_portal_assignments")
  if(error||!canOpenPortal("administration",(data??[]) as PortalAssignment[],{approved:user.approved,blocked:Boolean(user.account_blocked)}))redirect("/portals")
 }
 const {data:booking,error}=await db.from("admin_artist_bookings").select("id,artist_name,status,event_id,agency_contact_id,performance_at,fee_amount,currency,rider_notes,agreement_payment_terms,agreement_cancellation_terms,agreement_liability_terms,agreement_governing_law").eq("id",id).single()
 if(error||!booking||booking.status==="cancelled")throw new Error("Agreement unavailable")
 if(!booking.agency_contact_id||!booking.performance_at||booking.fee_amount===null||!booking.agreement_payment_terms||!booking.agreement_cancellation_terms||!booking.agreement_liability_terms||!booking.agreement_governing_law)throw new Error("Complete agreement terms first")
 const {data:agency}=await db.from("admin_counterparties").select("name,email").eq("id",booking.agency_contact_id).maybeSingle()
 const {data:event}=await db.from("events").select("name,start_at").eq("id",booking.event_id).maybeSingle()
 if(!agency?.name||!agency.email||!event?.name)throw new Error("Agency and event required")
 const snapshot={...booking,agency_name:agency.name,agency_email:agency.email,event_name:event.name,event_start_at:event.start_at}
 const {data:latest}=await db.from("admin_artist_agreement_versions").select("version_number").eq("booking_id",id).order("version_number",{ascending:false}).limit(1).maybeSingle()
 const {error:insertError}=await db.from("admin_artist_agreement_versions").insert({booking_id:id,version_number:(latest?.version_number??0)+1,snapshot})
 if(insertError)throw new Error("Agreement version could not be saved; retry if another user created a version")
 revalidatePath(base+"/"+id+"/agreement")
 redirect(base+"/"+id+"/agreement")
}
async function approveAgreement(form:FormData){
 "use server"
 const id=String(form.get("id")??"")
 const versionId=String(form.get("version_id")??"")
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
 if(!uuid.test(id)||!uuid.test(versionId))notFound()
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 if((!user.approved||user.account_blocked)&&!user.isOwner)redirect("/portals")
 const db=await createClient()
 if(!user.isAdmin&&!user.isOwner){
  const {data,error}=await db.rpc("upt_my_portal_assignments")
  if(error||!canOpenPortal("administration",(data??[]) as PortalAssignment[],{approved:user.approved,blocked:Boolean(user.account_blocked)}))redirect("/portals")
 }
 const {data:version,error:readError}=await db.from("admin_artist_agreement_versions").select("id,created_by,approved_at").eq("id",versionId).eq("booking_id",id).maybeSingle()
 if(readError||!version||version.approved_at||version.created_by===user.id)throw new Error("Approval requires a different authorized user")
 const {data,error}=await db.from("admin_artist_agreement_versions").update({approved_by:user.id,approved_at:new Date().toISOString()}).eq("id",versionId).eq("booking_id",id).is("approved_at",null).select("id").maybeSingle()
 if(error||!data)throw new Error("Agreement approval was not saved")
 revalidatePath(base+"/"+id+"/agreement")
 redirect(base+"/"+id+"/agreement")
}
async function prepareSignature(form:FormData){
 "use server"
 const id=String(form.get("id")??"")
 const versionId=String(form.get("version_id")??"")
 const email=String(form.get("recipient_email")??"").trim().toLowerCase()
 if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f-]{36}$/i.test(versionId))notFound()
 if(email.length>320||!email.includes("@"))throw new Error("Invalid recipient email")
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 if((!user.approved||user.account_blocked)&&!user.isOwner)redirect("/portals")
 const db=await createClient()
 if(!user.isAdmin&&!user.isOwner){
  const {data,error}=await db.rpc("upt_my_portal_assignments")
  if(error||!canOpenPortal("administration",(data??[]) as PortalAssignment[],{approved:user.approved,blocked:Boolean(user.account_blocked)}))redirect("/portals")
 }
 const {data:version}=await db.from("admin_artist_agreement_versions").select("approved_at").eq("id",versionId).eq("booking_id",id).maybeSingle()
 if(!version?.approved_at)throw new Error("Approval required")
 const {data:booking}=await db.from("admin_artist_bookings").select("agency_contact_id,status").eq("id",id).maybeSingle()
 if(!booking?.agency_contact_id||booking.status==="cancelled")throw new Error("Booking unavailable")
 const {data:agency}=await db.from("admin_counterparties").select("email").eq("id",booking.agency_contact_id).maybeSingle()
 if(agency?.email?.trim().toLowerCase()!==email)throw new Error("Agency email mismatch")
 const {error}=await db.from("admin_artist_agreement_signature_requests").insert({agreement_version_id:versionId,recipient_email:email})
 if(error)throw new Error("Unable to prepare signature")
 revalidatePath(base+"/"+id+"/agreement")
 redirect(base+"/"+id+"/agreement")
}
const base="/portals/administration/modules/artists"
export default async function AgreementDraft({params}:{params:Promise<{id:string}>}){
 const {id}=await params
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound()
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 if((!user.approved||user.account_blocked)&&!user.isOwner)redirect("/portals")
 const db=await createClient()
 if(!user.isAdmin&&!user.isOwner){
  const {data,error}=await db.rpc("upt_my_portal_assignments")
  if(error||!canOpenPortal("administration",(data??[]) as PortalAssignment[],{approved:user.approved,blocked:Boolean(user.account_blocked)}))redirect("/portals")
 }
 const {data:booking,error}=await db.from("admin_artist_bookings").select("id,artist_name,status,event_id,agency_contact_id,performance_at,fee_amount,currency,rider_notes,agreement_payment_terms,agreement_cancellation_terms,agreement_liability_terms,agreement_governing_law").eq("id",id).single()
 if(error||!booking)notFound()
 const [eventResult,agencyResult]=await Promise.all([
  db.from("events").select("name,start_at").eq("id",booking.event_id).maybeSingle(),
  booking.agency_contact_id?db.from("admin_counterparties").select("name,email").eq("id",booking.agency_contact_id).maybeSingle():Promise.resolve({data:null})
 ])
 const {data:versions}=await db.from("admin_artist_agreement_versions").select("id,version_number,created_at,created_by,approved_at,snapshot").eq("booking_id",id).order("version_number",{ascending:false}).limit(20)
 const {data:signatureRequests}=await db.from("admin_artist_agreement_signature_requests").select("id,agreement_version_id,recipient_email,created_at,status").in("agreement_version_id",(versions??[]).map(version=>version.id).length?(versions??[]).map(version=>version.id):["00000000-0000-0000-0000-000000000000"]).order("created_at",{ascending:false}).limit(30)
 const locale=await requestUiLocale()
 const copy=({
  nl:{back:"Terug naar boeking",title:"Concept boekingsafspraak",warning:"Dit is een intern concept, geen ondertekend contract. Controleer alle voorwaarden en laat beide partijen expliciet akkoord gaan.",artist:"Artiest",agency:"Agentschap",event:"Evenement",performance:"Optreden",fee:"Afgesproken vergoeding",rider:"Rider en afspraken",missing:"Nog niet ingevuld",status:"Boekingsstatus",terms:"Aan te vullen vóór ondertekening",conditions:"Betalingsvoorwaarden, annulering, technische verplichtingen, aansprakelijkheid, toepasselijk recht en handtekeningen zijn nog niet vastgelegd.",noSend:"Dit concept wordt niet automatisch verzonden of ondertekend."},
  fr:{back:"Retour à la réservation",title:"Projet d’accord de réservation",warning:"Document interne non signé. Vérifiez les conditions et obtenez l’accord explicite des deux parties.",artist:"Artiste",agency:"Agence",event:"Événement",performance:"Prestation",fee:"Cachet convenu",rider:"Rider et accords",missing:"Non renseigné",status:"Statut",terms:"À compléter avant signature",conditions:"Les modalités de paiement, l’annulation, les obligations techniques, la responsabilité, le droit applicable et les signatures restent à définir.",noSend:"Ce projet n’est ni envoyé ni signé automatiquement."},
  en:{back:"Back to booking",title:"Booking agreement draft",warning:"Internal draft only, not a signed contract. Review all terms and obtain explicit agreement from both parties.",artist:"Artist",agency:"Agency",event:"Event",performance:"Performance",fee:"Agreed fee",rider:"Rider and agreements",missing:"Not provided",status:"Booking status",terms:"Complete before signing",conditions:"Payment terms, cancellation, technical obligations, liability, governing law and signatures have not been agreed here.",noSend:"This draft is not automatically sent or signed."},
  de:{back:"Zurück zur Buchung",title:"Entwurf der Buchungsvereinbarung",warning:"Nur interner Entwurf, kein unterzeichneter Vertrag. Alle Bedingungen prüfen und die ausdrückliche Zustimmung beider Parteien einholen.",artist:"Künstler",agency:"Agentur",event:"Veranstaltung",performance:"Auftritt",fee:"Vereinbarte Gage",rider:"Rider und Vereinbarungen",missing:"Nicht angegeben",status:"Buchungsstatus",terms:"Vor Unterzeichnung ergänzen",conditions:"Zahlungsbedingungen, Stornierung, technische Pflichten, Haftung, anwendbares Recht und Unterschriften sind noch festzulegen.",noSend:"Dieser Entwurf wird weder automatisch versendet noch unterzeichnet."}
 } as const)[locale]
 const missingFields=[
  !agencyResult.data?.name&&copy.agency,
  !agencyResult.data?.email&&"Email",
  !eventResult.data?.name&&copy.event,
  !booking.performance_at&&copy.performance,
  booking.fee_amount===null&&copy.fee,
  !booking.rider_notes&&copy.rider,
  !booking.agreement_payment_terms&&({nl:"Betalingsvoorwaarden",fr:"Conditions de paiement",en:"Payment terms",de:"Zahlungsbedingungen"} as const)[locale],
  !booking.agreement_cancellation_terms&&({nl:"Annuleringsvoorwaarden",fr:"Conditions d’annulation",en:"Cancellation terms",de:"Stornierungsbedingungen"} as const)[locale],
  !booking.agreement_liability_terms&&({nl:"Aansprakelijkheid",fr:"Responsabilité",en:"Liability",de:"Haftung"} as const)[locale],
  !booking.agreement_governing_law&&({nl:"Toepasselijk recht",fr:"Droit applicable",en:"Governing law",de:"Anwendbares Recht"} as const)[locale]
 ].filter(Boolean).map(String)
 const date=booking.performance_at?new Intl.DateTimeFormat(({nl:"nl-BE",fr:"fr-BE",en:"en-GB",de:"de-DE"} as const)[locale],{dateStyle:"full",timeStyle:"short",timeZone:"Europe/Brussels"}).format(new Date(booking.performance_at)):copy.missing
 return <main className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6">
  <Link href={`${base}/${booking.id}`} className="text-sm font-semibold text-violet-400">← {copy.back}</Link>
  <h1 className="text-2xl font-bold">{copy.title}</h1>
  <p role="status" className="rounded-xl border p-4 text-sm">{copy.warning}</p>
  <dl className="grid gap-3 rounded-2xl border bg-card p-5 text-sm">
   {([[copy.artist,booking.artist_name],[copy.agency,agencyResult.data?.name??copy.missing],["Email",agencyResult.data?.email??copy.missing],[copy.event,eventResult.data?.name??copy.missing],[copy.performance,date],[copy.fee,booking.fee_amount!=null?new Intl.NumberFormat(({nl:"nl-BE",fr:"fr-BE",en:"en-GB",de:"de-DE"} as const)[locale],{style:"currency",currency:booking.currency}).format(booking.fee_amount):copy.missing],[copy.status,booking.status],[copy.rider,booking.rider_notes||copy.missing],
   [({nl:"Betalingsvoorwaarden",fr:"Conditions de paiement",en:"Payment terms",de:"Zahlungsbedingungen"} as const)[locale],booking.agreement_payment_terms||copy.missing],
   [({nl:"Annuleringsvoorwaarden",fr:"Conditions d’annulation",en:"Cancellation terms",de:"Stornierungsbedingungen"} as const)[locale],booking.agreement_cancellation_terms||copy.missing],
   [({nl:"Aansprakelijkheid",fr:"Responsabilité",en:"Liability",de:"Haftung"} as const)[locale],booking.agreement_liability_terms||copy.missing],
   [({nl:"Toepasselijk recht",fr:"Droit applicable",en:"Governing law",de:"Anwendbares Recht"} as const)[locale],booking.agreement_governing_law||copy.missing]] as [string,string][]).map(([label,value])=><div key={label} className="border-b pb-2"><dt className="font-semibold">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{value}</dd></div>)}
  </dl>
  {missingFields.length>0&&<section role="status" className="rounded-2xl border p-5">
   <h2 className="font-semibold">{copy.terms}</h2>
   <ul className="mt-2 list-inside list-disc text-sm">{[...new Set(missingFields)].map(field=><li key={field}>{field}</li>)}</ul>
  </section>}
  <section className="rounded-2xl border p-5"><h2 className="font-semibold">{copy.terms}</h2><p className="mt-2 text-sm">{copy.conditions}</p></section>
  <section className="space-y-3 rounded-2xl border p-5">
   <h2 className="font-semibold">{({nl:"Contractcontrole",fr:"Vérification du contrat",en:"Contract review",de:"Vertragsprüfung"} as const)[locale]}</h2>
   <p className="text-sm text-muted-foreground">{({nl:"Leg vóór verzending schriftelijk vast: betaaltermijn, annuleringsregeling, technische rider, aansprakelijkheid en toepasselijk recht. Laat beide partijen de definitieve versie goedkeuren.",fr:"Avant tout envoi, précisez par écrit les délais de paiement, l’annulation, le rider technique, la responsabilité et le droit applicable. Faites approuver la version finale par les deux parties.",en:"Before sending, document payment terms, cancellation, technical rider, liability and governing law in writing. Obtain both parties’ approval of the final version.",de:"Vor dem Versand Zahlungsfristen, Stornierung, technischen Rider, Haftung und anwendbares Recht schriftlich festhalten. Die endgültige Fassung von beiden Parteien genehmigen lassen."} as const)[locale]}</p>
   <Link href={`${base}/${booking.id}`} className="inline-flex rounded-xl border px-4 py-3 text-sm font-semibold">{copy.back}</Link>
  </section>
  <form action={saveTerms} className="grid gap-3 rounded-2xl border p-5">
   <input type="hidden" name="id" value={booking.id}/>
   <h2 className="font-semibold">{copy.terms}</h2>
   {([
    ["agreement_payment_terms",{nl:"Betalingsvoorwaarden",fr:"Conditions de paiement",en:"Payment terms",de:"Zahlungsbedingungen"}[locale],booking.agreement_payment_terms],
    ["agreement_cancellation_terms",{nl:"Annuleringsvoorwaarden",fr:"Conditions d’annulation",en:"Cancellation terms",de:"Stornierungsbedingungen"}[locale],booking.agreement_cancellation_terms],
    ["agreement_liability_terms",{nl:"Aansprakelijkheid",fr:"Responsabilité",en:"Liability",de:"Haftung"}[locale],booking.agreement_liability_terms],
    ["agreement_governing_law",{nl:"Toepasselijk recht",fr:"Droit applicable",en:"Governing law",de:"Anwendbares Recht"}[locale],booking.agreement_governing_law]
   ] as [string,string,string|null][]).map(([name,label,value])=><label key={name} className="text-sm font-semibold">{label}<textarea name={name} maxLength={3000} rows={3} defaultValue={value??""} disabled={booking.status==="confirmed"||booking.status==="cancelled"} className="mt-1 w-full rounded-lg border bg-background p-3 font-normal"/></label>)}
   {booking.status!=="confirmed"&&booking.status!=="cancelled"&&<button className="rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white">{({nl:"Voorwaarden opslaan",fr:"Enregistrer les conditions",en:"Save conditions",de:"Bedingungen speichern"} as const)[locale]}</button>}
  </form>
  <section className="space-y-3 rounded-2xl border p-5">
   <h2 className="font-semibold">{({nl:"Contractversies",fr:"Versions du contrat",en:"Agreement versions",de:"Vertragsversionen"} as const)[locale]}</h2>
   {missingFields.length===0&&booking.status!=="cancelled"&&<form action={snapshotAgreement}><input type="hidden" name="id" value={booking.id}/><button className="rounded-xl border px-4 py-3 text-sm font-semibold">{({nl:"Nieuwe conceptversie vastleggen",fr:"Enregistrer une version du projet",en:"Save new draft version",de:"Neue Entwurfsversion speichern"} as const)[locale]}</button></form>}
   <ol className="space-y-2 text-sm">{(versions??[]).map(version=><li key={version.id} className="rounded-lg border p-3"><strong>{version.version_number}</strong> · {new Intl.DateTimeFormat(({nl:"nl-BE",fr:"fr-BE",en:"en-GB",de:"de-DE"} as const)[locale],{dateStyle:"medium",timeStyle:"short"}).format(new Date(version.created_at))}{version.approved_at?<span className="ml-2">{({nl:"Intern goedgekeurd",fr:"Approuvé en interne",en:"Internally approved",de:"Intern genehmigt"} as const)[locale]}</span>:version.created_by!==user.id?<form action={approveAgreement} className="mt-2"><input type="hidden" name="id" value={booking.id}/><input type="hidden" name="version_id" value={version.id}/><button className="rounded-lg border px-3 py-2 font-semibold">{({nl:"Intern goedkeuren",fr:"Approuver en interne",en:"Approve internally",de:"Intern genehmigen"} as const)[locale]}</button></form>:<span className="ml-2">{({nl:"Wacht op tweede goedkeurder",fr:"En attente d'un autre approbateur",en:"Awaiting another approver",de:"Wartet auf zweite Freigabe"} as const)[locale]}</span>}<details className="mt-2"><summary className="cursor-pointer">{({nl:"Opgeslagen inhoud bekijken",fr:"Voir le contenu enregistré",en:"View saved content",de:"Gespeicherten Inhalt ansehen"} as const)[locale]}</summary><pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(version.snapshot,null,2)}</pre></details></li>)}</ol>
  </section>
  <section className="space-y-3 rounded-2xl border p-5">
   <h2 className="font-semibold">{({nl:"Ondertekening voorbereiden",fr:"Préparer la signature",en:"Prepare signing",de:"Unterschrift vorbereiten"} as const)[locale]}</h2>
   <p className="text-sm">{({nl:"Enkel intern goedgekeurde versies. Dit registreert een voorbereiding en verstuurt nog geen uitnodiging.",fr:"Versions approuvées uniquement. Cette étape prépare une demande sans envoyer d’invitation.",en:"Approved versions only. This records a preparation and does not send an invitation.",de:"Nur genehmigte Versionen. Dies erfasst eine Vorbereitung und versendet keine Einladung."} as const)[locale]}</p>
   {(versions??[]).filter(version=>Boolean(version.approved_at)).map(version=><form key={version.id} action={prepareSignature} className="flex flex-wrap items-end gap-2 rounded-lg border p-3"><input type="hidden" name="id" value={booking.id}/><input type="hidden" name="version_id" value={version.id}/><label className="flex-1 text-sm">{({nl:"Ontvanger",fr:"Destinataire",en:"Recipient",de:"Empfänger"} as const)[locale]} · {version.version_number}<input type="email" name="recipient_email" required maxLength={320} defaultValue={agencyResult.data?.email??""} className="mt-1 w-full rounded-lg border bg-background p-2"/></label><button className="rounded-lg border px-3 py-2 text-sm font-semibold">{({nl:"Voorbereiden",fr:"Préparer",en:"Prepare",de:"Vorbereiten"} as const)[locale]}</button></form>)}
   <ul className="space-y-1 text-sm">{(signatureRequests??[]).map(request=><li key={request.id} className="rounded-lg border p-2">{request.recipient_email} · {new Date(request.created_at).toLocaleDateString()} · {({nl:"Voorbereid",fr:"Préparé",en:"Prepared",de:"Vorbereitet"} as const)[locale]}</li>)}</ul>
  </section>
  <p className="text-sm text-muted-foreground">{copy.noSend}</p>
 </main>
}
