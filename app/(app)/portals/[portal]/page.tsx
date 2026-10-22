import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { parseAcceptLanguage, parseUiLocale } from '@/lib/locale-preferences'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
import { canOpenPortal, type PortalAssignment } from '@/lib/portal-access'

const portalCopy = {
  nl: { unavailable: "Portaal niet beschikbaar", unavailableDesc: "De toegangscontrole kan momenteel niet worden uitgevoerd. Probeer later opnieuw.", returnToPortals: "Terug naar portalen", chatDesc: "Open de bestaande chatkanalen waarvoor je toegang hebt.", chatLink: "Chats →", taskDesc: "Bekijk je bestaande opdrachten.", taskLink: "Taken →", financeDesc: "Financiële workflows zijn nog niet beschikbaar.", reportDesc: "Bestaande rapportage voor beheerders.", salesLink: "Sales →", back: "← Alle portalen", promotion: "Promotie", administration: "Administratie", chats: "Chats", tasks: "Taken", sales: "Sales" },
  fr: { unavailable: "Portail indisponible", unavailableDesc: "Le contrôle d’accès ne peut pas être effectué actuellement. Veuillez réessayer plus tard.", returnToPortals: "Retour aux portails", chatDesc: "Ouvrez les canaux de discussion auxquels vous avez accès.", chatLink: "Discussions →", taskDesc: "Consultez vos tâches existantes.", taskLink: "Tâches →", financeDesc: "Les processus financiers ne sont pas encore disponibles.", reportDesc: "Rapports existants réservés aux administrateurs.", salesLink: "Ventes →", back: "← Tous les portails", promotion: "Promotion", administration: "Administration", chats: "Discussions", tasks: "Tâches", sales: "Ventes" },
  en: { unavailable: "Portal unavailable", unavailableDesc: "Access verification is currently unavailable. Please try again later.", returnToPortals: "Back to portals", chatDesc: "Open the existing chat channels you can access.", chatLink: "Chats →", taskDesc: "View your existing tasks.", taskLink: "Tasks →", financeDesc: "Financial workflows are not yet available.", reportDesc: "Existing reports for administrators.", salesLink: "Sales →", back: "← All portals", promotion: "Promotion", administration: "Administration", chats: "Chats", tasks: "Tasks", sales: "Sales" },
  de: { unavailable: "Portal nicht verfügbar", unavailableDesc: "Die Zugriffsprüfung ist derzeit nicht verfügbar. Bitte versuche es später erneut.", returnToPortals: "Zurück zu den Portalen", chatDesc: "Öffne die bestehenden Chatkanäle, auf die du Zugriff hast.", chatLink: "Chats →", taskDesc: "Sieh dir deine bestehenden Aufgaben an.", taskLink: "Aufgaben →", financeDesc: "Finanzielle Abläufe sind noch nicht verfügbar.", reportDesc: "Bestehende Berichte für Administratoren.", salesLink: "Verkäufe →", back: "← Alle Portale", promotion: "Promotion", administration: "Verwaltung", chats: "Chats", tasks: "Aufgaben", sales: "Verkäufe" },
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

  const promotion = portal === 'promotion'

  return <main className="mx-auto max-w-4xl space-y-6 p-6">
    <Link href="/portals" className="text-sm text-violet-400">{t.back}</Link>
    <header><h1 className="text-2xl font-bold">{promotion ? t.promotion : t.administration}</h1></header>
    {promotion ? <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">{t.chats}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.chatDesc}</p>
        <Link href="/chat" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">{t.chatLink}</Link>
      </section>
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">{t.tasks}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.taskDesc}</p>
        <Link href="/tasks" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">{t.taskLink}</Link>
      </section>
    </div> : <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">{t.administration}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.financeDesc}</p>
      </section>
      {current.isAdmin && <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">{t.sales}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.reportDesc}</p>
        <Link href="/sales" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">{t.salesLink}</Link>
      </section>}
    </div>}
  </main>
}
