import {listPage} from "@/lib/list-query"
import Link from 'next/link'
import { createClient } from '@/lib/supabase/crew-server'
import { markNotificationRead } from '@/lib/actions/uptilldawn'
import { nlStatus } from '@/lib/ui-nl'
import { NotificationBadgeSync } from '@/components/notification-badge-sync'
import { NotificationOpenLink } from '@/components/admin/notification-open-link'
import { requestUiLocale } from '@/lib/server-locale'
import { translateRuntimeUi } from '@/lib/ui-translation-runtime'
import { administrationNotificationHref } from '@/lib/administration/navigation'
import { safeNotificationPath } from '@/lib/portal-access'

export const dynamic = 'force-dynamic'

function safeNotificationLink(value:string|null):string|null {
  if (!value) return null
  const safe=safeNotificationPath(value)
  return safe==='/notifications' && value!=='/notifications' ? null : safe
}

export default async function Page({searchParams}:{searchParams?:Promise<{page?:string;scope?:string;view?:string}>}={}) {
  const params=await (searchParams??Promise.resolve({page:undefined,scope:undefined,view:undefined}))
  const selectedView=params.view==='all'?'all':'unread'
 const page=listPage(params.page,99999)
  const pageSize=50
  const offset=(page-1)*pageSize
  const [s,locale] = await Promise.all([createClient(),requestUiLocale()])
  const { data: { user } } = await s.auth.getUser()
  if (!user) return null

  const notificationQuery=s.from('crew_notifications')
    .select('id,title,body,kind,link,read_at,created_at')
    .eq('user_id',user.id)
    .neq('kind','error_report')
    .order('created_at',{ascending:false})
    .order('id',{ascending:false})
  const [{data,error},{data:badgeCount,error:badgeError}] = await Promise.all([
    (selectedView==='unread'?notificationQuery.is('read_at',null):notificationQuery).range(offset,offset+pageSize),
    s.rpc('upt_notification_badge_count'),
  ])

  const hasNext=(data?.length??0)>pageSize
  const visibleRows=data?.slice(0,pageSize)
  const prefix=params.scope==='administration'?'/portals/administration/modules/notifications':'/notifications'
  const scopedSuffix=params.scope==='administration'?'&scope=administration':''
  const pageHref=(target:number)=>prefix+'?page='+target+'&view='+selectedView+scopedSuffix
  const viewHref=(view:'unread'|'all')=>prefix+'?view='+view+scopedSuffix
  const labels={
    nl:{unread:'Ongelezen',all:'Alle meldingen',empty:'Geen ongelezen meldingen.'},
    fr:{unread:'Non lues',all:'Toutes les notifications',empty:'Aucune notification non lue.'},
    en:{unread:'Unread',all:'All notifications',empty:'No unread notifications.'},
    de:{unread:'Ungelesen',all:'Alle Mitteilungen',empty:'Keine ungelesenen Mitteilungen.'},
  }[locale]
  if(badgeError)console.error('[Notifications] badge count',badgeError.code)

  return <main className="space-y-4 p-4 md:p-8">
    <NotificationBadgeSync count={badgeCount??0}/>
    <h1 className="text-3xl font-black">{translateRuntimeUi("Meldingen",locale)}</h1>
    <nav aria-label={translateRuntimeUi("Meldingen",locale)} className="flex flex-wrap gap-2">
      <Link href={viewHref('unread')} aria-current={selectedView==='unread'?'page':undefined} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${selectedView==='unread'?'border-violet-500 bg-violet-500/10':'hover:bg-muted/30'}`}>{labels.unread} ({badgeCount??0})</Link>
      <Link href={viewHref('all')} aria-current={selectedView==='all'?'page':undefined} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${selectedView==='all'?'border-violet-500 bg-violet-500/10':'hover:bg-muted/30'}`}>{labels.all}</Link>
    </nav>
    {error ? <p role="alert">{translateRuntimeUi("Meldingen konden niet worden geladen.",locale)}</p> : !visibleRows?.length ? <p>{selectedView==='unread'?labels.empty:translateRuntimeUi("Geen meldingen.",locale)}</p> : visibleRows.map(n => {
      const safeLink=params.scope==='administration'?administrationNotificationHref(n.link):safeNotificationLink(n.link)
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
    {!error&&(page>1||hasNext)&&<nav aria-label={translateRuntimeUi("Meldingspagina’s",locale)} className="flex items-center justify-between gap-3"><span>{translateRuntimeUi('Pagina',locale)} {page}</span><div className="flex gap-2">{page>1&&<Link href={pageHref(page-1)} className="rounded-lg border px-3 py-2">{translateRuntimeUi('Vorige',locale)}</Link>}{hasNext&&<Link href={pageHref(page+1)} className="rounded-lg border px-3 py-2">{translateRuntimeUi('Volgende',locale)}</Link>}</div></nav>}
  </main>
}
