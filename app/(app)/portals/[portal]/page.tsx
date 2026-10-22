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

  if (!current.approved || current.account_blocked === true) redirect('/portals')

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
    </div> : <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">{t.administration}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.financeDesc}</p>
        <Link href="/portals/administration/finance" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">{t.administration} →</Link>
      </section>
      {current.isAdmin && <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">{t.sales}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.reportDesc}</p>
        <Link href="/sales" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">{t.salesLink}</Link>
      </section>}
    </div>}
  </main>
}
