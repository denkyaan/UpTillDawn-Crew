import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
import { RealtimeRefresh } from '@/components/realtime-refresh'

export const dynamic='force-dynamic'

function Metric({label,value,detail}:{label:string;value:number;detail:string}){return <div className="rounded-2xl border p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>}

export default async function HealthPage(){
 const current=await getCurrentUser();if(!current?.isAdmin)redirect('/')
 const s=await createClient();const now=new Date();const since=new Date(now.getTime()-24*60*60*1000).toISOString()
 const [syncFailed,syncPending,unreadPush,openIncidents,pendingIns,pendingOuts,recentAudit]=await Promise.all([
  s.from('offline_operation_records').select('id',{count:'exact',head:true}).eq('status','failed'),
  s.from('offline_operation_records').select('id',{count:'exact',head:true}).eq('status','pending'),
  s.from('crew_notifications').select('id',{count:'exact',head:true}).is('read_at',null),
  s.from('incidents').select('id',{count:'exact',head:true}).neq('status','resolved'),
  s.from('check_ins').select('id',{count:'exact',head:true}).eq('status','pending'),
  s.from('check_outs').select('id',{count:'exact',head:true}).eq('status','pending'),
  s.from('upt_audit_logs').select('id',{count:'exact',head:true}).gte('created_at',since),
 ])
 const failed=[syncFailed,syncPending,unreadPush,openIncidents,pendingIns,pendingOuts,recentAudit].filter(x=>x.error).length
 return <main className="mx-auto max-w-6xl space-y-6 p-4 pb-28 md:p-8"><RealtimeRefresh tables={['offline_operation_records','crew_notifications','incidents','check_ins','check_outs']}/><div><p className="text-xs font-bold tracking-[.2em] text-violet-400">OBSERVABILITY</p><h1 className="text-3xl font-black">Systeemgezondheid</h1><p className="text-muted-foreground">Lage-volume operationele signalen; geen request-by-request logging.</p></div>{failed>0&&<p className="rounded-xl border border-amber-500/50 p-4">{failed} meting(en) konden niet worden geladen.</p>}<section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Metric label="Sync mislukt" value={syncFailed.count||0} detail="offline acties met status failed"/><Metric label="Sync wachtend" value={syncPending.count||0} detail="offline acties nog niet bevestigd"/><Metric label="Ongelezen meldingen" value={unreadPush.count||0} detail="crew notifications zonder read_at"/><Metric label="Open incidenten" value={openIncidents.count||0} detail="help/incidenten niet opgelost"/><Metric label="Startgoedkeuringen" value={pendingIns.count||0} detail="check-ins in behandeling"/><Metric label="Stopgoedkeuringen" value={pendingOuts.count||0} detail="check-outs in behandeling"/><Metric label="Auditmutaties 24u" value={recentAudit.count||0} detail="audit records in de laatste 24 uur"/></section></main>
}
