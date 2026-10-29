import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { requestUiLocale } from "@/lib/server-locale"
import { administrationModules, administrationCopy } from "@/lib/administration/modules"
import { getCurrentUser } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/crew-server"
import { canOpenPortal, type PortalAssignment } from "@/lib/portal-access"
import type { SupportedUiLocale } from "@/lib/locale-preferences"

type Translation=Record<SupportedUiLocale,string>
const text=(nl:string,fr:string,en:string,de:string):Translation=>({nl,fr,en,de})
const moduleSections:Record<string,[Translation,Translation,Translation]>={
 events:[text("Evenementenplanning","Planification des événements","Event planning","Eventplanung"),text("Productietijdlijn","Calendrier de production","Production timeline","Produktionszeitplan"),text("Afsluiting & archief","Clôture et archives","Closure & archive","Abschluss & Archiv")],
 artists:[text("Artiestenaanvragen","Demandes d'artistes","Artist enquiries","Künstleranfragen"),text("Boekingskalender","Calendrier des réservations","Booking calendar","Buchungskalender"),text("Riders & afspraken","Riders et accords","Riders & agreements","Rider & Vereinbarungen")],
 contracts:[text("Contractenregister","Registre des contrats","Contract register","Vertragsregister"),text("Goedkeuringswachtrij","File de validation","Approval queue","Freigabewarteschlange"),text("Verplichtingen & deadlines","Obligations et échéances","Obligations & deadlines","Pflichten & Fristen")],
 staff:[text("Personeelsplanning","Planning du personnel","Staff scheduling","Personalplanung"),text("Ingediende werkuren","Heures soumises","Submitted hours","Eingereichte Stunden"),text("Goedkeuringen","Validations","Approvals","Freigaben")],
 invoices:[text("Verkoopfacturen","Factures de vente","Sales invoices","Ausgangsrechnungen"),text("Aankoopfacturen","Factures d'achat","Purchase invoices","Eingangsrechnungen"),text("Creditnota's & herinneringen","Avoirs et rappels","Credit notes & reminders","Gutschriften & Mahnungen")],
 banking:[text("Betalingen","Paiements","Payments","Zahlungen"),text("Openstaande posten","Soldes impayés","Outstanding balances","Offene Posten"),text("Afstemming","Rapprochement","Reconciliation","Abstimmung")],
 ticketing:[text("Ticketverkoop","Vente de billets","Ticket sales","Ticketverkauf"),text("Omzetafstemming","Rapprochement des recettes","Revenue reconciliation","Umsatzabgleich"),text("Verkoopkanalen","Canaux de vente","Sales channels","Vertriebskanäle")],
 inventory:[text("Voorraadregister","Registre des stocks","Stock register","Bestandsregister"),text("Materiaalbewegingen","Mouvements de matériel","Equipment movements","Materialbewegungen"),text("Afwijkingen","Écarts","Discrepancies","Abweichungen")],
 logistics:[text("Transportplanning","Planification du transport","Transport planning","Transportplanung"),text("Leveringen","Livraisons","Deliveries","Lieferungen"),text("Locaties & materiaal","Lieux et matériel","Venues & equipment","Orte & Material")],
 contacts:[text("Contactenbestand","Répertoire de contacts","Contact directory","Kontaktverzeichnis"),text("Leveranciers","Fournisseurs","Suppliers","Lieferanten"),text("Communicatiehistoriek","Historique des échanges","Communication history","Kommunikationsverlauf")],
 sponsors:[text("Partnerdossiers","Dossiers partenaires","Partner records","Partnerakten"),text("Sponsorafspraken","Accords de sponsoring","Sponsorship agreements","Sponsoringvereinbarungen"),text("Leveringsverplichtingen","Engagements à livrer","Delivery obligations","Lieferpflichten")],
 marketing:[text("Campagnes","Campagnes","Campaigns","Kampagnen"),text("Promotiemateriaal","Supports promotionnels","Promotional assets","Werbematerial"),text("Publicatieplanning","Calendrier de publication","Publishing schedule","Veröffentlichungsplan")],
 permits:[text("Vergunningen","Autorisations","Permits","Genehmigungen"),text("Risicoregister","Registre des risques","Risk register","Risikoregister"),text("Veiligheidsdocumenten","Documents de sécurité","Safety documents","Sicherheitsdokumente")],
 documents:[text("Documentenbibliotheek","Bibliothèque de documents","Document library","Dokumentenbibliothek"),text("Te verwerken documenten","Documents à traiter","Documents to process","Zu bearbeitende Dokumente"),text("Archief","Archives","Archive","Archiv")],
 tasks:[text("Mijn opdrachten","Mes tâches","My assignments","Meine Aufgaben"),text("Deadlines & prioriteiten","Délais et priorités","Deadlines & priorities","Fristen & Prioritäten"),text("Ter goedkeuring","En attente de validation","Awaiting approval","Zur Freigabe")],
 reports:[text("Financiële rapporten","Rapports financiers","Financial reports","Finanzberichte"),text("Evenementresultaten","Résultats des événements","Event results","Eventergebnisse"),text("Exports","Exports","Exports","Exporte")],
 notifications:[text("Nieuwe meldingen","Nouvelles notifications","New notifications","Neue Benachrichtigungen"),text("Actie vereist","Action requise","Action required","Aktion erforderlich"),text("Historiek","Historique","History","Verlauf")],
 automations:[text("Automatiseringsregels","Règles d'automatisation","Automation rules","Automatisierungsregeln"),text("Uitvoeringshistoriek","Historique d'exécution","Execution history","Ausführungsverlauf"),text("Controle & goedkeuring","Contrôle et validation","Review & approval","Prüfung & Freigabe")],
 ai:[text("Documentverwerking","Traitement des documents","Document processing","Dokumentenverarbeitung"),text("Voorgestelde acties","Actions proposées","Suggested actions","Vorgeschlagene Aktionen"),text("Menselijke controle","Contrôle humain","Human review","Menschliche Prüfung")],
 settings:[text("Gebruikers & bevoegdheden","Utilisateurs et autorisations","Users & permissions","Benutzer & Berechtigungen"),text("Financiële instellingen","Paramètres financiers","Financial settings","Finanzeinstellungen"),text("Integraties & auditlog","Intégrations et journal d'audit","Integrations & audit log","Integrationen & Auditprotokoll")],
}
const ui={
 nl:{section:"Werkoverzicht",notAvailable:"Nog geen actieve gegevens in dit onderdeel",pending:"Functie in voorbereiding",related:"Gerelateerde administratie",finance:"Financiële documenten openen",back:"Terug naar overzicht",notice:"De schermindeling is beschikbaar. Nieuwe verwerkingen worden pas geactiveerd na implementatie en controle."},
 fr:{section:"Espace de travail",notAvailable:"Aucune donnée active dans cette section",pending:"Fonction en préparation",related:"Administration associée",finance:"Ouvrir les documents financiers",back:"Retour à l'accueil",notice:"L'interface est disponible. Les nouveaux traitements seront activés après développement et validation."},
 en:{section:"Workspace overview",notAvailable:"No active data in this section yet",pending:"Feature in preparation",related:"Related administration",finance:"Open financial documents",back:"Back to overview",notice:"The screen layout is available. New processing will only be enabled after implementation and validation."},
 de:{section:"Arbeitsübersicht",notAvailable:"Noch keine aktiven Daten in diesem Bereich",pending:"Funktion in Vorbereitung",related:"Zugehörige Verwaltung",finance:"Finanzdokumente öffnen",back:"Zur Übersicht",notice:"Die Oberfläche ist verfügbar. Neue Verarbeitungen werden erst nach Implementierung und Prüfung aktiviert."},
} as const
const financeRelated=new Set(["invoices","banking","documents","reports"])

export const dynamic = "force-dynamic"

export default async function AdministrationModulePage({params,searchParams}:{params:Promise<{slug:string}>;searchParams?:Promise<{event?:string;page?:string}>}){
 const {slug}=await params
 const {event:requestedEvent,page:requestedPage}=await (searchParams??Promise.resolve({event:undefined,page:undefined}))
 const adminModule=administrationModules.find(item=>item.slug===slug&&slug!=="dashboard"&&slug!=="finance")
 if(!adminModule)notFound()
 const current=await getCurrentUser()
 if(!current)redirect("/login")
 if((!current.approved||Boolean(current.account_blocked))&&!current.isOwner)redirect("/portals")
 const supabase=await createClient()
 const {data,error}=await supabase.rpc("upt_my_portal_assignments")
 if(error&&!current.isAdmin && !current.isOwner)redirect("/portals")
 if(!current.isAdmin && !current.isOwner&&!canOpenPortal("administration",(data??[]) as PortalAssignment[],{approved:current.approved,blocked:current.account_blocked===true}))redirect("/portals")
 const parsedPage=Number(requestedPage)
 const inventoryPage=Number.isSafeInteger(parsedPage)&&parsedPage>0&&parsedPage<=10000?parsedPage:1
 const inventoryPageSize=100
 const inventoryStart=(inventoryPage-1)*inventoryPageSize
 const inventoryFilterEvents=slug==="inventory" ? await supabase.from("events").select("id,name").order("start_at",{ascending:false}).limit(100) : null
 const selectedEvent=inventoryFilterEvents?.data?.some(event=>event.id===requestedEvent)?requestedEvent:null
 const inventoryCount=slug==="inventory" ? await (selectedEvent?supabase.from("inventory_items").select("id",{count:"exact",head:true}).eq("event_id",selectedEvent):supabase.from("inventory_items").select("id",{count:"exact",head:true})) : null
 const artistBookings=slug==="artists"?await supabase.from("admin_artist_bookings").select("id,artist_name,status,event_id,performance_at,fee_amount,currency,follow_up_at").order("created_at",{ascending:false}).limit(30):null
 const artistFollowUps=slug==="artists"?await supabase.from("admin_artist_bookings").select("id,artist_name,status,follow_up_at").not("follow_up_at","is",null).in("status",["enquiry","negotiating"]).order("follow_up_at",{ascending:true}).limit(100):null
 const artistNow=new Date().getTime()
 const artistEventCount=slug==="artists"?await supabase.from("events").select("id",{count:"exact",head:true}):null
 const liveRecords = (slug==="events"||slug==="artists")
  ? await supabase.from("events").select("id,name,status,start_at").order("start_at",{ascending:false}).limit(30)
  : slug==="inventory"
    ? await (selectedEvent?supabase.from("inventory_items").select("id,name,missing_quantity,damaged_quantity,event_id").eq("event_id",selectedEvent):supabase.from("inventory_items").select("id,name,missing_quantity,damaged_quantity,event_id")).order("id").range(inventoryStart,inventoryStart+inventoryPageSize-1)
    : null
 // Read every inventory row for accurate totals; never label partial results as complete.
 const summaryRows:{event_id:string|null;missing_quantity:number|null;damaged_quantity:number|null}[]=[]
 let summaryComplete=slug==="inventory"&&inventoryCount?.count!=null&&inventoryCount.count<=5000
 if(summaryComplete){
  for(let offset=0;offset<(inventoryCount?.count??0);offset+=500){
   const batch=await (selectedEvent?supabase.from("inventory_items").select("event_id,missing_quantity,damaged_quantity").eq("event_id",selectedEvent):supabase.from("inventory_items").select("event_id,missing_quantity,damaged_quantity")).order("id").range(offset,offset+499)
   if(batch.error||!batch.data){summaryComplete=false;break}
   summaryRows.push(...batch.data)
   if(batch.data.length<Math.min(500,(inventoryCount?.count??0)-offset)){summaryComplete=false;break}
  }
 }
 const inventorySummary=new Map<string,{missing:number;damaged:number;items:number}>()
 if(summaryComplete){
  for(const record of summaryRows){
   const eventKey=record.event_id??"__unassigned__"
   const summary=inventorySummary.get(eventKey)??{missing:0,damaged:0,items:0}
   summary.missing+=Number(record.missing_quantity??0)
   summary.damaged+=Number(record.damaged_quantity??0)
   summary.items+=1
   inventorySummary.set(eventKey,summary)
  }
 }
 const inventoryEventIds=slug==="inventory"
  ? [...new Set([...(liveRecords?.data??[]).flatMap(record=>"event_id" in record&&record.event_id?[record.event_id]:[]),...[...inventorySummary.keys()].filter(id=>id!=="__unassigned__")])]
  : []
 const inventoryEvents=inventoryEventIds.length
  ? await supabase.from("events").select("id,name").in("id",inventoryEventIds)
  : null
 const inventoryEventNames=new Map((inventoryEvents?.data??[]).map(event=>[event.id,event.name]))
 const locale=await requestUiLocale()
 const t=administrationCopy[locale]
 const u=ui[locale]
 const sections=moduleSections[slug]
 if(!sections)notFound()
 return <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <Link href="/portals/administration" className="text-sm font-semibold text-violet-400 hover:underline">← {u.back}</Link>
   <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{t.phase}</span>
  </div>
  <header className="rounded-2xl border bg-card p-5 sm:p-7">
   <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">{u.section}</p>
   <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{adminModule.title[locale]}</h1>
   <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{u.notice}</p>
  </header>
  {slug==="artists"&&<section className="rounded-2xl border bg-card p-5">
   <Link href="/portals/administration/modules/artists/new" className="mb-3 inline-flex rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white">{({nl:"DJ-boeking toevoegen",fr:"Ajouter une réservation DJ",en:"Add DJ booking",de:"DJ-Buchung hinzufügen"} as const)[locale]}</Link>
   <div className="mb-5 rounded-xl border p-4">
    <h3 className="font-semibold">{({nl:"Openstaande DJ-opvolgingen",fr:"Suivis DJ en attente",en:"Pending DJ follow-ups",de:"Offene DJ-Nachverfolgungen"} as const)[locale]}</h3>
    {artistFollowUps?.error?<p role="status" className="mt-2 text-sm text-muted-foreground">{({nl:"Opvolgingen konden niet worden geladen.",fr:"Impossible de charger les suivis.",en:"Follow-ups could not be loaded.",de:"Nachverfolgungen konnten nicht geladen werden."} as const)[locale]}</p>
    :artistFollowUps?.data?.length?<ul className="mt-3 divide-y">{artistFollowUps.data.map(item=>{
     const overdue=!!item.follow_up_at&&new Date(item.follow_up_at).getTime()<artistNow
     return <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
      <Link href={`/portals/administration/modules/artists/${item.id}`} className="font-medium text-violet-400 hover:underline">{item.artist_name}</Link>
      <span className={overdue?"font-semibold text-red-500":"text-muted-foreground"}>{overdue?({nl:"Achterstallig",fr:"En retard",en:"Overdue",de:"Überfällig"} as const)[locale]:({nl:"Gepland",fr:"Planifié",en:"Scheduled",de:"Geplant"} as const)[locale]} · {item.follow_up_at?new Intl.DateTimeFormat(({nl:"nl-BE",fr:"fr-BE",en:"en-GB",de:"de-DE"} as const)[locale],{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Brussels"}).format(new Date(item.follow_up_at)):"—"}</span>
     </li>
    })}</ul>:<p className="mt-2 text-sm text-muted-foreground">{({nl:"Geen openstaande opvolgingen.",fr:"Aucun suivi en attente.",en:"No pending follow-ups.",de:"Keine offenen Nachverfolgungen."} as const)[locale]}</p>}
   </div>
   <h2 className="text-lg font-semibold">{({nl:"DJ-boekingsregister",fr:"Registre des réservations DJ",en:"DJ booking register",de:"DJ-Buchungsregister"} as const)[locale]}</h2>
   {artistBookings?.error?<p role="status" className="mt-3 text-sm text-muted-foreground">{({nl:"Boekingen konden niet worden geladen. Controleer of de databasemigratie is toegepast.",fr:"Impossible de charger les réservations. Vérifiez la migration de la base de données.",en:"Bookings could not be loaded. Check whether the database migration has been applied.",de:"Buchungen konnten nicht geladen werden. Prüfen Sie, ob die Datenbankmigration angewendet wurde."} as const)[locale]}</p>
   :artistBookings?.data?.length?<ul className="mt-3 divide-y">{artistBookings.data.map(booking=><li key={booking.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><Link href={`/portals/administration/modules/artists/${booking.id}`} className="font-semibold text-violet-400 hover:underline">{booking.artist_name}</Link><p className="text-muted-foreground">{booking.performance_at?new Intl.DateTimeFormat(({nl:"nl-BE",fr:"fr-BE",en:"en-GB",de:"de-DE"} as const)[locale],{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Brussels"}).format(new Date(booking.performance_at)):"—"}</p></div><span className="rounded-full border px-3 py-1 text-xs">{({enquiry:({nl:"Aanvraag",fr:"Demande",en:"Enquiry",de:"Anfrage"} as const)[locale],negotiating:({nl:"Onderhandeling",fr:"Négociation",en:"Negotiating",de:"Verhandlung"} as const)[locale],confirmed:({nl:"Bevestigd",fr:"Confirmé",en:"Confirmed",de:"Bestätigt"} as const)[locale],cancelled:({nl:"Geannuleerd",fr:"Annulé",en:"Cancelled",de:"Storniert"} as const)[locale]} as Record<string,string>)[booking.status]??booking.status}</span></li>)}</ul>
   :<p className="mt-3 text-sm text-muted-foreground">{({nl:"Nog geen DJ-boekingen geregistreerd.",fr:"Aucune réservation DJ enregistrée.",en:"No DJ bookings registered yet.",de:"Noch keine DJ-Buchungen erfasst."} as const)[locale]}</p>}
  </section>}
  {slug==="artists"&&<section className="rounded-2xl border bg-card p-5">
   <h2 className="text-lg font-semibold">{({nl:"DJ-bookings voorbereiden",fr:"Préparer les réservations DJ",en:"Prepare DJ bookings",de:"DJ-Buchungen vorbereiten"} as const)[locale]}</h2>
   <p className="mt-2 text-sm text-muted-foreground">{({nl:"Leg eerst de artiest of het agentschap vast als contact. Gebruik de evenementenplanning om de datum te controleren. Boekingen en bevestigingsmails worden hier nog niet automatisch aangemaakt.",fr:"Enregistrez d'abord l'artiste ou l'agence comme contact. Vérifiez la date dans les événements. Les réservations et confirmations automatiques ne sont pas encore disponibles.",en:"Register the artist or agency as a contact first, then check the event date. Booking records and confirmation emails are not yet created automatically.",de:"Erfassen Sie zuerst Künstler oder Agentur als Kontakt und prüfen Sie das Veranstaltungsdatum. Buchungen und Bestätigungen werden noch nicht automatisch erstellt."} as const)[locale]}</p>
   <div className="mt-4 flex flex-wrap gap-3">
    <Link href="/portals/administration/contacts" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:border-violet-400">{({nl:"Contacten openen",fr:"Ouvrir les contacts",en:"Open contacts",de:"Kontakte öffnen"} as const)[locale]}</Link>
    <Link href="/portals/administration/modules/events" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:border-violet-400">{({nl:"Evenementen openen",fr:"Ouvrir les événements",en:"Open events",de:"Veranstaltungen öffnen"} as const)[locale]}</Link>
   </div>
  </section>}
  {slug==="artists"&&artistEventCount?.count!=null&&<p className="text-sm text-muted-foreground">{({nl:"Totaal evenementen",fr:"Nombre total d’événements",en:"Total events",de:"Veranstaltungen insgesamt"} as const)[locale]}: {artistEventCount.count}. {({nl:"Hieronder staan maximaal 30 recente evenementen.",fr:"Jusqu’à 30 événements récents sont affichés ci-dessous.",en:"Up to 30 recent events are shown below.",de:"Unten werden bis zu 30 aktuelle Veranstaltungen angezeigt."} as const)[locale]}</p>}
  {slug==="artists"&&<section className="rounded-2xl border bg-card p-5">
   <h2 className="text-lg font-semibold">{({nl:"Evenementen voor boekingsplanning",fr:"Événements pour les réservations",en:"Events for booking planning",de:"Veranstaltungen für Buchungen"} as const)[locale]}</h2>
   {liveRecords?.error?<p role="status" className="mt-3 text-sm text-muted-foreground">{({nl:"Evenementen konden niet worden geladen.",fr:"Impossible de charger les événements.",en:"Unable to load events.",de:"Veranstaltungen konnten nicht geladen werden."} as const)[locale]}</p>
   :liveRecords?.data?.length?<ul className="mt-3 divide-y">{liveRecords.data.filter((event):event is Extract<typeof event,{start_at:string}>=>"start_at" in event).map(event=><li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span className="font-medium">{event.name}</span><span className="text-muted-foreground">{event.start_at?new Intl.DateTimeFormat(({nl:"nl-BE",fr:"fr-BE",en:"en-GB",de:"de-DE"} as const)[locale],{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Brussels"}).format(new Date(event.start_at)):"—"} · {event.status}</span></li>)}</ul>
   :<p className="mt-3 text-sm text-muted-foreground">{({nl:"Geen evenementen beschikbaar.",fr:"Aucun événement disponible.",en:"No events available.",de:"Keine Veranstaltungen verfügbar."} as const)[locale]}</p>}
  </section>}
  {slug==="marketing"&&<section className="rounded-2xl border bg-card p-5">
   <h2 className="text-lg font-semibold">{({nl:"Promotiebeheer",fr:"Gestion de la promotion",en:"Promotion management",de:"Promotion verwalten"} as const)[locale]}</h2>
   <p className="mt-2 text-sm text-muted-foreground">{({nl:"Beheer promotietaken via het promotieportaal. Strikes en blokkeringen worden afzonderlijk beheerd.",fr:"Gérez les tâches promotionnelles dans le portail promotion. Les avertissements et blocages sont gérés séparément.",en:"Manage promotion tasks in the promotion portal. Strikes and restrictions are managed separately.",de:"Promotionsaufgaben werden im Promotionsportal verwaltet. Verwarnungen und Sperren werden separat verwaltet."} as const)[locale]}</p>
   <div className="mt-4 flex flex-wrap gap-3">
    <Link href="/portals/promotion/tasks" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:border-violet-400">{({nl:"Promotietaken",fr:"Tâches promotionnelles",en:"Promotion tasks",de:"Promotionsaufgaben"} as const)[locale]}</Link>
    <Link href="/portals/administration/promotion-discipline" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:border-violet-400">{({nl:"Strikes en blokkeringen",fr:"Avertissements et blocages",en:"Strikes and restrictions",de:"Verwarnungen und Sperren"} as const)[locale]}</Link>
   </div>
  </section>}
  {slug==="inventory"&&requestedEvent&&!selectedEvent&&<p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">{inventoryFilterEvents?.error?({nl:"De evenementenfilter is tijdelijk niet beschikbaar. Alle toegankelijke materialen worden getoond.",fr:"Le filtre d’événements est temporairement indisponible. Tous les articles accessibles sont affichés.",en:"The event filter is temporarily unavailable. All accessible items are shown.",de:"Der Veranstaltungsfilter ist vorübergehend nicht verfügbar. Alle zugänglichen Artikel werden angezeigt."} as const)[locale]:({nl:"Dit evenement is niet beschikbaar. Alle toegankelijke materialen worden getoond.",fr:"Cet événement est indisponible. Tous les articles accessibles sont affichés.",en:"This event is unavailable. All accessible items are shown.",de:"Diese Veranstaltung ist nicht verfügbar. Alle zugänglichen Artikel werden angezeigt."} as const)[locale]}</p>}
  {slug==="inventory"&&<section className="rounded-2xl border bg-card p-5">
   <h2 className="text-lg font-semibold">{({nl:"Filter op evenement",fr:"Filtrer par événement",en:"Filter by event",de:"Nach Veranstaltung filtern"} as const)[locale]}</h2>
   {inventoryFilterEvents?.error?<p className="mt-2 text-sm text-muted-foreground">{({nl:"Evenementen konden niet worden geladen.",fr:"Impossible de charger les événements.",en:"Events could not be loaded.",de:"Veranstaltungen konnten nicht geladen werden."} as const)[locale]}</p>
   :<div className="mt-3 flex flex-wrap gap-2">
    <Link href="/portals/administration/modules/inventory" aria-current={!selectedEvent?"page":undefined} className={`rounded-lg border px-3 py-2 text-sm ${!selectedEvent?"border-violet-500 font-semibold":"hover:border-violet-400"}`}>{({nl:"Alle evenementen",fr:"Tous les événements",en:"All events",de:"Alle Veranstaltungen"} as const)[locale]}</Link>
    {(inventoryFilterEvents?.data??[]).map(event=><Link key={event.id} href={`/portals/administration/modules/inventory?event=${encodeURIComponent(event.id)}`} aria-current={selectedEvent===event.id?"page":undefined} className={`rounded-lg border px-3 py-2 text-sm ${selectedEvent===event.id?"border-violet-500 font-semibold":"hover:border-violet-400"}`}>{event.name}</Link>)}
   </div>}
  </section>}
  {slug==="inventory"&&inventoryCount?.error&&<p role="status" className="text-sm text-muted-foreground">{({nl:"Totaal aantal materialen niet beschikbaar.",fr:"Nombre total d’articles indisponible.",en:"Total item count unavailable.",de:"Gesamtanzahl der Artikel nicht verfügbar."} as const)[locale]}</p>}
  {slug==="inventory"&&!summaryComplete&&!liveRecords?.error&&<p role="status" className="rounded-xl border p-3 text-sm text-muted-foreground">{({nl:"Volledige afwijkingstotalen zijn niet beschikbaar (meer dan 5.000 materialen of een onvolledige opvraging). De materialenlijst blijft bruikbaar.",fr:"Totaux complets indisponibles (plus de 5 000 articles ou lecture incomplète). La liste reste accessible.",en:"Complete discrepancy totals are unavailable (over 5,000 items or an incomplete query). The item list remains available.",de:"Vollständige Abweichungssummen nicht verfügbar (über 5.000 Artikel oder unvollständige Abfrage). Die Artikelliste bleibt verfügbar."} as const)[locale]}</p>}
  {slug==="inventory"&&inventorySummary.size>0&&<section className="rounded-2xl border bg-card p-5">
   <h2 className="text-lg font-semibold">{({nl:"Afwijkingen per evenement",fr:"Écarts par événement",en:"Discrepancies by event",de:"Abweichungen pro Veranstaltung"} as const)[locale]}</h2>
   <div className="mt-3 space-y-2">{[...inventorySummary.entries()].map(([eventId,summary])=><div key={eventId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
    <span className="font-medium">{eventId==="__unassigned__"?({nl:"Niet aan evenement gekoppeld",fr:"Sans événement associé",en:"Not linked to an event",de:"Keiner Veranstaltung zugeordnet"} as const)[locale]:inventoryEvents?.error ? ({nl:"Evenementgegevens niet beschikbaar",fr:"Données événement indisponibles",en:"Event details unavailable",de:"Veranstaltungsdaten nicht verfügbar"} as const)[locale] : inventoryEventNames.get(eventId)??({nl:"Onbekend evenement",fr:"Événement inconnu",en:"Unknown event",de:"Unbekannte Veranstaltung"} as const)[locale]}</span>
    <span className="text-xs text-muted-foreground">{({nl:"Materialen",fr:"Articles",en:"Items",de:"Artikel"} as const)[locale]}: {summary.items} · {({nl:"Ontbreekt",fr:"Manquant",en:"Missing",de:"Fehlt"} as const)[locale]}: {summary.missing} · {({nl:"Beschadigd",fr:"Endommagé",en:"Damaged",de:"Beschädigt"} as const)[locale]}: {summary.damaged}</span>
   </div>)}</div>
  </section>}
  {liveRecords&&<section className="rounded-2xl border bg-card p-5">
   <h2 className="text-lg font-semibold">{({nl:"Actuele gegevens",fr:"Données actuelles",en:"Live records",de:"Aktuelle Daten"} as const)[locale]}</h2>
   {liveRecords.error?<p className="mt-3 text-sm text-muted-foreground">{({nl:"Gegevens niet beschikbaar voor deze gebruiker.",fr:"Données indisponibles pour cet utilisateur.",en:"Records unavailable for this user.",de:"Daten für diesen Benutzer nicht verfügbar."} as const)[locale]}</p>
    :!liveRecords.data?.length?<p className="mt-3 text-sm text-muted-foreground">{({nl:"Geen records gevonden.",fr:"Aucun enregistrement trouvé.",en:"No records found.",de:"Keine Einträge gefunden."} as const)[locale]}</p>
    :<div className="mt-3 space-y-2">{liveRecords.data.map((record,index)=><div key={String(record.id??index)} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"><span className="min-w-0 truncate font-medium">{String(record.name ?? record.id)}{slug==="inventory"&&"event_id" in record&&record.event_id&&<span className="block text-xs font-normal text-muted-foreground">{({nl:"Evenement",fr:"Événement",en:"Event",de:"Veranstaltung"} as const)[locale]}: {inventoryEvents?.error ? ({nl:"Evenementgegevens niet beschikbaar",fr:"Données événement indisponibles",en:"Event details unavailable",de:"Veranstaltungsdaten nicht verfügbar"} as const)[locale] : inventoryEventNames.get(record.event_id)??({nl:"Onbekend evenement",fr:"Événement inconnu",en:"Unknown event",de:"Unbekannte Veranstaltung"} as const)[locale]}</span>}</span><span className="shrink-0 text-xs text-muted-foreground">{slug==="inventory" ? `${({nl:"Ontbreekt",fr:"Manquant",en:"Missing",de:"Fehlt"} as const)[locale]}: ${"missing_quantity" in record ? record.missing_quantity ?? 0 : 0} · ${({nl:"Beschadigd",fr:"Endommagé",en:"Damaged",de:"Beschädigt"} as const)[locale]}: ${"damaged_quantity" in record ? record.damaged_quantity ?? 0 : 0}` : String("status" in record ? record.status ?? "—" : "—")}</span></div>)}</div>}
  </section>}
  {slug==="inventory"&&liveRecords&&!liveRecords.error&&<nav aria-label={({nl:"Inventarispagina's",fr:"Pages d’inventaire",en:"Inventory pages",de:"Inventarseiten"} as const)[locale]} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm">
   <span>{({nl:"Pagina",fr:"Page",en:"Page",de:"Seite"} as const)[locale]} {inventoryPage}{inventoryCount?.count!=null?` · ${inventoryCount.count} ${({nl:"materialen",fr:"articles",en:"items",de:"Artikel"} as const)[locale]}`:""}</span>
   <div className="flex gap-2">
    {inventoryPage>1&&<Link className="rounded-lg border px-3 py-2" href={`/portals/administration/modules/inventory?page=${inventoryPage-1}${selectedEvent?`&event=${encodeURIComponent(selectedEvent)}`:""}`}>{({nl:"Vorige",fr:"Précédente",en:"Previous",de:"Zurück"} as const)[locale]}</Link>}
    {(inventoryCount?.count!=null?inventoryPage*inventoryPageSize<inventoryCount.count:(liveRecords.data?.length??0)===inventoryPageSize)&&<Link className="rounded-lg border px-3 py-2" href={`/portals/administration/modules/inventory?page=${inventoryPage+1}${selectedEvent?`&event=${encodeURIComponent(selectedEvent)}`:""}`}>{({nl:"Volgende",fr:"Suivante",en:"Next",de:"Weiter"} as const)[locale]}</Link>}
   </div>
  </nav>}
  <section className="grid gap-4 md:grid-cols-3" aria-label={u.section}>
   {sections.map((section,index)=><article key={index} className="flex min-h-48 flex-col rounded-2xl border bg-card p-5">
    <div className="mb-4 flex items-start justify-between gap-3"><h2 className="font-semibold">{section[locale]}</h2><span aria-hidden="true" className="text-violet-400">◈</span></div>
    <div className="mt-auto rounded-xl border border-dashed bg-background/50 p-4">
     <p className="text-sm text-muted-foreground">{u.notAvailable}</p>
     <p className="mt-3 text-xs font-medium text-violet-400">{u.pending}</p>
    </div>
   </article>)}
  </section>
  {(slug==="invoices"||slug==="banking")&&<section className="rounded-2xl border border-violet-500/40 bg-card p-5">
   <h2 className="text-lg font-semibold">{({nl:"Financiële documenten beheren",fr:"Gérer les documents financiers",en:"Manage financial documents",de:"Finanzdokumente verwalten"} as const)[locale]}</h2>
   <p className="mt-2 text-sm text-muted-foreground">{({nl:"Open het bestaande financiële register om concepten, bijlagen, betalingsstatussen en goedkeuringsstappen te beheren.",fr:"Ouvrez le registre financier pour gérer brouillons, pièces jointes, paiements et validations.",en:"Open the existing financial register to manage drafts, attachments, payment status and approval steps.",de:"Öffnen Sie das Finanzregister für Entwürfe, Anhänge, Zahlungsstatus und Freigaben."} as const)[locale]}</p>
   <Link href="/portals/administration/finance" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700">{u.finance} →</Link>
  </section>}
  {slug==="notifications"&&<section className="rounded-2xl border bg-card p-5">
   <h2 className="text-lg font-semibold">{({nl:"Meldingen beheren",fr:"Gérer les notifications",en:"Manage notifications",de:"Benachrichtigungen verwalten"} as const)[locale]}</h2>
   <p className="mt-2 text-sm text-muted-foreground">{({nl:"Open de bestaande meldingenpagina om berichten en actiepunten te bekijken.",fr:"Ouvrez la page des notifications pour consulter les messages et actions.",en:"Open the existing notifications page to review messages and action items.",de:"Öffnen Sie die Benachrichtigungsseite, um Nachrichten und Aufgaben zu prüfen."} as const)[locale]}</p>
   <Link href="/notifications" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700">{({nl:"Open meldingen",fr:"Ouvrir les notifications",en:"Open notifications",de:"Benachrichtigungen öffnen"} as const)[locale]} →</Link>
  </section>}
  {slug==="tasks"&&<section className="rounded-2xl border bg-card p-5">
   <h2 className="text-lg font-semibold">{({nl:"Taken opvolgen",fr:"Suivi des tâches",en:"Track tasks",de:"Aufgaben verfolgen"} as const)[locale]}</h2>
   <Link href="/tasks" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700">{({nl:"Open taken",fr:"Ouvrir les tâches",en:"Open tasks",de:"Aufgaben öffnen"} as const)[locale]} →</Link>
  </section>}
  {slug==="staff"&&<section className="rounded-2xl border bg-card p-5"><Link href="/portals/administration/rosters" className="inline-flex rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700">{({nl:"Administratieve werkroosters",fr:"Plannings administratifs",en:"Administrative rosters",de:"Administrative Dienstpläne"} as const)[locale]} →</Link></section>}
  {financeRelated.has(slug)&&<section className="rounded-2xl border bg-card p-5">
   <h2 className="font-semibold">{u.related}</h2>
   <Link href="/portals/administration/finance" className="mt-3 inline-flex rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700">{u.finance} →</Link>
  </section>}
 </main>
}
