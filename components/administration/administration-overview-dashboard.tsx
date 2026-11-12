import { createClient } from "@/lib/supabase/crew-server"
import type { SupportedUiLocale } from "@/lib/locale-preferences"

const copy = {
 nl:{
  title:"Administratief overzicht",
  intro:"Wat vraagt je aandacht? Beheer elk onderdeel via de zes vaste tabbladen. Het dashboard herhaalt geen knoppen of modules.",
  hours:"Ingediende werkstaten",
  stock:"Inventarisafwijkingen",
  recentHours:"Recent ingediende werkstaten",
  stockIssues:"Ontbrekend of beschadigd",
  noHours:"Geen ingediende werkstaten die op behandeling wachten.",
  noStock:"Geen voorraadproblemen geregistreerd.",
  errorHours:"Werkstaten zijn momenteel niet beschikbaar.",
  errorStock:"Voorraadinformatie is momenteel niet beschikbaar.",
  submitted:"Ingediend",
  missing:"Ontbrekend",
  damaged:"Beschadigd",
  event:"Evenement",
  staff:"Medewerker",
 },
 fr:{
  title:"Tableau de bord administratif",
  intro:"Points à traiter en priorité. Chaque fonction est accessible via les six onglets, sans raccourcis répétés.",
  hours:"Feuilles de temps soumises",
  stock:"Écarts d'inventaire",
  recentHours:"Dernières feuilles soumises",
  stockIssues:"Produits manquants ou endommagés",
  noHours:"Aucune feuille en attente de traitement.",
  noStock:"Aucun écart de stock enregistré.",
  errorHours:"Les feuilles de temps sont indisponibles.",
  errorStock:"L'inventaire est indisponible.",
  submitted:"Soumis",
  missing:"Manquant",
  damaged:"Endommagé",
  event:"Événement",
  staff:"Membre",
 },
 en:{
  title:"Administration overview",
  intro:"What needs attention? Use the six tabs to open each function; the dashboard avoids duplicate shortcuts.",
  hours:"Submitted timesheets",
  stock:"Inventory discrepancies",
  recentHours:"Recently submitted timesheets",
  stockIssues:"Missing or damaged items",
  noHours:"No submitted timesheets awaiting review.",
  noStock:"No inventory discrepancies recorded.",
  errorHours:"Timesheets are currently unavailable.",
  errorStock:"Inventory information is currently unavailable.",
  submitted:"Submitted",
  missing:"Missing",
  damaged:"Damaged",
  event:"Event",
  staff:"Staff member",
 },
 de:{
  title:"Verwaltungsübersicht",
  intro:"Was muss bearbeitet werden? Jede Funktion ist über die sechs Register erreichbar – ohne doppelte Schnellzugriffe.",
  hours:"Eingereichte Stundenzettel",
  stock:"Inventarabweichungen",
  recentHours:"Zuletzt eingereichte Stundenzettel",
  stockIssues:"Fehlende oder beschädigte Artikel",
  noHours:"Keine Stundenzettel warten auf Bearbeitung.",
  noStock:"Keine Inventarabweichungen erfasst.",
  errorHours:"Stundenzettel sind zurzeit nicht verfügbar.",
  errorStock:"Inventardaten sind zurzeit nicht verfügbar.",
  submitted:"Eingereicht",
  missing:"Fehlend",
  damaged:"Beschädigt",
  event:"Event",
  staff:"Mitarbeiter",
 },
} as const

/** Read-only overview. Each workflow has exactly one destination in the shared navigation. */
export async function AdministrationOverviewDashboard({locale}:{locale:SupportedUiLocale}) {
 const s=await createClient()
 const [hours,inventory]=await Promise.all([
  s.from("timesheets")
   .select("id,event_id,user_id,submitted_at",{count:"exact"})
   .eq("status","submitted").order("submitted_at",{ascending:false}).limit(5),
  s.from("inventory_items")
   .select("id,name,missing_quantity,damaged_quantity",{count:"exact"})
   .or("missing_quantity.gt.0,damaged_quantity.gt.0")
   .order("name").limit(5),
 ])
 const labelResult=!hours.error&&hours.data?.length
  ?await s.rpc("upt_administration_timesheet_labels",{p_timesheet_ids:hours.data.map(row=>row.id)})
  :null
 const eventNames=new Map((labelResult?.data??[]).map(row=>[row.event_id,row.event_name]))
 const staffNames=new Map((labelResult?.data??[]).map(row=>[row.user_id,row.crew_name]))
 const t=copy[locale]
 const dateLocale=({nl:"nl-BE",fr:"fr-BE",en:"en-GB",de:"de-DE"} as const)[locale]
 const format=(value:string)=>new Intl.DateTimeFormat(dateLocale,{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Brussels"}).format(new Date(value))
 return <main className="mx-auto w-full max-w-5xl space-y-6 p-4 pb-28 md:p-8">
  <header className="space-y-2">
   <p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">UpTillDawn</p>
   <h1 className="text-2xl font-bold sm:text-3xl">{t.title}</h1>
   <p className="max-w-2xl text-sm text-muted-foreground">{t.intro}</p>
  </header>
  <div className="grid gap-3 sm:grid-cols-2" aria-label={t.title}>
   <section className="rounded-2xl border bg-card p-5">
    <h2 className="text-sm font-medium text-muted-foreground">{t.hours}</h2>
    <p className="mt-2 text-3xl font-bold tabular-nums">{hours.error?"—":hours.count??0}</p>
   </section>
   <section className="rounded-2xl border bg-card p-5">
    <h2 className="text-sm font-medium text-muted-foreground">{t.stock}</h2>
    <p className="mt-2 text-3xl font-bold tabular-nums">{inventory.error?"—":inventory.count??0}</p>
   </section>
  </div>
  <div className="grid gap-4 lg:grid-cols-2">
   <section className="space-y-3 rounded-2xl border bg-card p-5" aria-label={t.recentHours}>
    <h2 className="text-lg font-semibold">{t.recentHours}</h2>
    {hours.error?<p role="alert" className="text-sm text-muted-foreground">{t.errorHours}</p>
     :!hours.data?.length?<p className="text-sm text-muted-foreground">{t.noHours}</p>
     :<ul className="divide-y">{hours.data.map(row=><li key={row.id} className="space-y-1 py-3 text-sm">
      <p className="font-medium">{t.staff}: {staffNames.get(row.user_id)||"—"}</p>
      <p className="text-muted-foreground">{t.event}: {eventNames.get(row.event_id)||"—"}</p>
      {row.submitted_at&&<p className="text-xs text-muted-foreground">{t.submitted}: {format(row.submitted_at)}</p>}
     </li>)}</ul>}
   </section>
   <section className="space-y-3 rounded-2xl border bg-card p-5" aria-label={t.stockIssues}>
    <h2 className="text-lg font-semibold">{t.stockIssues}</h2>
    {inventory.error?<p role="alert" className="text-sm text-muted-foreground">{t.errorStock}</p>
     :!inventory.data?.length?<p className="text-sm text-muted-foreground">{t.noStock}</p>
     :<ul className="divide-y">{inventory.data.map(item=><li key={item.id} className="space-y-1 py-3 text-sm">
      <p className="font-medium">{item.name}</p>
      <p className="text-xs text-muted-foreground">{t.missing}: {item.missing_quantity??0} · {t.damaged}: {item.damaged_quantity??0}</p>
     </li>)}</ul>}
   </section>
  </div>
 </main>
}
