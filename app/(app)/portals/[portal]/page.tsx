import Link from 'next/link'
import {PortalGuidedTour} from '@/components/portal-guided-tour'
import { cookies, headers } from 'next/headers'
import { parseAcceptLanguage, parseUiLocale } from '@/lib/locale-preferences'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
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
  if (error && !current.isAdmin) return <main className="p-6"><h1 className="text-xl font-bold">{t.unavailable}</h1><p className="mt-3">{t.unavailableDesc}</p><Link href="/portals" className="mt-4 inline-block text-violet-400">{t.returnToPortals}</Link></main>
  if (!current.isAdmin && !canOpenPortal(portal, (data ?? []) as PortalAssignment[], {
    approved: current.approved,
    blocked: current.account_blocked === true,
  })) notFound()

  if (!current.approved || current.account_blocked === true) redirect('/portals')

  const submittedTimesheets = portal === 'administration'
    ? await supabase.from('timesheets').select('id,event_id,user_id,status,submitted_at').eq('status','submitted').order('submitted_at',{ascending:false}).limit(100)
    : null
  const inventoryAlerts = portal === 'administration'
    ? await supabase.from('inventory_items').select('id,name,missing_quantity,damaged_quantity,event_id').or('missing_quantity.gt.0,damaged_quantity.gt.0').limit(100)
    : null
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
    <header data-portal-tour="portal-overview"><h1 className="text-2xl font-bold">{promotion ? t.promotion : t.administration}</h1></header>
    <PortalGuidedTour portal={portal} locale={locale}/>
    {promotion ? <div className="grid gap-4 sm:grid-cols-2">
      <section data-portal-tour="portal-chats" className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">{t.chats}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.chatDesc}</p>
        {promotionChats.length ? <ul className="mt-3 space-y-2">{promotionChats.map(channel => <li key={channel.id}><Link href={`/chat?channel=${encodeURIComponent(channel.id)}`} className="text-violet-400 underline">{channel.name}</Link></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">{t.promoChatEmpty}</p>}
        <Link href="/chat" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">{t.chatLink}</Link>
      </section>
      <section data-portal-tour="portal-tasks" className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">{t.tasks}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.taskDesc}</p>
        <Link href="/tasks" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">{t.taskLink}</Link>
      </section>
      <section data-portal-tour="portal-notifications" className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">{t.meldingen}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.meldingenDesc}</p>
        <Link href="/notifications" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">{t.meldingenLink}</Link>
      </section>
    </div> : <div className="grid gap-4 sm:grid-cols-2">
      <section data-portal-tour="portal-finance" className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">{t.administration}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.financeDesc}</p>
        <Link href="/portals/administration/finance" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">{t.administration} →</Link>
      </section>
      <section data-portal-tour="portal-timesheets" className="rounded-2xl border bg-card p-5 sm:col-span-2">
        <h2 className="font-semibold">{locale==='nl'?'Ingediende werkstaten':locale==='fr'?'Feuilles de temps soumises':locale==='de'?'Eingereichte Stundenzettel':'Submitted timesheets'}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{locale==='nl'?'Ingediende uren verschijnen hier automatisch na indiening. Goedkeuring blijft voorbehouden aan bevoegde beheerders.':locale==='fr'?'Les heures soumises apparaissent automatiquement ici. La validation reste réservée aux responsables autorisés.':locale==='de'?'Eingereichte Stunden erscheinen hier automatisch. Die Freigabe bleibt berechtigten Administratoren vorbehalten.':'Submitted hours appear here automatically. Approval remains restricted to authorized administrators.'}</p>
        {submittedTimesheets?.error ? <p role="alert" className="mt-3 text-sm text-amber-500">{t.unavailableDesc}</p> : submittedTimesheets?.data?.length ? <ul className="mt-3 space-y-2">{submittedTimesheets.data.map(row=><li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><span className="text-sm">{row.submitted_at ? new Date(row.submitted_at).toLocaleString(locale==='nl'?'nl-BE':locale==='fr'?'fr-BE':locale==='de'?'de-BE':'en-BE') : '—'} · {row.user_id.slice(0,8)}</span><Link className="text-sm text-violet-400 underline" href={`/timesheets?event=${encodeURIComponent(row.event_id)}`}>{locale==='nl'?'Bekijken':locale==='fr'?'Consulter':locale==='de'?'Ansehen':'View'}</Link></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">{locale==='nl'?'Geen ingediende werkstaten.':locale==='fr'?'Aucune feuille soumise.':locale==='de'?'Keine eingereichten Stundenzettel.':'No submitted timesheets.'}</p>}
      </section>
      <section data-portal-tour="portal-inventory" className="rounded-2xl border bg-card p-5 sm:col-span-2">
        <h2 className="font-semibold">{locale==='nl'?'Inventarisafwijkingen':locale==='fr'?'Écarts de stock':locale==='de'?'Bestandsabweichungen':'Inventory discrepancies'}</h2>
        {inventoryAlerts?.error ? <p role="alert" className="mt-2 text-sm text-amber-500">{t.unavailableDesc}</p> : inventoryAlerts?.data?.length ? <ul className="mt-3 space-y-2">{inventoryAlerts.data.map(item=><li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><span>{item.name} · {locale==='nl'?'Ontbrekend':locale==='fr'?'Manquant':locale==='de'?'Fehlend':'Missing'}: {item.missing_quantity} · {locale==='nl'?'Beschadigd':locale==='fr'?'Endommagé':locale==='de'?'Beschädigt':'Damaged'}: {item.damaged_quantity}</span><Link href="/inventory" className="text-violet-400 underline">{locale==='nl'?'Inventaris':locale==='fr'?'Inventaire':locale==='de'?'Inventar':'Inventory'}</Link></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">{locale==='nl'?'Geen afwijkingen zichtbaar.':locale==='fr'?'Aucun écart visible.':locale==='de'?'Keine Abweichungen sichtbar.':'No discrepancies visible.'}</p>}
      </section>
      {current.isAdmin && <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">{t.sales}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.reportDesc}</p>
        <Link href="/sales" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">{t.salesLink}</Link>
      </section>}
    </div>}
  </main>
}
