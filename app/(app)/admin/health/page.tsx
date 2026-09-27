import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/crew-server'
import { getCurrentUser } from '@/lib/actions/auth'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { HealthLatencyProbe } from '@/components/admin/health-latency-probe'
import { aggregateDependencyHealth } from '@/lib/health-checks'
import { evaluateOperationalAlerts, highestAlertSeverity } from '@/lib/operational-alert-policy'
import { DEFAULT_SERVICE_LEVELS, serviceLevelMet } from '@/lib/service-levels'
import type { Database } from '@/types/crew-database'

export const dynamic='force-dynamic'

type HealthRow=Database['public']['Functions']['upt_admin_system_health']['Returns'][number]

function StatusBadge({status}:{status:'healthy'|'degraded'|'unavailable'}){
  const label=status==='healthy'?'GEZOND':status==='degraded'?'AANDACHT':'PROBLEEM'
  const style=status==='healthy'
    ?'border-emerald-500/50 text-emerald-600'
    :status==='degraded'
      ?'border-amber-500/50 text-amber-600'
      :'border-red-500/50 text-red-600'
  return <span className={'rounded-full border px-2 py-1 text-xs font-black '+style}>{label}</span>
}

function Metric({label,value,detail}:{label:string;value:string|number;detail?:string}){
  return <div className="rounded-xl border p-3">
    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-black">{value}</p>
    {detail&&<p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
  </div>
}

export default async function Page(){
  const current=await getCurrentUser()
  if(!current?.isAdmin)redirect('/')

  const s=await createClient()
  const result=await s.rpc('upt_admin_system_health')

  if(result.error||!result.data?.[0]){
    return <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[.2em] text-violet-400">UP TILL DAWN BEHEER</p>
          <h1 className="text-3xl font-black">Systeemgezondheid</h1>
        </div>
        <Link href="/admin" className="rounded-xl border px-4 py-3 font-semibold">Terug naar beheer</Link>
      </div>
      <section className="rounded-2xl border border-red-500/50 bg-red-500/5 p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Health snapshot niet beschikbaar</h2><StatusBadge status="unavailable"/></div>
        <p className="mt-2 text-sm text-muted-foreground">De admin health-RPC kon niet worden gelezen. Controleer Supabase-connectiviteit en de meest recente deploy.</p>
      </section>
    </main>
  }

  const health=result.data[0] as HealthRow
  const syncObjective=DEFAULT_SERVICE_LEVELS.find(item=>item.metric==='sync-success')!
  const syncRate=Number(health.offline_operations_24h)>0
    ? Number(health.offline_synced_24h)/Number(health.offline_operations_24h)
    : 1
  const syncHealthy=serviceLevelMet(syncObjective,syncRate)
  const syncStatus:'healthy'|'degraded'|'unavailable'=
    Number(health.offline_failed)>0
      ?'unavailable'
      : Number(health.offline_stale)>0||!syncHealthy
        ?'degraded'
        :'healthy'
  const alerts=evaluateOperationalAlerts({offlineFailed:Number(health.offline_failed),offlineStale:Number(health.offline_stale),unreadNotifications:Number(health.unread_notifications),notifications24h:Number(health.notifications_24h),pendingCheckins:Number(health.pending_checkins),pendingCheckouts:Number(health.pending_checkouts),openIncidents:Number(health.open_incidents)})
  const alertSeverity=highestAlertSeverity(alerts)
  const overall=aggregateDependencyHealth([{name:'Offline sync',health:syncStatus,checkedAt:Date.parse(health.checked_at)},{name:'Operational alerts',health:alertSeverity==='critical'?'unavailable':alertSeverity==='warning'?'degraded':'healthy',checkedAt:Date.parse(health.checked_at)}])

  return <main className="mx-auto max-w-6xl space-y-6 p-4 pb-28 md:p-8">
    <RealtimeRefresh tables={['work_sessions','break_sessions','check_ins','check_outs','incidents','offline_operation_records','crew_notifications']}/>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold tracking-[.2em] text-violet-400">UP TILL DAWN BEHEER</p>
        <h1 className="text-3xl font-black">Systeemgezondheid</h1>
        <p className="text-sm text-muted-foreground">Privacyveilige productie-indicatoren. Geen push-endpoints, inhoud of persoonsgegevens worden hier getoond.</p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={overall}/>
        <div className="flex gap-2"><Link href="/admin/release" className="rounded-xl border px-4 py-3 font-semibold">Release readiness</Link><Link href="/admin" className="rounded-xl border px-4 py-3 font-semibold">Beheeroverzicht</Link></div>
      </div>
    </div>

    <section className="grid gap-4 md:grid-cols-2">
      <HealthLatencyProbe/>

      <article className="space-y-3 rounded-2xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-xl font-bold">Offline synchronisatie</h2><p className="text-sm text-muted-foreground">Serverbevestigde offline-operaties over de laatste 24 uur.</p></div>
          <StatusBadge status={syncStatus}/>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Sync succes" value={(syncRate*100).toFixed(1)+'%'} detail={'SLO '+(syncObjective.target*100).toFixed(1)+'%'}/>
          <Metric label="Operaties 24u" value={Number(health.offline_operations_24h)}/>
          <Metric label="Pending" value={Number(health.offline_pending)} detail={Number(health.offline_stale)+' ouder dan 5 min'}/>
          <Metric label="Failed" value={Number(health.offline_failed)}/>
        </div>
      </article>
    </section>

    {alerts.length>0&&<section className="rounded-2xl border border-amber-500/50 bg-amber-500/5 p-4" role="alert">
      <h2 className="font-bold">Operationele alerts</h2>
      <div className="mt-2 space-y-1 text-sm text-muted-foreground">{alerts.map(alert=><p key={alert.code}><strong className={alert.severity==='critical'?'text-red-500':'text-amber-600'}>{alert.severity==='critical'?'KRITIEK':'AANDACHT'}:</strong> {alert.message}</p>)}</div>
    </section>}

    {(Number(health.offline_failed)>0||Number(health.offline_stale)>0)&&<section className="rounded-2xl border border-amber-500/50 bg-amber-500/5 p-4" role="alert">
      <h2 className="font-bold">Synchronisatie vraagt aandacht</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {Number(health.offline_failed)>0&&<>Er zijn {Number(health.offline_failed)} definitief mislukte serveroperatie(s). </>}
        {Number(health.offline_stale)>0&&<>Er zijn {Number(health.offline_stale)} wachtende operatie(s) ouder dan vijf minuten.</>}
      </p>
      <Link href="/sync" className="mt-3 inline-block rounded-lg border px-3 py-2 text-sm font-bold">Synchronisatie openen</Link>
    </section>}

    <section className="space-y-3 rounded-2xl border p-4">
      <div><h2 className="text-xl font-bold">Operationele belasting</h2><p className="text-sm text-muted-foreground">Live aantallen; dit zijn geen systeemfouten maar tonen hoeveel werk de app momenteel verwerkt.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Actieve werksessies" value={Number(health.active_sessions)}/>
        <Metric label="Actieve pauzes" value={Number(health.active_breaks)}/>
        <Metric label="Open help oproepen" value={Number(health.open_incidents)}/>
        <Metric label="Wachtende inklok" value={Number(health.pending_checkins)}/>
        <Metric label="Wachtende uitklok" value={Number(health.pending_checkouts)}/>
        <Metric label="Goedgekeurde accounts" value={Number(health.approved_users)}/>
        <Metric label="Push subscriptions" value={Number(health.enabled_push_subscriptions)} detail="Actief en door gebruiker toegestaan"/>
        <Metric label="Audit events 24u" value={Number(health.recent_audit_24h)}/>
      </div>
    </section>

    <section className="space-y-3 rounded-2xl border p-4">
      <div><h2 className="text-xl font-bold">Meldingen</h2><p className="text-sm text-muted-foreground">Volume en leesstatus; push-delivery zelf wordt niet als succesvol verondersteld zonder delivery receipt.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="Aangemaakt 24u" value={Number(health.notifications_24h)}/>
        <Metric label="Ongelezen" value={Number(health.unread_notifications)}/>
      </div>
    </section>
  </main>
}
