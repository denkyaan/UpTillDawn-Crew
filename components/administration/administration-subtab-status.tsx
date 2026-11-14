import Link from "next/link"
import {ChevronRight} from "lucide-react"
import type {SupabaseClient} from "@supabase/supabase-js"
import {createClient} from "@/lib/supabase/crew-server"
import {getCurrentUser} from "@/lib/actions/auth"
import {administrationNavigationGroups,administrationRoute} from "@/lib/administration/navigation"
import {administrationModules} from "@/lib/administration/modules"
import {validateTicketSalesSummary,ticketSalesTotals,formatTicketEuro} from "@/lib/administration/ticket-sales-summary"
import type {SupportedUiLocale} from "@/lib/locale-preferences"

// These seven workflow indicators and the upcoming-event schedule already exist
// at the top of the dashboard. Never repeat the same subtab in another card.
const shownAbove=new Set(["dashboard","events","timesheets","rosters","contracts","finance","inventory","notifications","automations"])

const copy={
 nl:{headline:"Actuele status van alle overige subtabs",intro:"Gegevens uit de bestaande beheerfuncties, opgehaald bij het openen van dit overzicht. Één link per onderdeel; geen dubbele beheerpagina's.",empty:"Geen gegevens geregistreerd",unavailable:"Niet beschikbaar",notTracked:"Geen afzonderlijke statusmeting beschikbaar",total:"geregistreerd",active:"in opvolging",approved:"goedgekeurd voor loonexport",invoices:"facturen in opvolging",payments:"betalingen geregistreerd",ticketSales:"tickets geregistreerd",timesheets:"werkstaten geregistreerd",sales:"verkooptransacties geregistreerd",obligations:"openstaande dossiers",documents:"documenten geregistreerd",personnel:"medewerkers beschikbaar",chats:"toegankelijke chats",relations:"klanten en leveranciers",references:"promotiereferenties",promotionTasks:"promotietaken",reviews:"documenten voor menselijke controle",evidence:"bewijzen ter controle",assignments:"administratieve roltoewijzingen",profile:"Profiel beschikbaar",profileMissing:"Profiel nog niet voltooid",lastPayment:"Laatste betaling",open:"Open onderdeel",readOnly:"Alleen de onderliggende functie kan de volledige status bevestigen.",personnelLabel:"Personeelslijst",chatLabel:"Chats",counterpartiesLabel:"Klanten en leveranciers",promotionTasksLabel:"Promotietaken",restrictionLabel:"Promotieblokkeringen",profileLabel:"Mijn profiel",salesLabel:"Verkoop"},
 fr:{headline:"État actuel des autres sous-onglets",intro:"Données des fonctions existantes, actualisées à l'ouverture. Un seul lien par fonction, aucune page dupliquée.",empty:"Aucune donnée enregistrée",unavailable:"Indisponible",notTracked:"Aucune mesure distincte disponible",total:"enregistré(s)",active:"à suivre",approved:"validées pour la paie",invoices:"factures à suivre",payments:"paiements enregistrés",ticketSales:"billets enregistrés",timesheets:"feuilles enregistrées",sales:"transactions enregistrées",obligations:"dossiers en attente",documents:"documents enregistrés",personnel:"membres accessibles",chats:"discussions accessibles",relations:"clients et fournisseurs",references:"références promotionnelles",promotionTasks:"tâches promotionnelles",reviews:"documents à vérifier manuellement",evidence:"preuves à vérifier",assignments:"attributions administratives",profile:"Profil disponible",profileMissing:"Profil à compléter",lastPayment:"Dernier paiement",open:"Ouvrir la section",readOnly:"Seule la fonction concernée peut confirmer l'état complet.",personnelLabel:"Liste du personnel",chatLabel:"Discussions",counterpartiesLabel:"Clients et fournisseurs",promotionTasksLabel:"Tâches promotionnelles",restrictionLabel:"Blocages promotion",profileLabel:"Mon profil",salesLabel:"Ventes"},
 en:{headline:"Current status of the remaining subtabs",intro:"Live data from the existing workspaces, refreshed when you open this overview. One link per area; no duplicate management pages.",empty:"No records yet",unavailable:"Unavailable",notTracked:"No separate status metric available",total:"registered",active:"to follow up",approved:"approved for payroll",invoices:"invoices to follow up",payments:"recorded payments",ticketSales:"recorded tickets",timesheets:"recorded timesheets",sales:"recorded sales transactions",obligations:"outstanding cases",documents:"recorded documents",personnel:"available staff",chats:"accessible chats",relations:"customers and suppliers",references:"promotion references",promotionTasks:"promotion tasks",reviews:"documents for human review",evidence:"evidence awaiting review",assignments:"administration role assignments",profile:"Profile available",profileMissing:"Profile incomplete",lastPayment:"Latest payment",open:"Open section",readOnly:"Only the owning workflow can confirm its complete status.",personnelLabel:"Staff directory",chatLabel:"Chats",counterpartiesLabel:"Customers and suppliers",promotionTasksLabel:"Promotion tasks",restrictionLabel:"Promotion restrictions",profileLabel:"My profile",salesLabel:"Sales"},
 de:{headline:"Aktueller Status der übrigen Unterregister",intro:"Daten aus bestehenden Bereichen, beim Öffnen aktualisiert. Ein Link pro Bereich, keine doppelten Verwaltungsseiten.",empty:"Noch keine Einträge",unavailable:"Nicht verfügbar",notTracked:"Kein eigener Statuswert verfügbar",total:"erfasst",active:"in Bearbeitung",approved:"für Lohnabrechnung genehmigt",invoices:"Rechnungen in Bearbeitung",payments:"erfasste Zahlungen",ticketSales:"erfasste Tickets",timesheets:"erfasste Stundenzettel",sales:"erfasste Verkaufsvorgänge",obligations:"offene Vorgänge",documents:"erfasste Dokumente",personnel:"verfügbare Mitarbeitende",chats:"zugängliche Chats",relations:"Kunden und Lieferanten",references:"Werbereferenzen",promotionTasks:"Werbeaufgaben",reviews:"Dokumente zur manuellen Prüfung",evidence:"Belege zur Prüfung",assignments:"Verwaltungsrollenzuweisungen",profile:"Profil verfügbar",profileMissing:"Profil unvollständig",lastPayment:"Letzte Zahlung",open:"Bereich öffnen",readOnly:"Nur der jeweilige Bereich kann seinen vollständigen Status bestätigen.",personnelLabel:"Personalverzeichnis",chatLabel:"Chats",counterpartiesLabel:"Kunden und Lieferanten",promotionTasksLabel:"Werbeaufgaben",restrictionLabel:"Promotion-Sperren",profileLabel:"Mein Profil",salesLabel:"Verkauf"}
} as const

type Metric={value:string;detail:string;error?:boolean}
type CountResult={count:number|null;error:unknown}
function measured(result:CountResult,description:string,unavailable:string):Metric{
 if(result.error||result.count===null)return {value:"—",detail:unavailable,error:true}
 return {value:String(result.count),detail:description}
}
function dated(value:string|undefined|null,locale:SupportedUiLocale):string{
 if(!value)return ""
 const d=new Date(value)
 if(!Number.isFinite(d.getTime()))return ""
 return new Intl.DateTimeFormat(locale==="nl"?"nl-BE":locale==="fr"?"fr-BE":locale==="de"?"de-DE":"en-GB",{dateStyle:"short",timeZone:"Europe/Brussels"}).format(d)
}

// Cap concurrent server-side PostgREST requests: a 20-query burst on the
// Administration overview can exhaust a Cloudflare Worker isolate under load.
// Each request keeps its RLS credentials and abort deadline. The existing
// 10s hard stop still returns explicit unavailable status instead of zero.
async function boundedQueries<const T extends readonly unknown[]>(queries:T,limit:number):Promise<{[K in keyof T]:Awaited<T[K]>}>{
 const result:unknown[]=new Array(queries.length)
 let cursor=0
 await Promise.all(Array.from({length:Math.min(limit,queries.length)},async()=>{
  while(cursor<queries.length){
   const i=cursor++
   result[i]=await queries[i]
  }
 }))
 return result as {[K in keyof T]:Awaited<T[K]>}
}

/** Every extra indicator reads the same RLS-protected source as its owner subtab.
 * No service is treated as connected just because a settings page exists. */
export async function AdministrationSubtabStatus({locale}:{locale:SupportedUiLocale}){
 const db=await createClient()
 const raw=db as unknown as SupabaseClient
 const user=await getCurrentUser()
 const admin=Boolean(user?.realIsAdmin||user?.isOwner)
 const t=copy[locale]
 const statusSignal=AbortSignal.timeout(8_000)
 // Unlike an AbortSignal alone, a hard stop also covers an adapter that never
 // settles after abort. Any unknown metrics remain explicitly unavailable.
 const hardStopSignal=AbortSignal.timeout(10_000)
 const timedOut=new Promise<null>(resolve=>{
  if(hardStopSignal.aborted){resolve(null);return}
  hardStopSignal.addEventListener("abort",()=>resolve(null),{once:true})
 })
 const statuses=await Promise.race([
  boundedQueries([
  db.from("admin_artist_bookings").select("id",{count:"exact",head:true}).abortSignal(statusSignal),
  db.from("tasks").select("id",{count:"exact",head:true}).abortSignal(statusSignal),
  db.from("timesheets").select("id",{count:"exact",head:true}).in("status",["approved","locked"]).abortSignal(statusSignal),
  db.from("admin_financial_documents").select("id",{count:"exact",head:true}).in("kind",["sales_invoice","purchase_invoice"]).in("status",["review","approved","issued"]).abortSignal(statusSignal),
  db.from("admin_financial_payments").select("id,paid_on",{count:"exact"}).order("paid_on",{ascending:false}).limit(1).abortSignal(statusSignal),
  raw.rpc("upt_ticket_sales_summary").abortSignal(statusSignal),
  db.from("timesheets").select("id",{count:"exact",head:true}).abortSignal(statusSignal),
  db.from("sales_transactions").select("id",{count:"exact",head:true}).abortSignal(statusSignal),
  raw.from("admin_operational_obligations").select("id",{count:"exact",head:true}).eq("kind","logistics").in("status",["open","submitted","rejected"]).abortSignal(statusSignal),
  db.from("event_documents").select("id",{count:"exact",head:true}).abortSignal(statusSignal),
  raw.from("admin_operational_obligations").select("id",{count:"exact",head:true}).eq("kind","permits").in("status",["open","submitted","rejected"]).abortSignal(statusSignal),
  db.rpc("upt_crew_directory").abortSignal(statusSignal),
  db.from("chat_channels").select("id",{count:"exact",head:true}).abortSignal(statusSignal),
  db.from("admin_counterparties").select("id",{count:"exact",head:true}).abortSignal(statusSignal),
  raw.from("promotion_reference_media").select("id",{count:"exact",head:true}).abortSignal(statusSignal),
  db.from("tasks").select("id",{count:"exact",head:true}).eq("promotion_only",true).abortSignal(statusSignal),
  admin?raw.from("promotion_evidence").select("id",{count:"exact",head:true}).in("verification_status",["pending","inconclusive"]).abortSignal(statusSignal):Promise.resolve({count:null,error:null}),
  db.from("portal_role_assignments").select("id",{count:"exact",head:true}).eq("portal","administration").abortSignal(statusSignal),
  db.rpc("upt_own_profile_details").abortSignal(statusSignal),
  db.from("admin_financial_documents").select("id",{count:"exact",head:true}).eq("status","review").abortSignal(statusSignal)
  ],4).catch(()=>null),
  timedOut
 ])
 if(!statuses)return <section aria-label={t.headline} role="status" data-administration-status-unavailable="true" className="rounded-2xl border border-amber-600/40 p-4 text-sm text-muted-foreground">
  <h2 className="font-bold">{t.headline}</h2><p className="mt-1">{t.unavailable}</p>
 </section>
 const [
  artists,tasks,payroll,invoices,payments,ticketing,reports,sales,
  logistics,documents,permits,personnel,chats,counterparties,
  references,promotionTasks,evidence,assignments,profile,aiReview
 ]=statuses
 const metrics:Record<string,Metric>={
  artists:measured(artists,t.total,t.unavailable),
  tasks:measured(tasks,t.total,t.unavailable),
  staff:measured(payroll,t.approved,t.unavailable),
  invoices:measured(invoices,t.invoices,t.unavailable),
  banking:measured(payments,t.payments+(payments.data?.[0]?.paid_on?" · "+t.lastPayment+": "+dated(payments.data[0].paid_on,locale):""),t.unavailable),
  reports:measured(reports,t.timesheets,t.unavailable),
  sales:measured(sales,t.sales,t.unavailable),
  logistics:measured(logistics,t.obligations,t.unavailable),
  documents:measured(documents,t.documents,t.unavailable),
  permits:measured(permits,t.obligations,t.unavailable),
  personnel:personnel.error||!Array.isArray(personnel.data)?{value:"—",detail:t.unavailable,error:true}:{value:String(personnel.data.length),detail:t.personnel},
  chat:measured(chats,t.chats,t.unavailable),
  counterparties:measured(counterparties,t.relations,t.unavailable),
  sponsors:{value:"—",detail:t.notTracked},
  marketing:measured(references,t.references,t.unavailable),
  "promotion-tasks":measured(promotionTasks,t.promotionTasks,t.unavailable),
  "promotion-discipline":admin?measured(evidence,t.evidence,t.unavailable):{value:"—",detail:t.notTracked},
  settings:measured(assignments,t.assignments,t.unavailable),
  profile:profile.error||!Array.isArray(profile.data)?{value:"—",detail:t.unavailable,error:true}:{value:profile.data.length?"✓":"—",detail:profile.data.length?t.profile:t.profileMissing},
  ai:measured(aiReview,t.reviews,t.unavailable),
 }
 if(ticketing.error||!validateTicketSalesSummary(ticketing.data)){
  metrics.ticketing={value:"—",detail:t.unavailable,error:true}
 }else{
  const total=ticketSalesTotals(ticketing.data)
  metrics.ticketing={value:total.quantity.toString(),detail:t.ticketSales+" · "+formatTicketEuro(total.grossCents,locale)}
 }
 const names:Record<string,string>={
  personnel:t.personnelLabel,chat:t.chatLabel,counterparties:t.counterpartiesLabel,
  "promotion-tasks":t.promotionTasksLabel,"promotion-discipline":t.restrictionLabel,
  profile:t.profileLabel,sales:t.salesLabel,
 }
 const groups=administrationNavigationGroups.filter(group=>group.key!=="overview").map(group=>({
  key:group.key,title:group.title[locale],
  slugs:group.slugs.filter(slug=>!shownAbove.has(slug)&&(slug!=="promotion-discipline"||admin))
 }))
 return <section aria-label={t.headline} className="space-y-3">
  <div className="space-y-1">
   <h2 className="text-lg font-bold">{t.headline}</h2>
   <p className="text-xs leading-5 text-muted-foreground">{t.intro}</p>
  </div>
  <div className="grid gap-3 lg:grid-cols-2">
   {groups.filter(group=>group.slugs.length>0).map(group=><section key={group.key} className="min-w-0 overflow-hidden rounded-2xl border bg-card">
    <h3 className="border-b px-4 py-3 text-sm font-bold">{group.title}</h3>
    <ul className="divide-y">
     {group.slugs.map(slug=>{
      const metric=metrics[slug]??{value:"—",detail:t.notTracked}
      const title=names[slug]??administrationModules.find(item=>item.slug===slug)?.title[locale]??slug
      return <li key={slug}>
       <Link href={administrationRoute(slug)} data-administration-subtab-status={slug} className="flex min-h-16 items-center gap-2 px-4 py-3 hover:bg-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500">
        <span className="min-w-0 flex-1">
         <span className="block text-sm font-semibold">{title}</span>
         <span className="mt-1 block break-words text-xs text-muted-foreground">{metric.detail}</span>
        </span>
        <span role="status" className={"rounded-lg border px-2 py-1 text-sm font-semibold tabular-nums "+(metric.error?"text-amber-500":"")}>{metric.value}</span>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-violet-400"/>
        <span className="sr-only">{t.open}</span>
       </Link>
      </li>
     })}
    </ul>
   </section>)}
  </div>
 </section>
}
