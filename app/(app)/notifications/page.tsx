import { createClient } from '@/lib/supabase/crew-server'
import { markNotificationRead } from '@/lib/actions/uptilldawn'
import { nlStatus } from '@/lib/ui-nl'
import { PushNotificationSettings } from '@/components/push-notification-settings'
import { NotificationBadgeSync } from '@/components/notification-badge-sync'
import { NotificationOpenLink } from '@/components/admin/notification-open-link'
import { requestUiLocale } from '@/lib/server-locale'
import { translateRuntimeUi } from '@/lib/ui-translation-runtime'

export const dynamic = 'force-dynamic'

function safeNotificationLink(value:string|null){
  return value
    && value.startsWith('/')
    && !value.startsWith('//')
    && !value.includes('\\')
    ? value
    : null
}

export default async function Page() {
  const [s,locale] = await Promise.all([createClient(),requestUiLocale()])
  const { data: { user } } = await s.auth.getUser()
  if (!user) return null

  const [{data,error},{data:badgeCount,error:badgeError}] = await Promise.all([
    s.from('crew_notifications')
      .select('id,title,body,kind,link,read_at,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
    s.rpc('upt_notification_badge_count'),
  ])

  if(badgeError)console.error('[Notifications] badge count',badgeError.code)

  return <main className="space-y-4 p-4 md:p-8">
    <NotificationBadgeSync count={badgeCount??0}/>
    <h1 className="text-3xl font-black">{translateRuntimeUi("Meldingen",locale)}</h1>
    <PushNotificationSettings/>
    {error ? <p>{translateRuntimeUi("Meldingen konden niet worden geladen.",locale)}</p> : !data?.length ? <p>{translateRuntimeUi("Geen meldingen.",locale)}</p> : data.map(n => {
      const safeLink=safeNotificationLink(n.link)
      return <article key={n.id} className={`rounded-xl border p-4 ${n.read_at ? '' : 'border-violet-500'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold">{translateRuntimeUi(n.title,locale)}</h2>
            {n.body && <p className="mt-1 text-sm">{translateRuntimeUi(n.body,locale)}</p>}
            <p className="mt-2 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString(locale==='nl'?'nl-BE':locale==='fr'?'fr-BE':locale==='de'?'de-BE':'en-BE')} · {translateRuntimeUi(nlStatus(n.kind),locale)}</p>
          </div>
          {!n.read_at && <span className="rounded-full bg-violet-500/20 px-2 py-1 text-xs font-bold text-violet-300">{translateRuntimeUi("NIEUW",locale)}</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {safeLink && <NotificationOpenLink href={safeLink} title={translateRuntimeUi("Opent direct in de juiste context",locale)} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold">{translateRuntimeUi("OPENEN",locale)}</NotificationOpenLink>}
          {!n.read_at && <form action={markNotificationRead}>
            <input type="hidden" name="notification_id" value={n.id}/>
            <button className="rounded-lg border px-3 py-2 text-sm">{translateRuntimeUi("Markeer gelezen",locale)}</button>
          </form>}
        </div>
      </article>
    })}
  </main>
}
