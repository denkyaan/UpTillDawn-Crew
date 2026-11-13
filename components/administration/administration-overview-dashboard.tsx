import Link from "next/link"
import { createClient } from "@/lib/supabase/crew-server"
import { getCurrentUser } from "@/lib/actions/auth"
import type { SupportedUiLocale } from "@/lib/locale-preferences"

const copy={
 nl:{title:"Administratief werkcentrum",intro:"Actuele dossiers, aankomende evenementen en openstaande acties. Iedere functie heeft één vaste beheerpagina.",hours:"Werkstaten voor controle",stock:"Inventarisafwijkingen",contracts:"Lopende DJ-contracten",finance:"Financiële opvolging",rosters:"Roosters ter goedkeuring",notices:"Ongelezen meldingen",events:"Aankomende evenementen",recentHours:"Werkstaten die behandeling vragen",stockIssues:"Ontbrekend of beschadigd materiaal",contractCases:"Contracten en DJ-opvolging",financialCases:"Financiële dossiers",nextEvents:"Evenementenplanning",noHours:"Geen ingediende werkstaten.",noStock:"Geen afwijkingen geregistreerd.",noContracts:"Geen openstaande contractdossiers.",noFinance:"Geen financiële dossiers in opvolging.",noEvents:"Geen aankomende evenementen.",error:"De gegevens zijn tijdelijk niet beschikbaar.",submitted:"Ingediend",missing:"Ontbrekend",damaged:"Beschadigd",event:"Evenement",staff:"Medewerker",open:"Openen",manageHours:"Werkstaten beheren",manageStock:"Inventaris beheren",manageFinance:"Facturen beheren",manageEvents:"Evenementen beheren",manageContracts:"Contracten beheren",createContract:"Nieuw contract",createEvent:"Nieuw evenement"},
 fr:{title:"Centre de travail administratif",intro:"Dossiers en cours, événements à venir et actions prioritaires. Chaque fonction possède une page de gestion dédiée.",hours:"Heures à vérifier",stock:"Écarts de stock",contracts:"Contrats DJ en cours",finance:"Suivi financier",rosters:"Plannings à valider",notices:"Notifications non lues",events:"Événements à venir",recentHours:"Feuilles à traiter",stockIssues:"Matériel manquant ou endommagé",contractCases:"Contrats et suivi DJ",financialCases:"Dossiers financiers",nextEvents:"Calendrier des événements",noHours:"Aucune feuille soumise.",noStock:"Aucun écart signalé.",noContracts:"Aucun contrat en cours.",noFinance:"Aucun dossier financier à suivre.",noEvents:"Aucun événement à venir.",error:"Données temporairement indisponibles.",submitted:"Soumis",missing:"Manquant",damaged:"Endommagé",event:"Événement",staff:"Membre",open:"Ouvrir",manageHours:"Gérer les heures",manageStock:"Gérer l'inventaire",manageFinance:"Gérer les factures",manageEvents:"Gérer les événements",manageContracts:"Gérer les contrats",createContract:"Nouveau contrat",createEvent:"Nouvel événement"},
 en:{title:"Administration work center",intro:"Active cases, upcoming events and priority actions. Each function has one dedicated management page.",hours:"Timesheets for review",stock:"Inventory discrepancies",contracts:"Open DJ contracts",finance:"Financial follow-up",rosters:"Rosters awaiting approval",notices:"Unread notifications",events:"Upcoming events",recentHours:"Submitted timesheets",stockIssues:"Missing or damaged inventory",contractCases:"Contracts and DJ follow-ups",financialCases:"Financial cases",nextEvents:"Event schedule",noHours:"No timesheets pending review.",noStock:"No inventory issues recorded.",noContracts:"No open contract cases.",noFinance:"No financial cases pending.",noEvents:"No upcoming events.",error:"Data is temporarily unavailable.",submitted:"Submitted",missing:"Missing",damaged:"Damaged",event:"Event",staff:"Staff member",open:"Open",manageHours:"Manage timesheets",manageStock:"Manage inventory",manageFinance:"Manage invoices",manageEvents:"Manage events",manageContracts:"Manage contracts",createContract:"New contract",createEvent:"New event"},
 de:{title:"Verwaltungsarbeitsplatz",intro:"Aktive Vorgänge, kommende Veranstaltungen und vorrangige Aufgaben. Jede Funktion hat eine feste Verwaltungsseite.",hours:"Stunden zur Prüfung",stock:"Inventarabweichungen",contracts:"Offene DJ-Verträge",finance:"Finanzielle Nachverfolgung",rosters:"Dienstpläne zur Freigabe",notices:"Ungelesene Meldungen",events:"Kommende Veranstaltungen",recentHours:"Eingereichte Stundenzettel",stockIssues:"Fehlende oder beschädigte Artikel",contractCases:"Verträge und DJ-Nachverfolgung",financialCases:"Finanzvorgänge",nextEvents:"Veranstaltungsplanung",noHours:"Keine eingereichten Stundenzettel.",noStock:"Keine Bestandsabweichungen.",noContracts:"Keine offenen Vertragsakten.",noFinance:"Keine offenen Finanzvorgänge.",noEvents:"Keine kommenden Veranstaltungen.",error:"Daten derzeit nicht verfügbar.",submitted:"Eingereicht",missing:"Fehlend",damaged:"Beschädigt",event:"Veranstaltung",staff:"Mitarbeiter",open:"Öffnen",manageHours:"Stunden verwalten",manageStock:"Inventar verwalten",manageFinance:"Rechnungen verwalten",manageEvents:"Veranstaltungen verwalten",manageContracts:"Verträge verwalten",createContract:"Neuer Vertrag",createEvent:"Neue Veranstaltung"},
} as const

/** Operational work pulse, not a duplicate directory of modules. Individual
 * pending records link to their owning workflow; no function is reimplemented
 * here. Each query is RLS-scoped to the signed-in user's Administration rights. */
export async function AdministrationOverviewDashboard({locale}:{locale:SupportedUiLocale}){
 const db=await createClient()
 const current=await getCurrentUser()
 const now=new Date().toISOString()
 const [hours,inventory,contracts,financial,rosters,notifications,events]=await Promise.all([
  db.from("timesheets").select("id,event_id,user_id,submitted_at",{count:"exact"}).eq("status","submitted").order("submitted_at",{ascending:false}).limit(5),
  db.from("inventory_items").select("id,name,missing_quantity,damaged_quantity",{count:"exact"}).or("missing_quantity.gt.0,damaged_quantity.gt.0").order("name").limit(5),
  db.from("admin_artist_bookings").select("id,artist_name,status,follow_up_at",{count:"exact"}).in("status",["enquiry","negotiating"]).order("created_at",{ascending:false}).limit(5),
  db.from("admin_financial_documents").select("id,kind,status,document_number,gross_amount,currency",{count:"exact"}).in("status",["review","issued","approved"]).order("created_at",{ascending:false}).limit(5),
  db.from("admin_roster_proposals").select("id,status",{count:"exact"}).eq("status","submitted").limit(1),
  db.from("crew_notifications").select("id",{count:"exact",head:true}).eq("user_id",current?.id??"00000000-0000-0000-0000-000000000000").is("read_at",null),
  db.from("events").select("id,name,start_at,status",{count:"exact"}).neq("status","archived").gte("end_at",now).order("start_at").limit(5)
 ])
 const labels=!hours.error&&hours.data?.length
  ?await db.rpc("upt_administration_timesheet_labels",{p_timesheet_ids:hours.data.map(row=>row.id)})
  :null
 const staffNames=new Map((labels?.data??[]).map(row=>[row.user_id,row.crew_name]))
 const eventNames=new Map((labels?.data??[]).map(row=>[row.event_id,row.event_name]))
 const t=copy[locale]
 const dateLocale=({nl:"nl-BE",fr:"fr-BE",en:"en-GB",de:"de-DE"} as const)[locale]
 const formatDate=(date:string)=>new Intl.DateTimeFormat(dateLocale,{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Brussels"}).format(new Date(date))

 const language={
  nl:{attention:"Wat vraagt aandacht?",empty:"Geen openstaande acties.",upcoming:"Aankomende evenementen",noUpcoming:"Geen aankomende evenementen.",unavailable:"Niet alle gegevens konden worden opgehaald. Controleer de betrokken module.",open:"Openen"},
  fr:{attention:"À traiter en priorité",empty:"Aucune action en attente.",upcoming:"Événements à venir",noUpcoming:"Aucun événement à venir.",unavailable:"Certaines données ne sont pas disponibles. Vérifiez le module concerné.",open:"Ouvrir"},
  en:{attention:"Needs attention",empty:"No pending actions.",upcoming:"Upcoming events",noUpcoming:"No upcoming events.",unavailable:"Some data could not be loaded. Check the relevant module.",open:"Open"},
  de:{attention:"Jetzt zu bearbeiten",empty:"Keine offenen Aufgaben.",upcoming:"Anstehende Veranstaltungen",noUpcoming:"Keine anstehenden Veranstaltungen.",unavailable:"Einige Daten sind nicht verfügbar. Prüfen Sie den jeweiligen Bereich.",open:"Öffnen"}
 }[locale]
 // Each priority is represented once. An item is shown only if it needs
 // attention or its status cannot be determined; zero-count placeholders
 // never consume the entire mobile overview. Full editing stays in subtabs.
 const priorityItems=[
  {id:"timesheets",label:t.hours,count:hours.count,error:hours.error,href:"/portals/administration/timesheets",
   detail:(hours.data??[]).slice(0,2).map(row=>(staffNames.get(row.user_id)||t.staff)+" · "+(eventNames.get(row.event_id)||t.event)).join("; ")},
  {id:"rosters",label:t.rosters,count:rosters.count,error:rosters.error,href:"/portals/administration/rosters",detail:""},
  {id:"inventory",label:t.stock,count:inventory.count,error:inventory.error,href:"/portals/administration/modules/inventory",
   detail:(inventory.data??[]).slice(0,2).map(item=>item.name+" ("+t.missing+": "+(item.missing_quantity??0)+", "+t.damaged+": "+(item.damaged_quantity??0)+")").join("; ")},
  {id:"contracts",label:t.contracts,count:contracts.count,error:contracts.error,href:"/portals/administration/modules/contracts",
   detail:(contracts.data??[]).slice(0,2).map(item=>item.artist_name+" · "+item.status).join("; ")},
  {id:"finance",label:t.finance,count:financial.count,error:financial.error,href:"/portals/administration/modules/invoices",
   detail:(financial.data??[]).slice(0,2).map(item=>(item.document_number||item.kind)+" · "+item.status).join("; ")},
  {id:"notifications",label:t.notices,count:notifications.count,error:notifications.error,href:"/portals/administration/modules/notifications",detail:""},
 ].filter(item=>Boolean(item.error)||(item.count??0)>0)
 const hasDataError=Boolean(events.error||hours.error||inventory.error||contracts.error||financial.error||rosters.error||notifications.error||labels?.error)
 const upcomingEvents=events.error?[]:(events.data??[]).slice(0,3)
 return <main className="mx-auto w-full max-w-5xl space-y-5 p-4 pb-28 sm:p-6">
  <header className="space-y-2">
   <h1 className="text-2xl font-bold sm:text-3xl">{t.title}</h1>
   <p className="text-sm text-muted-foreground">{t.intro}</p>
  </header>
  {hasDataError&&<p role="alert" className="rounded-xl border border-amber-600/40 p-3 text-sm">{language.unavailable}</p>}
  <section aria-label={language.attention} className="rounded-2xl border bg-card p-4 sm:p-5">
   <h2 className="mb-3 text-lg font-bold">{language.attention}</h2>
   {priorityItems.length?<ul className="divide-y">
    {priorityItems.map(item=><li key={item.id}>
     <Link href={item.href} data-administration-priority={item.id} className="flex min-h-16 items-center gap-3 rounded-lg px-2 py-3 hover:bg-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500">
      <span className="min-w-0 flex-1">
       <span className="block text-sm font-semibold">{item.label}</span>
       {item.detail&&<span className="mt-1 block break-words text-xs text-muted-foreground">{item.detail}</span>}
      </span>
      <span className="rounded-lg border px-3 py-1 text-sm font-bold tabular-nums">{item.error?"—":item.count}</span>
      <span className="shrink-0 text-xs font-semibold text-violet-400">{language.open}</span>
     </Link>
    </li>)}
   </ul>:<p className="text-sm text-muted-foreground">{language.empty}</p>}
  </section>
  <section aria-label={language.upcoming} className="rounded-2xl border bg-card p-4 sm:p-5">
   <div className="mb-3 flex items-center justify-between gap-3">
    <h2 className="text-lg font-bold">{language.upcoming}</h2>
    <Link href="/portals/administration/modules/events" className="shrink-0 text-sm font-semibold text-violet-400">{language.open}</Link>
   </div>
   {upcomingEvents.length?<ul className="divide-y">
    {upcomingEvents.map(event=><li key={event.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
     <span className="font-semibold">{event.name}</span>
     <span className="text-muted-foreground">{formatDate(event.start_at)} · {event.status}</span>
    </li>)}
   </ul>:<p className="text-sm text-muted-foreground">{events.error?t.error:language.noUpcoming}</p>}
  </section>
 </main>
}
