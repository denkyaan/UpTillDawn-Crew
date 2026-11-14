import Link from "next/link"
import {Suspense} from "react"
import {AdministrationSubtabStatus} from "@/components/administration/administration-subtab-status"
import {ChevronRight} from "lucide-react"
import type {SupabaseClient} from "@supabase/supabase-js"
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
 // This pulse contains nine independent PostgREST requests. Without a shared
 // deadline, one stalled query keeps the entire SSR route on its skeleton.
 // PostgREST turns an aborted request into a non-null .error; the existing
 // hasDataError/priority rendering then shows "status unavailable", never 0.
 const overviewSignal=AbortSignal.timeout(12_000)
 const [hours,inventory,contracts,financial,rosters,notifications,events,draftDocuments,automationRuns]=await Promise.all([
  db.from("timesheets").select("id,event_id,user_id,submitted_at",{count:"exact"}).eq("status","submitted").order("submitted_at",{ascending:false}).limit(5).abortSignal(overviewSignal),
  db.from("inventory_items").select("id,name,missing_quantity,damaged_quantity",{count:"exact"}).or("missing_quantity.gt.0,damaged_quantity.gt.0").order("name").limit(5).abortSignal(overviewSignal),
  db.from("admin_artist_bookings").select("id,artist_name,status,follow_up_at",{count:"exact"}).in("status",["enquiry","negotiating"]).order("created_at",{ascending:false}).limit(5).abortSignal(overviewSignal),
  db.from("admin_financial_documents").select("id,kind,status,document_number,gross_amount,currency",{count:"exact"}).in("status",["review","issued","approved"]).order("created_at",{ascending:false}).limit(5).abortSignal(overviewSignal),
  db.from("admin_roster_proposals").select("id,status",{count:"exact"}).eq("status","submitted").limit(1).abortSignal(overviewSignal),
  db.from("crew_notifications").select("id",{count:"exact",head:true}).eq("user_id",current?.id??"00000000-0000-0000-0000-000000000000").is("read_at",null).abortSignal(overviewSignal),
  db.from("events").select("id,name,start_at,status",{count:"exact"}).neq("status","archived").gte("end_at",now).order("start_at").limit(5).abortSignal(overviewSignal),
  db.from("admin_financial_documents").select("id",{count:"exact",head:true}).eq("status","draft").abortSignal(overviewSignal),
  (db as unknown as SupabaseClient).from("admin_automation_runs").select("completed_at,error_code,delivered").order("completed_at",{ascending:false}).limit(1).abortSignal(overviewSignal)
 ])
 const labels=!hours.error&&hours.data?.length
  ?await db.rpc("upt_administration_timesheet_labels",{p_timesheet_ids:hours.data.map(row=>row.id)}).abortSignal(overviewSignal)
  :null
 const staffNames=new Map((labels?.data??[]).map(row=>[row.user_id,row.crew_name]))
 const eventNames=new Map((labels?.data??[]).map(row=>[row.event_id,row.event_name]))
 const t=copy[locale]
 const dateLocale=({nl:"nl-BE",fr:"fr-BE",en:"en-GB",de:"de-DE"} as const)[locale]
 const formatDate=(date:string)=>new Intl.DateTimeFormat(dateLocale,{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Brussels"}).format(new Date(date))

 const w={
  nl:{
   title:"Administratief werkcentrum",intro:"Evenementen, personeel, financiën en opvolging in één helder overzicht.",
   events:"Evenementenplanning",eventsLink:"Planning bekijken",noEvents:"Er zijn nog geen toekomstige evenementen ingepland.",
   overview:"Operationele status",allClear:"Er zijn momenteel geen openstaande dossiers die opvolging vragen.",needsReview:"Dossiers vragen opvolging in de onderstaande werkstromen.",
   noData:"Sommige gegevens konden niet worden opgehaald; open het onderdeel om de status te controleren.",
   people:"Personeel & planning",money:"Financiën & contracten",operations:"Operaties & automatisering",
   timesheets:"Ingediende werkstaten",rosters:"Roosters ter goedkeuring",financial:"Financiële documenten",contracts:"DJ-contracten & boekingen",
   inventory:"Inventarisafwijkingen",notifications:"Ongelezen meldingen",automation:"Automatische controles",
   okay:"Geen openstaande dossiers",noRun:"Nog geen uitvoering geregistreerd",runOkay:"Laatste uitvoering geslaagd",
   runFailed:"Laatste uitvoering mislukt",noticesOkay:"Geen ongelezen meldingen",planningOkay:"Geen roosters ter goedkeuring",
   contractsOkay:"Geen DJ-opvolging open",hoursOkay:"Geen werkstaten ter beoordeling",stockOkay:"Geen ontbrekend of beschadigd materiaal",
   financeOkay:"Geen openstaande financiële documenten",draft:"concept(en)",inProgress:"in behandeling",
   loadError:"Status niet beschikbaar",open:"Onderdeel openen",
  },
  fr:{
   title:"Centre de travail administratif",intro:"Événements, personnel, finances et suivi en un seul aperçu clair.",
   events:"Calendrier des événements",eventsLink:"Voir la planification",noEvents:"Aucun événement futur n'est encore planifié.",
   overview:"État opérationnel",allClear:"Aucun dossier en attente de traitement pour le moment.",needsReview:"Des dossiers doivent être traités dans les sections ci-dessous.",
   noData:"Certaines données sont indisponibles ; ouvrez la section pour contrôler leur état.",
   people:"Personnel et planification",money:"Finances et contrats",operations:"Opérations et automatisations",
   timesheets:"Feuilles de temps soumises",rosters:"Plannings à approuver",financial:"Documents financiers",contracts:"Contrats et réservations DJ",
   inventory:"Écarts d'inventaire",notifications:"Notifications non lues",automation:"Contrôles automatiques",
   okay:"Aucun dossier en attente",noRun:"Aucune exécution enregistrée",runOkay:"Dernière exécution réussie",
   runFailed:"Dernière exécution en échec",noticesOkay:"Aucune notification non lue",planningOkay:"Aucun planning à approuver",
   contractsOkay:"Aucun suivi DJ en cours",hoursOkay:"Aucune feuille de temps à vérifier",stockOkay:"Aucun matériel manquant ou endommagé",
   financeOkay:"Aucun document financier en attente",draft:"brouillon(s)",inProgress:"en cours",
   loadError:"Statut indisponible",open:"Ouvrir la section",
  },
  en:{
   title:"Administration work center",intro:"Events, crew, finances and follow-ups in one clear overview.",
   events:"Event schedule",eventsLink:"View planning",noEvents:"No upcoming events are scheduled yet.",
   overview:"Operational status",allClear:"There are currently no cases awaiting attention.",needsReview:"Items require attention in the workstreams below.",
   noData:"Some data could not be loaded. Open the relevant section to check its status.",
   people:"Crew & planning",money:"Finance & contracts",operations:"Operations & automation",
   timesheets:"Submitted timesheets",rosters:"Rosters awaiting approval",financial:"Financial documents",contracts:"DJ contracts & bookings",
   inventory:"Inventory discrepancies",notifications:"Unread notifications",automation:"Automated checks",
   okay:"No outstanding items",noRun:"No run recorded yet",runOkay:"Last run succeeded",
   runFailed:"Last run failed",noticesOkay:"No unread notifications",planningOkay:"No rosters awaiting approval",
   contractsOkay:"No open DJ follow-ups",hoursOkay:"No timesheets to review",stockOkay:"No missing or damaged stock",
   financeOkay:"No outstanding financial documents",draft:"draft(s)",inProgress:"in progress",
   loadError:"Status unavailable",open:"Open section",
  },
  de:{
   title:"Verwaltungsübersicht",intro:"Veranstaltungen, Personal, Finanzen und Nachverfolgung auf einen Blick.",
   events:"Veranstaltungsplanung",eventsLink:"Planung öffnen",noEvents:"Es sind noch keine kommenden Veranstaltungen geplant.",
   overview:"Betriebsstatus",allClear:"Zurzeit sind keine Vorgänge zur Bearbeitung offen.",needsReview:"In den folgenden Bereichen müssen Vorgänge bearbeitet werden.",
   noData:"Einige Daten konnten nicht geladen werden. Prüfen Sie den betreffenden Bereich.",
   people:"Personal & Planung",money:"Finanzen & Verträge",operations:"Betrieb & Automatisierung",
   timesheets:"Eingereichte Stundenzettel",rosters:"Dienstpläne zur Genehmigung",financial:"Finanzdokumente",contracts:"DJ-Verträge & Buchungen",
   inventory:"Bestandsabweichungen",notifications:"Ungelesene Meldungen",automation:"Automatische Prüfungen",
   okay:"Keine offenen Vorgänge",noRun:"Noch keine Ausführung aufgezeichnet",runOkay:"Letzte Ausführung erfolgreich",
   runFailed:"Letzte Ausführung fehlgeschlagen",noticesOkay:"Keine ungelesenen Meldungen",planningOkay:"Keine Pläne zur Genehmigung",
   contractsOkay:"Keine offenen DJ-Nachverfolgungen",hoursOkay:"Keine Stundenzettel zur Prüfung",stockOkay:"Kein fehlender oder beschädigter Bestand",
   financeOkay:"Keine offenen Finanzdokumente",draft:"Entwurf/Entwürfe",inProgress:"in Bearbeitung",
   loadError:"Status nicht verfügbar",open:"Bereich öffnen",
  }
 }[locale]
 const automationRun=automationRuns.data?.[0]??null
 const automationError=Boolean(automationRuns.error||automationRun?.error_code)
 const financialPending=financial.error||draftDocuments.error?null:(financial.count??0)+(draftDocuments.count??0)
 const pendingItems=[hours.count,rosters.count,contracts.count,financialPending,inventory.count,notifications.count]
 const hasDataError=Boolean(hours.error||inventory.error||contracts.error||financial.error||draftDocuments.error||rosters.error||notifications.error||events.error||labels?.error||automationRuns.error)
 const needsAttention=pendingItems.some(value=>(value??0)>0)||Boolean(automationRun?.error_code)
 const upcomingEvents=events.error?[]:(events.data??[]).slice(0,3)
 const priorityItems=[
  {id:"timesheets",group:"people",label:w.timesheets,href:"/portals/administration/timesheets",count:hours.count,error:hours.error,
   detail:hours.data?.length?(hours.data.slice(0,2).map(row=>(staffNames.get(row.user_id)||t.staff)+" · "+(eventNames.get(row.event_id)||t.event)).join("; ")):w.hoursOkay},
  {id:"rosters",group:"people",label:w.rosters,href:"/portals/administration/rosters",count:rosters.count,error:rosters.error,detail:w.planningOkay},
  {id:"contracts",group:"money",label:w.contracts,href:"/portals/administration/modules/contracts",count:contracts.count,error:contracts.error,
   detail:contracts.data?.length?contracts.data.slice(0,2).map(row=>row.artist_name).join("; "):w.contractsOkay},
  {id:"finance",group:"money",label:w.financial,href:"/portals/administration/finance",count:financialPending,error:financial.error||draftDocuments.error,
   detail:financialPending===0?w.financeOkay:
    (draftDocuments.count??0)+" "+w.draft+" · "+(financial.count??0)+" "+w.inProgress},
  {id:"inventory",group:"operations",label:w.inventory,href:"/portals/administration/modules/inventory",count:inventory.count,error:inventory.error,
   detail:inventory.data?.length?inventory.data.slice(0,2).map(item=>item.name+" ("+t.missing+": "+(item.missing_quantity??0)+", "+t.damaged+": "+(item.damaged_quantity??0)+")").join("; "):w.stockOkay},
  {id:"notifications",group:"operations",label:w.notifications,href:"/portals/administration/modules/notifications",count:notifications.count,error:notifications.error,detail:w.noticesOkay},
  {id:"automations",group:"operations",label:w.automation,href:"/portals/administration/modules/automations",
   count:automationRun?.error_code?1:0,error:automationRuns.error,
   detail:!automationRun?w.noRun:(automationError?w.runFailed:w.runOkay)+" · "+formatDate(automationRun.completed_at)},
 ]
 const groups=[{key:"people",title:w.people},{key:"money",title:w.money},{key:"operations",title:w.operations}]
 return <main data-administration-overview-ready="true" className="mx-auto w-full max-w-6xl space-y-5 p-4 pb-28 sm:p-6">
  <header className="space-y-1">
   <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{w.title}</h1>
   <p className="text-sm leading-6 text-muted-foreground">{w.intro}</p>
  </header>
  {hasDataError&&<p role="alert" className="rounded-xl border border-amber-600/50 px-4 py-3 text-sm">{w.noData}</p>}
  <section aria-label={w.events} className="rounded-2xl border bg-card p-4 sm:p-5">
   <div className="flex items-center justify-between gap-3">
    <h2 className="text-lg font-bold">{w.events}</h2>
    <Link className="shrink-0 text-sm font-semibold text-violet-400 hover:underline" href="/portals/administration/modules/events">{w.eventsLink}</Link>
   </div>
   {upcomingEvents.length?<ul className="mt-3 divide-y">
    {upcomingEvents.map(event=><li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
     <span className="font-semibold">{event.name}</span>
     <span className="text-xs text-muted-foreground">{formatDate(event.start_at)} · {event.status}</span>
    </li>)}
   </ul>:<p className="mt-3 text-sm text-muted-foreground">{events.error?w.loadError:w.noEvents}</p>}
  </section>
  <section aria-label={w.overview} className="space-y-3">
   <header className="space-y-1">
    <h2 className="text-lg font-bold">{w.overview}</h2>
    <p className="text-sm text-muted-foreground">{needsAttention?w.needsReview:hasDataError?w.noData:w.allClear}</p>
   </header>
   <div className="grid gap-3 lg:grid-cols-3">
    {groups.map(group=><section key={group.key} className="min-w-0 overflow-hidden rounded-2xl border bg-card">
     <h3 className="border-b px-4 py-3 text-sm font-bold">{group.title}</h3>
     <ul className="divide-y">
      {priorityItems.filter(item=>item.group===group.key).map(item=><li key={item.id}>
       <Link href={item.href} data-administration-priority={item.id} className="flex min-h-20 items-center gap-3 px-4 py-3 hover:bg-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500">
        <span className="min-w-0 flex-1">
         <span className="block text-sm font-semibold">{item.label}</span>
         <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground">{item.error?w.loadError:item.detail}</span>
        </span>
        <span className="rounded-lg border px-2.5 py-1 text-sm font-semibold tabular-nums">{item.error?"—":item.count??"—"}</span>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-violet-400"/>
        <span className="sr-only">{w.open}</span>
       </Link>
      </li>)}
     </ul>
    </section>)}
   </div>
  </section>
  {/* The extended subtab catalog runs 20 independent live queries. Isolate it
      from the primary work pulse so a slow secondary RPC cannot hold the
      page-level loading boundary, header, or primary actions hostage. */}
  <Suspense fallback={<section aria-label={w.operations} data-administration-status-loading="true" role="status" className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
   {({nl:"Aanvullende onderdeelstatussen laden…",fr:"Chargement des statuts complémentaires…",en:"Loading additional section statuses…",de:"Weitere Bereichsstatus werden geladen…"} as const)[locale]}
  </section>}>
   <AdministrationSubtabStatus locale={locale}/>
  </Suspense>
 </main>
}
