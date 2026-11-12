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
 const pulse=[
  {label:t.hours,count:hours.count,error:hours.error},
  {label:t.stock,count:inventory.count,error:inventory.error},
  {label:t.contracts,count:contracts.count,error:contracts.error},
  {label:t.finance,count:financial.count,error:financial.error},
  {label:t.rosters,count:rosters.count,error:rosters.error},
  {label:t.notices,count:notifications.count,error:notifications.error},
  {label:t.events,count:events.count,error:events.error}
 ]
 return <main className="mx-auto w-full max-w-6xl space-y-6 p-4 pb-28 md:p-8">
  <header className="space-y-2">
   <p data-no-translate className="text-xs font-black uppercase tracking-[.2em] text-violet-400">UpTillDawn</p>
   <h1 className="text-2xl font-bold sm:text-3xl">{t.title}</h1>
   <p className="max-w-3xl text-sm text-muted-foreground">{t.intro}</p>
  </header>
  <section aria-label={t.title} className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
   {pulse.map(item=><article key={item.label} className="rounded-xl border bg-card p-4">
    <p className="min-h-10 text-xs font-medium text-muted-foreground">{item.label}</p>
    <p className="mt-2 text-2xl font-bold tabular-nums" aria-label={item.label}>{item.error?"—":item.count??0}</p>
   </article>)}
  </section>
  <div className="grid gap-4 lg:grid-cols-2">
   <section className="space-y-3 rounded-2xl border bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">{t.recentHours}</h2><Link className="text-sm font-semibold text-violet-400" href="/portals/administration/timesheets">{t.manageHours}</Link></div>
    {hours.error?<p role="alert" className="text-sm">{t.error}</p>:!hours.data?.length?<p className="text-sm text-muted-foreground">{t.noHours}</p>:
     <ul className="divide-y">{hours.data.map(row=><li key={row.id} className="space-y-1 py-3 text-sm"><p className="font-medium">{staffNames.get(row.user_id)||t.staff} · {eventNames.get(row.event_id)||t.event}</p>{row.submitted_at&&<p className="text-xs text-muted-foreground">{t.submitted}: {formatDate(row.submitted_at)}</p>}</li>)}</ul>}
   </section>
   <section className="space-y-3 rounded-2xl border bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">{t.stockIssues}</h2><Link className="text-sm font-semibold text-violet-400" href="/portals/administration/modules/inventory">{t.manageStock}</Link></div>
    {inventory.error?<p role="alert" className="text-sm">{t.error}</p>:!inventory.data?.length?<p className="text-sm text-muted-foreground">{t.noStock}</p>:
     <ul className="divide-y">{inventory.data.map(item=><li key={item.id} className="space-y-1 py-3 text-sm"><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{t.missing}: {item.missing_quantity??0} · {t.damaged}: {item.damaged_quantity??0}</p></li>)}</ul>}
   </section>
   <section className="space-y-3 rounded-2xl border bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">{t.contractCases}</h2><Link className="text-sm font-semibold text-violet-400" href="/portals/administration/modules/contracts">{t.manageContracts}</Link></div>
    {contracts.error?<p role="alert" className="text-sm">{t.error}</p>:!contracts.data?.length?<p className="text-sm text-muted-foreground">{t.noContracts}</p>:
     <ul className="divide-y">{contracts.data.map(item=><li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm"><Link className="font-semibold text-violet-400 hover:underline" href={"/portals/administration/modules/artists/"+item.id+"/agreement"}>{item.artist_name}</Link><span className="text-xs text-muted-foreground">{item.status}</span></li>)}</ul>}
    <Link className="inline-flex rounded-lg border px-3 py-2 text-xs font-semibold" href="/portals/administration/modules/artists/new?contract=1">{t.createContract}</Link>
   </section>
   <section className="space-y-3 rounded-2xl border bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">{t.financialCases}</h2><Link className="text-sm font-semibold text-violet-400" href="/portals/administration/modules/invoices">{t.manageFinance}</Link></div>
    {financial.error?<p role="alert" className="text-sm">{t.error}</p>:!financial.data?.length?<p className="text-sm text-muted-foreground">{t.noFinance}</p>:
     <ul className="divide-y">{financial.data.map(item=><li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span className="font-semibold">{item.document_number||item.kind}</span><span className="text-xs text-muted-foreground">{item.status} · {item.gross_amount??"—"} {item.currency}</span></li>)}</ul>}
   </section>
   <section className="space-y-3 rounded-2xl border bg-card p-5 lg:col-span-2">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">{t.nextEvents}</h2><Link className="text-sm font-semibold text-violet-400" href="/portals/administration/modules/events">{t.manageEvents}</Link></div>
    {events.error?<p role="alert" className="text-sm">{t.error}</p>:!events.data?.length?<p className="text-sm text-muted-foreground">{t.noEvents}</p>:
     <ul className="grid gap-2 sm:grid-cols-2">{events.data.map(item=><li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><span className="font-semibold">{item.name}</span><span className="text-xs text-muted-foreground">{formatDate(item.start_at)} · {item.status}</span></li>)}</ul>}
    <Link className="inline-flex rounded-lg border px-3 py-2 text-xs font-semibold" href="/portals/administration/modules/events">{t.createEvent}</Link>
   </section>
  </div>
 </main>
}
