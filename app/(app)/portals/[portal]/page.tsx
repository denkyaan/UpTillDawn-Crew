import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { parseAcceptLanguage, parseUiLocale } from '@/lib/locale-preferences'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
import { canOpenPortal, type PortalAssignment } from '@/lib/portal-access'

const portalCopy = {
  nl: { unavailable: "Portaal niet beschikbaar", unavailableDesc: "De toegangscontrole kan momenteel niet worden uitgevoerd. Probeer later opnieuw.", returnToPortals: "Terug naar portalen", promoChatEmpty: "Er zijn nog geen promotiegesprekken beschikbaar voor jouw account.", chatDesc: "Open de bestaande chatkanalen waarvoor je toegang hebt.", chatLink: "Chats →", taskDesc: "Bekijk je bestaande opdrachten.", taskLink: "Taken →", financeDesc: "Financiële workflows zijn nog niet beschikbaar.", reportDesc: "Bestaande rapportage voor beheerders.", salesLink: "Sales →", back: "← Alle portalen", promotion: "Promotie", administration: "Administratie", meldingen: "Meldingen",meldingenDesc: "Bekijk nieuwe berichten, opdrachten en updates.",meldingenLink: "Meldingen →", chats: "Chats", tasks: "Taken", sales: "Sales" },
  fr: { unavailable: "Portail indisponible", unavailableDesc: "Le contrôle d’accès ne peut pas être effectué actuellement. Veuillez réessayer plus tard.", returnToPortals: "Retour aux portails", promoChatEmpty: "Aucune discussion promotionnelle disponible pour votre compte.", chatDesc: "Ouvrez les canaux de discussion auxquels vous avez accès.", chatLink: "Discussions →", taskDesc: "Consultez vos tâches existantes.", taskLink: "Tâches →", financeDesc: "Les processus financiers ne sont pas encore disponibles.", reportDesc: "Rapports existants réservés aux administrateurs.", salesLink: "Ventes →", back: "← Tous les portails", promotion: "Promotion", administration: "Administration", meldingen: "Notifications",meldingenDesc: "Consultez les nouveaux messages, tâches et mises à jour.",meldingenLink: "Notifications →", chats: "Discussions", tasks: "Tâches", sales: "Ventes" },
  en: { unavailable: "Portal unavailable", unavailableDesc: "Access verification is currently unavailable. Please try again later.", returnToPortals: "Back to portals", promoChatEmpty: "No promotion chats are available for your account yet.", chatDesc: "Open the existing chat channels you can access.", chatLink: "Chats →", taskDesc: "View your existing tasks.", taskLink: "Tasks →", financeDesc: "Financial workflows are not yet available.", reportDesc: "Existing reports for administrators.", salesLink: "Sales →", back: "← All portals", promotion: "Promotion", administration: "Administration", meldingen: "Notifications",meldingenDesc: "Review new messages, tasks and updates.",meldingenLink: "Notifications →", chats: "Chats", tasks: "Tasks", sales: "Sales" },
  de: { unavailable: "Portal nicht verfügbar", unavailableDesc: "Die Zugriffsprüfung ist derzeit nicht verfügbar. Bitte versuche es später erneut.", returnToPortals: "Zurück zu den Portalen", promoChatEmpty: "Für dein Konto sind noch keine Promotion-Chats verfügbar.", chatDesc: "Öffne die bestehenden Chatkanäle, auf die du Zugriff hast.", chatLink: "Chats →", taskDesc: "Sieh dir deine bestehenden Aufgaben an.", taskLink: "Aufgaben →", financeDesc: "Finanzielle Abläufe sind noch nicht verfügbar.", reportDesc: "Bestehende Berichte für Administratoren.", salesLink: "Verkäufe →", back: "← Alle Portale", promotion: "Promotion", administration: "Verwaltung", meldingen: "Benachrichtigungen",meldingenDesc: "Sieh dir neue Nachrichten, Aufgaben und Updates an.",meldingenLink: "Benachrichtigungen →", chats: "Chats", tasks: "Aufgaben", sales: "Verkäufe" },
} as const

export const dynamic = 'force-dynamic'

export default async function PortalPage({ params }: { params: Promise<{ portal: string }> }) {
  const { portal } = await params
  if (portal !== 'promotion' && portal !== 'administration') notFound()
  const current = await getCurrentUser()
  if (!current) redirect('/login')
  const requestHeaders = await headers()
  const cookieLocale = parseUiLocale((await cookies()).get('uptilldawn-language')?.value)
  const locale = cookieLocale ?? parseAcceptLanguage(requestHeaders.get('accept-language')) ?? 'nl'
  const t = portalCopy[locale]
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('upt_my_portal_assignments')
  if (error && !current.isAdmin) return <main className="p-6"><h1 className="text-xl font-bold">{t.unavailable}</h1><p className="mt-3">{t.unavailableDesc}</p><Link href="/portals" className="mt-4 inline-block text-violet-400">{t.returnToPortals}</Link></main>
  if (!current.isAdmin && !canOpenPortal(portal, (data ?? []) as PortalAssignment[], {
    approved: current.approved,
    blocked: current.account_blocked === true,
  })) notFound()

  const financialSummary = portal === 'administration' ? await supabase.from('admin_financial_documents').select('kind,status,gross_amount') : null
  const financialRows = financialSummary?.data ?? []
  const income = financialRows.filter(r => r.kind === 'sales_invoice' && r.status !== 'void').reduce((n,r) => n + Number(r.gross_amount ?? 0), 0)
  const expenses = financialRows.filter(r => ['purchase_invoice','expense'].includes(r.kind) && r.status !== 'void').reduce((n,r) => n + Number(r.gross_amount ?? 0), 0)
  const outstanding = financialRows.filter(r => ['issued','approved'].includes(r.status)).length
  const adminCopy = {
    nl: {title:'Administratief dashboard',intro:'Financieel overzicht en administratieve werkstromen',income:'Verkoopfacturen',expenses:'Uitgaven',outstanding:'Goedgekeurd of uitgegeven',counterparties:'Klanten en leveranciers',docs:'Financiële documenten',docsDesc:'Conceptfacturen aanmaken en documenten bekijken',shifts:'Werkroosters',shiftsDesc:'Bestaande shifts bekijken',tasks:'Taken',tasksDesc:'Bestaande opdrachten en deadlines bekijken',unavailable:'Financiële gegevens konden niet worden geladen.',pending:'Nog niet beschikbaar: uploads, automatische verwerking, betaalafstemming, boekhoudkoppeling en Peppol-verzending.',open:'Openen →'},
    fr: {title:'Tableau de bord administratif',intro:'Suivi financier et opérations administratives',income:'Factures de vente',expenses:'Dépenses',outstanding:'Approuvés ou émis',counterparties:'Clients et fournisseurs',docs:'Documents financiers',docsDesc:'Créer des brouillons et consulter les documents',shifts:'Plannings',shiftsDesc:'Consulter les horaires existants',tasks:'Tâches',tasksDesc:'Consulter les tâches et échéances',unavailable:'Impossible de charger les données financières.',pending:'Pas encore disponibles : imports, traitement automatique, rapprochement, connexion comptable et envoi Peppol.',open:'Ouvrir →'},
    en: {title:'Administration dashboard',intro:'Financial overview and administrative workflows',income:'Sales invoices',expenses:'Expenses',outstanding:'Approved or issued',counterparties:'Customers and suppliers',docs:'Financial documents',docsDesc:'Create drafts and review documents',shifts:'Work schedules',shiftsDesc:'View existing shifts',tasks:'Tasks',tasksDesc:'Review existing tasks and deadlines',unavailable:'Financial data could not be loaded.',pending:'Not yet available: uploads, automatic processing, payment reconciliation, accounting integration and Peppol sending.',open:'Open →'},
    de: {title:'Verwaltungsübersicht',intro:'Finanzen und Verwaltungsabläufe',income:'Ausgangsrechnungen',expenses:'Ausgaben',outstanding:'Genehmigt oder ausgestellt',counterparties:'Kunden und Lieferanten',docs:'Finanzdokumente',docsDesc:'Entwürfe erstellen und Dokumente ansehen',shifts:'Dienstpläne',shiftsDesc:'Vorhandene Schichten ansehen',tasks:'Aufgaben',tasksDesc:'Aufgaben und Fristen ansehen',unavailable:'Finanzdaten konnten nicht geladen werden.',pending:'Noch nicht verfügbar: Uploads, automatische Verarbeitung, Zahlungsabgleich, Buchhaltung und Peppol-Versand.',open:'Öffnen →'},
  } as const
  const a = adminCopy[locale]
  const promotion = portal === 'promotion'
  // Database RLS controls which organization chats this user may see.
  const promotionChats = promotion
    ? (await supabase.from('chat_channels')
        .select('id,name')
        .eq('kind', 'organization')
        .in('name', ['Promo groep Up Till Dawn', 'Up Till Dawn · Promotie'])
        .order('name')).data ?? []
    : []

  return <main className="mx-auto max-w-4xl space-y-6 p-6">
    <Link href="/portals" className="text-sm text-violet-400">{t.back}</Link>
    <header><h1 className="text-2xl font-bold">{promotion ? t.promotion : t.administration}</h1></header>
    {promotion ? <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">{t.chats}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.chatDesc}</p>
        {promotionChats.length ? <ul className="mt-3 space-y-2">{promotionChats.map(channel => <li key={channel.id}><Link href={`/chat?channel=${encodeURIComponent(channel.id)}`} className="text-violet-400 underline">{channel.name}</Link></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">{t.promoChatEmpty}</p>}
        <Link href="/chat" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">{t.chatLink}</Link>
      </section>
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">{t.tasks}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.taskDesc}</p>
        <Link href="/tasks" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">{t.taskLink}</Link>
      </section>
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">{t.meldingen}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.meldingenDesc}</p>
        <Link href="/notifications" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">{t.meldingenLink}</Link>
      </section>
    </div> : <div className="space-y-5">
      <div><h2 className="text-2xl font-bold">{a.title}</h2><p className="text-sm text-muted-foreground">{a.intro}</p></div>
      {financialSummary?.error && <p role="alert" className="rounded-xl border border-amber-500/50 p-3">{a.unavailable}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        {[[a.income, income.toLocaleString(locale, {style:'currency',currency:'EUR'})],[a.expenses,expenses.toLocaleString(locale,{style:'currency',currency:'EUR'})],[a.outstanding,String(outstanding)]] .map(([label,value])=><section key={label} className="rounded-2xl border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></section>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[[a.docs,a.docsDesc,'/portals/administration/finance'],[a.counterparties,a.counterparties,'/portals/administration/counterparties'],[a.shifts,a.shiftsDesc,'/shifts'],[a.tasks,a.tasksDesc,'/tasks']].map(([title,desc,href])=><Link key={href} href={href} className="rounded-2xl border bg-card p-5 hover:border-violet-500"><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{desc}</p><span className="mt-4 inline-block text-sm text-violet-400">{a.open}</span></Link>)}
      </div>
      <p className="rounded-xl border p-4 text-sm text-muted-foreground">{a.pending}</p>
    </div>}
  </main>
}
