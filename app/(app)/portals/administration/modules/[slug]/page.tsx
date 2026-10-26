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

export default async function AdministrationModulePage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params
 const adminModule=administrationModules.find(item=>item.slug===slug&&slug!=="dashboard"&&slug!=="finance")
 if(!adminModule)notFound()
 const current=await getCurrentUser()
 if(!current)redirect("/login")
 if((!current.approved||Boolean(current.account_blocked))&&!current.isOwner)redirect("/portals")
 const supabase=await createClient()
 const {data,error}=await supabase.rpc("upt_my_portal_assignments")
 if(error&&!current.isAdmin && !current.isOwner)redirect("/portals")
 if(!current.isAdmin && !current.isOwner&&!canOpenPortal("administration",(data??[]) as PortalAssignment[],{approved:current.approved,blocked:current.account_blocked===true}))redirect("/portals")
 // Use the real operational workflows instead of presenting placeholder cards.
 const operationalRoutes:Record<string,string>={
  tasks:"/tasks",
  notifications:"/notifications",
  invoices:"/portals/administration/finance",
  banking:"/portals/administration/finance",
  documents:"/portals/administration/finance",
  staff:"/portals/administration/rosters",
  reports:"/portals/administration/overview",
 }
 if(operationalRoutes[slug])redirect(operationalRoutes[slug])
 const liveRecords = slug==="events"
  ? await supabase.from("events").select("id,name,status,start_at").order("start_at",{ascending:false}).limit(30)
  : slug==="staff"
    ? await supabase.from("timesheets").select("id,status,submitted_at,event_id").order("submitted_at",{ascending:false}).limit(30)
    : slug==="inventory"
      ? await supabase.from("inventory_items").select("id,name,missing_quantity,damaged_quantity,event_id").limit(30)
      : null
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
  {liveRecords&&<section className="rounded-2xl border bg-card p-5">
   <h2 className="text-lg font-semibold">{({nl:"Actuele gegevens",fr:"Données actuelles",en:"Live records",de:"Aktuelle Daten"} as const)[locale]}</h2>
   {liveRecords.error?<p className="mt-3 text-sm text-muted-foreground">{({nl:"Gegevens niet beschikbaar voor deze gebruiker.",fr:"Données indisponibles pour cet utilisateur.",en:"Records unavailable for this user.",de:"Daten für diesen Benutzer nicht verfügbar."} as const)[locale]}</p>
    :!liveRecords.data?.length?<p className="mt-3 text-sm text-muted-foreground">{({nl:"Geen records gevonden.",fr:"Aucun enregistrement trouvé.",en:"No records found.",de:"Keine Einträge gefunden."} as const)[locale]}</p>
    :<div className="mt-3 space-y-2">{liveRecords.data.map((record,index)=><div key={String(record.id??index)} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"><span className="min-w-0 truncate font-medium">{String("name" in record?record.name??record.id:record.id)}</span><span className="shrink-0 text-xs text-muted-foreground">{String("status" in record?record.status??"—":("missing_quantity" in record?record.missing_quantity??0:0))}</span></div>)}</div>}
  </section>}
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
