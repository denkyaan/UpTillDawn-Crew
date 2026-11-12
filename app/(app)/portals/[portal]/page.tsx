import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { parseAcceptLanguage, parseUiLocale } from '@/lib/locale-preferences'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
import { AdministrationOverviewDashboard } from '@/components/administration/administration-overview-dashboard'
import { canOpenPortal, type PortalAssignment } from '@/lib/portal-access'

const portalCopy = {
  nl: { unavailable: "Portaal niet beschikbaar", unavailableDesc: "De toegangscontrole kan momenteel niet worden uitgevoerd. Probeer later opnieuw.", returnToPortals: "Terug naar portalen", promoChatEmpty: "Er zijn nog geen promotiegesprekken beschikbaar voor jouw account.", chatDesc: "Open de bestaande chatkanalen waarvoor je toegang hebt.", chatLink: "Chats →", taskDesc: "Bekijk je bestaande opdrachten.", taskLink: "Taken →", financeDesc: "Open het financiële overzicht voor documenten, inkomsten, uitgaven en betalingsopvolging.", reportDesc: "Bestaande rapportage voor beheerders.", salesLink: "Sales →", back: "← Alle portalen", promotion: "Promotie", administration: "Administratie", meldingen: "Meldingen",meldingenDesc: "Bekijk nieuwe berichten, opdrachten en updates.",meldingenLink: "Meldingen →", chats: "Chats", tasks: "Taken", sales: "Sales" },
  fr: { unavailable: "Portail indisponible", unavailableDesc: "Le contrôle d’accès ne peut pas être effectué actuellement. Veuillez réessayer plus tard.", returnToPortals: "Retour aux portails", promoChatEmpty: "Aucune discussion promotionnelle disponible pour votre compte.", chatDesc: "Ouvrez les canaux de discussion auxquels vous avez accès.", chatLink: "Discussions →", taskDesc: "Consultez vos tâches existantes.", taskLink: "Tâches →", financeDesc: "Ouvrez le suivi financier des documents, recettes, dépenses et paiements.", reportDesc: "Rapports existants réservés aux administrateurs.", salesLink: "Ventes →", back: "← Tous les portails", promotion: "Promotion", administration: "Administration", meldingen: "Notifications",meldingenDesc: "Consultez les nouveaux messages, tâches et mises à jour.",meldingenLink: "Notifications →", chats: "Discussions", tasks: "Tâches", sales: "Ventes" },
  en: { unavailable: "Portal unavailable", unavailableDesc: "Access verification is currently unavailable. Please try again later.", returnToPortals: "Back to portals", promoChatEmpty: "No promotion chats are available for your account yet.", chatDesc: "Open the existing chat channels you can access.", chatLink: "Chats →", taskDesc: "View your existing tasks.", taskLink: "Tasks →", financeDesc: "Open financial management for documents, income, expenses and payment tracking.", reportDesc: "Existing reports for administrators.", salesLink: "Sales →", back: "← All portals", promotion: "Promotion", administration: "Administration", meldingen: "Notifications",meldingenDesc: "Review new messages, tasks and updates.",meldingenLink: "Notifications →", chats: "Chats", tasks: "Tasks", sales: "Sales" },
  de: { unavailable: "Portal nicht verfügbar", unavailableDesc: "Die Zugriffsprüfung ist derzeit nicht verfügbar. Bitte versuche es später erneut.", returnToPortals: "Zurück zu den Portalen", promoChatEmpty: "Für dein Konto sind noch keine Promotion-Chats verfügbar.", chatDesc: "Öffne die bestehenden Chatkanäle, auf die du Zugriff hast.", chatLink: "Chats →", taskDesc: "Sieh dir deine bestehenden Aufgaben an.", taskLink: "Aufgaben →", financeDesc: "Öffne die Finanzverwaltung für Dokumente, Einnahmen, Ausgaben und Zahlungen.", reportDesc: "Bestehende Berichte für Administratoren.", salesLink: "Verkäufe →", back: "← Alle Portale", promotion: "Promotion", administration: "Verwaltung", meldingen: "Benachrichtigungen",meldingenDesc: "Sieh dir neue Nachrichten, Aufgaben und Updates an.",meldingenLink: "Benachrichtigungen →", chats: "Chats", tasks: "Aufgaben", sales: "Verkäufe" },
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
  if (error && !current.realIsAdmin && !current.isOwner) return <main className="p-6"><h1 className="text-xl font-bold">{t.unavailable}</h1><p className="mt-3">{t.unavailableDesc}</p><Link href="/portals" className="mt-4 inline-block text-violet-400">{t.returnToPortals}</Link></main>
  if (!current.realIsAdmin && !current.isOwner && !canOpenPortal(portal, (data ?? []) as PortalAssignment[], {
    approved: current.approved,
    blocked: current.account_blocked === true,
  })) return <main className="mx-auto max-w-3xl space-y-4 p-6" role="alert">
    <h1 className="text-2xl font-bold">{({nl:"Geen toegang tot dit portaal",fr:"Accès à ce portail refusé",en:"No access to this portal",de:"Kein Zugang zu diesem Portal"} as const)[locale]}</h1>
    <p>{({nl:"Je account heeft geen goedgekeurde rol voor dit portaal. Controleer je portaalrollen of vraag een beheerder om toegang.",fr:"Votre compte ne possède pas de rôle approuvé pour ce portail. Vérifiez vos rôles ou contactez un administrateur.",en:"Your account has no approved role for this portal. Check your portal roles or contact an administrator.",de:"Dein Konto hat keine genehmigte Rolle für dieses Portal. Prüfe deine Portalrollen oder kontaktiere einen Administrator."} as const)[locale]}</p>
    <Link href="/portals/roles" className="inline-flex rounded-lg border border-violet-500 px-4 py-2 text-violet-400">{({nl:"Mijn portaalrollen",fr:"Mes rôles de portail",en:"My portal roles",de:"Meine Portalrollen"} as const)[locale]}</Link>
  </main>

  if ((!current.approved || current.account_blocked === true) && !current.isOwner) redirect('/portals')

  // Each administrative module is available once through the persistent
  // six-category navigation. The home page is a compact read-only work pulse.
  if (portal === 'administration') return <AdministrationOverviewDashboard locale={locale} />

  // Promotion keeps its own independent portal and existing safe channel links.
  const {data:promotionChats}=await supabase.from('chat_channels')
    .select('id,name').eq('kind','organization')
    .in('name',['Promo groep Up Till Dawn','Up Till Dawn · Promotie'])
    .order('name')

  return <main className="mx-auto max-w-4xl space-y-6 p-6">
   <header className="space-y-2">
    <h1 className="text-2xl font-bold">{t.promotion}</h1>
    <p className="text-sm text-muted-foreground">{({nl:"Bekijk je opdrachten, overleg met het promotieteam en volg nieuwe meldingen. Bewijsstukken gelden pas als voltooid na controle.",fr:"Consultez les tâches et les discussions de l'équipe ainsi que les notifications. Les justificatifs doivent être vérifiés.",en:"Review promotion tasks, team chats and new notifications. Evidence requires verification before completion.",de:"Sieh dir Promotionaufgaben, Teamchats und Meldungen an. Nachweise müssen vor Abschluss geprüft werden."} as const)[locale]}</p>
   </header>
   <div className="grid gap-4 sm:grid-cols-2">
    <section className="rounded-2xl border bg-card p-5">
     <h2 className="font-semibold">{t.chats}</h2>
     <p className="mt-2 text-sm text-muted-foreground">{t.chatDesc}</p>
     {promotionChats?.length?<ul className="mt-3 space-y-2">{promotionChats.map(channel=><li key={channel.id}><Link href={`/chat?channel=${encodeURIComponent(channel.id)}`} className="text-violet-400 underline">{channel.name}</Link></li>)}</ul>:<p className="mt-3 text-sm text-muted-foreground">{t.promoChatEmpty}</p>}
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
   </div>
  </main>
}
