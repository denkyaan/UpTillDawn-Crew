import {redirect} from 'next/navigation'
import Link from 'next/link'
import {createClient} from '@/lib/supabase/crew-server'
import {getCurrentUser} from '@/lib/actions/auth'
import {requestUiLocale} from '@/lib/server-locale'
import TimesheetControls from '@/components/crew/timesheet-controls'
export const dynamic='force-dynamic'
const COPY={
 nl:{title:'Werkstaten',mine:'Mijn werkstaat',team:'Werkstaten team',submit:'INDIENEN',resubmit:'OPNIEUW INDIENEN',approve:'GOEDKEUREN',reject:'AFWIJZEN',lock:'VERGRENDELEN',reason:'Reden van afwijzing',empty:'Geen werkstaten beschikbaar.',working:'Bezig…',statuses:{open:'Open',submitted:'Ingediend',approved:'Goedgekeurd',rejected:'Afgewezen',locked:'Vergrendeld'}},
 fr:{title:'Feuilles de temps',mine:'Ma feuille de temps',team:"Feuilles de temps de l'équipe",submit:'SOUMETTRE',resubmit:'SOUMETTRE À NOUVEAU',approve:'APPROUVER',reject:'REFUSER',lock:'VERROUILLER',reason:'Motif du refus',empty:'Aucune feuille de temps disponible.',working:'Traitement…',statuses:{open:'Ouvert',submitted:'Soumis',approved:'Approuvé',rejected:'Refusé',locked:'Verrouillé'}},
 en:{title:'Timesheets',mine:'My timesheet',team:'Team timesheets',submit:'SUBMIT',resubmit:'RESUBMIT',approve:'APPROVE',reject:'REJECT',lock:'LOCK',reason:'Rejection reason',empty:'No timesheets available.',working:'Working…',statuses:{open:'Open',submitted:'Submitted',approved:'Approved',rejected:'Rejected',locked:'Locked'}},
 de:{title:'Stundenzettel',mine:'Mein Stundenzettel',team:'Team-Stundenzettel',submit:'EINREICHEN',resubmit:'ERNEUT EINREICHEN',approve:'GENEHMIGEN',reject:'ABLEHNEN',lock:'SPERREN',reason:'Ablehnungsgrund',empty:'Keine Stundenzettel verfügbar.',working:'Wird verarbeitet…',statuses:{open:'Offen',submitted:'Eingereicht',approved:'Genehmigt',rejected:'Abgelehnt',locked:'Gesperrt'}}
} as const
export default async function Page({searchParams}:{searchParams?:Promise<{event?:string}>}){
 const params=searchParams?await searchParams:{};const current=await getCurrentUser();if(!current)redirect('/login')
 const s=await createClient();const locale=await requestUiLocale();const copy=COPY[locale];const isAdmin=current.role==='admin'||current.realIsAdmin||current.isOwner;const isResponsible=current.role==='responsible_lead'
 let eventId=params.event
 if(eventId&&!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(eventId))eventId=undefined
 const eventOptions:{id:string;name:string}[]=[]
 if(isAdmin){
  const {data}=await s.from('events').select('id,name').neq('status','archived').order('start_at',{ascending:false}).limit(100)
  eventOptions.push(...(data??[]).map(row=>({id:row.id,name:row.name})))
 }else{
  const {data}=await s.from('event_members').select('event_id,events(id,name)').eq('user_id',current.id).limit(100)
  eventOptions.push(...(data??[]).flatMap(row=>row.events?[{id:row.events.id,name:row.events.name}]:[]))
 }
 if(!eventId)eventId=eventOptions[0]?.id
 if(!eventId)return <main className="p-8"><h1 className="text-3xl font-black">{copy.title}</h1><p className="mt-4">{copy.empty}</p></main>
 const {data:rows,error}=await s.from('timesheets').select('id,event_id,user_id,status,rejection_reason').eq('event_id',eventId).order('updated_at',{ascending:false})
 if(error)return <main className="p-8">{copy.empty}</main>
 const own=(rows||[]).find(r=>r.user_id===current.id)||null
 const visibleUserIds=(isAdmin||isResponsible?[...new Set((rows||[]).map(r=>r.user_id))]:[current.id]);if(!visibleUserIds.length)visibleUserIds.push(current.id)
 const driverLabels={nl:{event:'Event',driving:'Rijtijd',total:'Totaal',rides:'ritten'},en:{event:'Event',driving:'Driving',total:'Total',rides:'rides'},fr:{event:'Événement',driving:'Conduite',total:'Total',rides:'trajets'},de:{event:'Event',driving:'Fahrzeit',total:'Gesamt',rides:'Fahrten'}}[locale]
 const [{data:workRows},{data:driveRows},{data:profileRows}]=await Promise.all([
  s.from('work_sessions').select('id,user_id,started_at,ended_at').eq('event_id',eventId).in('user_id',visibleUserIds),
  s.from('driver_sessions').select('id,work_session_id,user_id,started_at,ended_at,actual_km,expected_km,task_id').eq('event_id',eventId).in('user_id',visibleUserIds).order('started_at'),
  s.from('profiles').select('id,full_name').in('id',visibleUserIds),
 ])
 const names:Record<string,string>=Object.fromEntries((profileRows||[]).filter((p):p is typeof p & {full_name:string}=>typeof p.full_name==='string'&&p.full_name.trim().length>0).map(p=>[p.id,p.full_name]))
 const driverTotals=[...new Set((driveRows||[]).map(d=>d.user_id))].map(userId=>{const sessions=(workRows||[]).filter(w=>w.user_id===userId);const drives=(driveRows||[]).filter(d=>d.user_id===userId);const totalSeconds=sessions.reduce((n,w)=>n+Math.max(0,(Date.parse(w.ended_at||new Date().toISOString())-Date.parse(w.started_at))/1000),0);const drivingSeconds=drives.reduce((n,d)=>n+Math.max(0,(Date.parse(d.ended_at||new Date().toISOString())-Date.parse(d.started_at))/1000),0);return {userId,name:(profileRows||[]).find(p=>p.id===userId)?.full_name||'Driver',eventSeconds:Math.max(0,totalSeconds-drivingSeconds),drivingSeconds,km:drives.reduce((n,d)=>n+Number(d.actual_km??d.expected_km??0),0),rides:drives.length}})
 const duration=(seconds:number)=>`${Math.floor(seconds/3600)}u ${Math.floor(seconds%3600/60)}m`
 return <main className="space-y-6 p-4 pb-28 md:p-8"><h1 className="text-3xl font-black">{copy.title}</h1><nav aria-label={copy.title} className="flex flex-wrap gap-2">{eventOptions.map(event=><Link key={event.id} aria-current={event.id===eventId?'page':undefined} className={event.id===eventId?'rounded-lg bg-violet-600 px-3 py-2 text-white':'rounded-lg border px-3 py-2'} href={'/timesheets?event='+encodeURIComponent(event.id)}>{event.name}</Link>)}</nav><TimesheetControls eventId={eventId} userId={current.id} isAdmin={isAdmin} isResponsible={isResponsible} own={own} rows={rows||[]} names={names} copy={copy}/>{driverTotals.length>0&&<section className="space-y-3 rounded-2xl border p-4"><h2 className="text-xl font-bold">Driver</h2>{driverTotals.map(row=><article key={row.userId} className="rounded-xl border p-3"><p className="font-bold">{row.name}</p><p className="text-sm">{driverLabels.event} {duration(row.eventSeconds)} · {driverLabels.driving} {duration(row.drivingSeconds)} · {driverLabels.total} {duration(row.eventSeconds+row.drivingSeconds)} · {row.km.toFixed(1)} km · {row.rides} {driverLabels.rides}</p></article>)}</section>}</main>
}
