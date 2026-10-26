import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/crew-server"
import { canOpenPortal, type PortalAssignment } from "@/lib/portal-access"
import { requestUiLocale } from "@/lib/server-locale"

export const dynamic="force-dynamic"
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
 const {data:booking,error}=await db.from("admin_artist_bookings").select("id,artist_name,status,event_id,agency_contact_id,performance_at,fee_amount,currency,rider_notes").eq("id",id).single()
 if(error||!booking)notFound()
 const [eventResult,agencyResult]=await Promise.all([
  db.from("events").select("name,start_at").eq("id",booking.event_id).maybeSingle(),
  booking.agency_contact_id?db.from("admin_counterparties").select("name,email").eq("id",booking.agency_contact_id).maybeSingle():Promise.resolve({data:null})
 ])
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
  !booking.rider_notes&&copy.rider
 ].filter(Boolean).map(String)
 const date=booking.performance_at?new Intl.DateTimeFormat(({nl:"nl-BE",fr:"fr-BE",en:"en-GB",de:"de-DE"} as const)[locale],{dateStyle:"full",timeStyle:"short",timeZone:"Europe/Brussels"}).format(new Date(booking.performance_at)):copy.missing
 return <main className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6">
  <Link href={`${base}/${booking.id}`} className="text-sm font-semibold text-violet-400">← {copy.back}</Link>
  <h1 className="text-2xl font-bold">{copy.title}</h1>
  <p role="status" className="rounded-xl border p-4 text-sm">{copy.warning}</p>
  <dl className="grid gap-3 rounded-2xl border bg-card p-5 text-sm">
   {([[copy.artist,booking.artist_name],[copy.agency,agencyResult.data?.name??copy.missing],["Email",agencyResult.data?.email??copy.missing],[copy.event,eventResult.data?.name??copy.missing],[copy.performance,date],[copy.fee,booking.fee_amount!=null?new Intl.NumberFormat(({nl:"nl-BE",fr:"fr-BE",en:"en-GB",de:"de-DE"} as const)[locale],{style:"currency",currency:booking.currency}).format(booking.fee_amount):copy.missing],[copy.status,booking.status],[copy.rider,booking.rider_notes||copy.missing]] as [string,string][]).map(([label,value])=><div key={label} className="border-b pb-2"><dt className="font-semibold">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{value}</dd></div>)}
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
  <p className="text-sm text-muted-foreground">{copy.noSend}</p>
 </main>
}
