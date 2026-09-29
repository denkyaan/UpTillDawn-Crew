import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
import { nlStatus } from '@/lib/ui-nl'
import { AdminActivePersonnel, AdminRunningShifts } from '@/components/admin/live-operations-timers'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { PlatformAiAssistant } from '@/components/admin/platform-ai-assistant'
import { ContextLink } from '@/components/admin/context-link'
import { AdminActionCenter, type ActionQueueItem } from '@/components/admin/action-center'

export const dynamic = 'force-dynamic'

function Stat({href,label,value,detail}:{href:string;label:string;value:number;detail?:string}){return <Link href={href} className="rounded-2xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black">{value}</p>{detail&&<p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</Link>}

export default async function Page(){
 const current=await getCurrentUser();if(!current?.isAdmin) redirect('/')
 const s=await createClient();const now=new Date();const nowMs=now.getTime();const soon=new Date(nowMs+60*60*1000)
 const [events,sessions,breaks,pendingIns,pendingOuts,incidents,assignments,shifts,profiles,workplaces,syncIssues,approvedChecks,responsibleAssignments,pendingProfiles,operationalAlerts]=await Promise.all([
  s.from('events').select('id,name,start_at,end_at,status').neq('status','archived').order('start_at'),s.from('work_sessions').select('id,user_id,event_id,shift_id,started_at').is('ended_at',null).order('started_at'),s.from('break_sessions').select('id,work_session_id').is('ended_at',null),s.from('check_ins').select('id,user_id,event_id,workplace_id,requested_at').eq('status','pending').order('requested_at'),s.from('check_outs').select('id,user_id,event_id,workplace_id,requested_at').eq('status','pending').order('requested_at'),s.from('incidents').select('id,event_id,workplace_id,message,status,urgency,acknowledged_at,escalated_at,created_at').neq('status','resolved').order('created_at',{ascending:false}),s.from('task_assignments').select('id,status').neq('status','COMPLETED'),s.from('shifts').select('id,user_id,event_id,workplace_id,role_name,scheduled_start,scheduled_end,status').neq('status','cancelled').lte('scheduled_start',soon.toISOString()).gte('scheduled_end',now.toISOString()),s.from('profiles').select('id,full_name,phone_number,role').eq('approved',true),s.from('workplaces').select('id,event_id,name'),s.from('offline_operation_records').select('id,status').neq('status','synced').limit(100),s.from('check_ins').select('user_id,event_id,workplace_id').eq('status','approved'),s.from('responsible_assignments').select('workplace_id,user_id'),s.from('profiles').select('id,full_name,updated_at').eq('approved',false).order('updated_at'),s.rpc('upt_operational_alerts'),
 ])
 const results=[events,sessions,breaks,pendingIns,pendingOuts,incidents,assignments,shifts,profiles,workplaces,syncIssues,approvedChecks,responsibleAssignments,pendingProfiles,operationalAlerts]
 if(results.some(x=>x.error)) return <main className="p-4 md:p-8"><h1 className="text-3xl font-black">Beheeroverzicht</h1><p className="mt-4">Overzichtsgegevens konden niet volledig worden geladen.</p></main>
 const eventRows=events.data||[],sessionRows=sessions.data||[],breakRows=breaks.data||[],inRows=pendingIns.data||[],outRows=pendingOuts.data||[],incidentRows=incidents.data||[],assignmentRows=assignments.data||[],shiftRows=shifts.data||[],profileRows=profiles.data||[],workplaceRows=workplaces.data||[],syncRows=syncIssues.data||[],checkRows=approvedChecks.data||[],responsibleRows=responsibleAssignments.data||[],pendingProfileRows=pendingProfiles.data||[],alertRows=operationalAlerts.data||[]
 const activeSessionIds=sessionRows.map(row=>row.id);const sessionBreaks=activeSessionIds.length?await s.from('break_sessions').select('id,work_session_id,started_at,ended_at').in('work_session_id',activeSessionIds).order('started_at'):{data:[],error:null}
 if(sessionBreaks.error)return <main className="p-4 md:p-8"><h1 className="text-3xl font-black">Beheeroverzicht</h1><p className="mt-4">Overzichtsgegevens konden niet volledig worden geladen.</p></main>
 const sessionBreakRows=sessionBreaks.data||[];const activeEvents=eventRows.filter(e=>Date.parse(e.start_at)<=nowMs&&Date.parse(e.end_at)>=nowMs);const missing=shiftRows.filter(shift=>!checkRows.some(check=>check.user_id===shift.user_id&&check.event_id===shift.event_id&&check.workplace_id===shift.workplace_id));const people=new Map(profileRows.map(p=>[p.id,p]));const eventMap=new Map(eventRows.map(e=>[e.id,e]));const workplaceMap=new Map(workplaceRows.map(w=>[w.id,w]));const shiftMap=new Map(shiftRows.map(x=>[x.id,x]));const activeSessionByShift=new Map(sessionRows.filter(ws=>ws.shift_id).map(ws=>[ws.shift_id!,ws]));const responsibleKeys=new Set(responsibleRows.map(row=>`${row.workplace_id}:${row.user_id}`))
 const activePersonnel=sessionRows.flatMap(ws=>{const person=people.get(ws.user_id);const shift=ws.shift_id?shiftMap.get(ws.shift_id):undefined;if(!person||!shift)return [];const workplace=workplaceMap.get(shift.workplace_id);const isResponsible=responsibleKeys.has(`${shift.workplace_id}:${ws.user_id}`);const isOperationalPerson=isResponsible||person.role==='staff'||person.role==='responsible_lead';if(!isOperationalPerson)return [];return [{sessionId:ws.id,name:person.full_name||'Personeelslid',role:isResponsible?'Verantwoordelijke':'Personeel',title:shift.role_name||'Personeel',workplaceId:shift.workplace_id,workplaceName:workplace?.name||'Werkplek',startedAt:ws.started_at,breaks:sessionBreakRows.filter(row=>row.work_session_id===ws.id).map(row=>({id:row.id,startedAt:row.started_at,endedAt:row.ended_at})),isResponsible}]})
 const activeShiftRows=shiftRows.filter(shift=>{const person=people.get(shift.user_id);const isResponsible=responsibleKeys.has(`${shift.workplace_id}:${shift.user_id}`);return Date.parse(shift.scheduled_start)<=nowMs&&Date.parse(shift.scheduled_end)>=nowMs&&Boolean(person)&&(isResponsible||person?.role==='staff'||person?.role==='responsible_lead')}).map(shift=>{const person=people.get(shift.user_id);const session=activeSessionByShift.get(shift.id);const sessionBreakList=session?sessionBreakRows.filter(row=>row.work_session_id===session.id):[];return {shiftId:shift.id,name:person?.full_name||'Personeelslid',scheduledStart:shift.scheduled_start,actualStart:session?.started_at||null,status:(session?(sessionBreakList.some(row=>!row.ended_at)?'PAUZE':'WERKT'):'NIET GESTART') as 'WERKT'|'PAUZE'|'NIET GESTART',breaks:sessionBreakList.map(row=>({id:row.id,startedAt:row.started_at,endedAt:row.ended_at}))}}).sort((a,b)=>a.name.localeCompare(b.name,'nl'))
 const alertTitle=(kind:string)=>({
  'missing-checkout':'STOPUREN ONTBREKEN',
  'no-show':'NO-SHOW',
  'long-break':'LANGE PAUZE',
  'understaffed':'ONDERBEZETTING',
  'shift-overrun':'SHIFT UITLOOP',
  'responsible-missing':'VERANTWOORDELIJKE ONTBREEKT',
  'briefing-unread':'BRIEFING OPEN',
  'inventory-low':'LAGE VOORRAAD',
  'checklist-overdue':'CHECKLIST OPEN',
 } as Record<string,string>)[kind]||kind.replaceAll('-',' ').toUpperCase()
 const actionQueue:ActionQueueItem[]=[
  ...pendingProfileRows.map(row=>({
   key:'approval:'+row.id,
   title:'ACCOUNT GOEDKEUREN · '+(row.full_name||'Nieuwe gebruiker'),
   detail:'Nieuwe registratie wacht op toegang.',
   href:'/personnel',
   context:{userId:row.id,focus:'approval'},
   priority:'normal' as const,
   createdAt:row.updated_at,
  })),
  ...inRows.map(row=>({
   key:'checkin:'+row.id,
   title:'INKLOKKEN · '+(people.get(row.user_id)?.full_name||'Personeelslid'),
   detail:(eventMap.get(row.event_id)?.name||'Evenement')+' · '+(workplaceMap.get(row.workplace_id||'')?.name||'Werkplek'),
   href:'/operations',
   context:{eventId:row.event_id,workplaceId:row.workplace_id||null,userId:row.user_id,focus:'checkin'},
   priority:'high' as const,
   createdAt:row.requested_at,
  })),
  ...outRows.map(row=>({
   key:'checkout:'+row.id,
   title:'UITKLOKKEN · '+(people.get(row.user_id)?.full_name||'Personeelslid'),
   detail:(eventMap.get(row.event_id)?.name||'Evenement')+' · '+(workplaceMap.get(row.workplace_id||'')?.name||'Werkplek'),
   href:'/operations',
   context:{eventId:row.event_id,workplaceId:row.workplace_id||null,userId:row.user_id,focus:'checkout'},
   priority:'high' as const,
   createdAt:row.requested_at,
  })),
  ...missing.map(row=>({
   key:'missing-checkin:'+row.id,
   title:'INKLOKKEN ONTBREEKT · '+(people.get(row.user_id)?.full_name||'Personeelslid'),
   detail:(eventMap.get(row.event_id)?.name||'Evenement')+' · '+(workplaceMap.get(row.workplace_id)?.name||'Werkplek'),
   href:'/operations',
   context:{eventId:row.event_id,workplaceId:row.workplace_id,userId:row.user_id,focus:'missing-checkin'},
   priority:'high' as const,
   createdAt:row.scheduled_start,
  })),
  ...alertRows.map(alert=>({
   key:'alert:'+alert.id,
   title:alertTitle(alert.kind),
   detail:(eventMap.get(alert.event_id)?.name||'Evenement')+' · '+(workplaceMap.get(alert.workplace_id||'')?.name||'Werkplek'),
   href:alert.kind==='inventory-low'?'/inventory':alert.kind==='briefing-unread'||alert.kind==='checklist-overdue'?'/briefings':alert.kind==='responsible-missing'?'/workplaces':'/operations',
   context:{eventId:alert.event_id,workplaceId:alert.workplace_id||null,userId:alert.user_id||null,focus:alert.kind},
   priority:(alert.kind==='no-show'||alert.kind==='missing-checkout'?'critical':alert.kind==='shift-overrun'?'normal':'high') as 'critical'|'high'|'normal',
   createdAt:alert.detected_at,
  })),
  ...incidentRows.map(row=>({
   key:'incident:'+row.id,
   title:'HELP · '+(row.message||'Open melding'),
   detail:(eventMap.get(row.event_id||'')?.name||'Evenement')+' · '+(workplaceMap.get(row.workplace_id||'')?.name||'Werkplek'),
   href:'/incidents',
   context:{eventId:row.event_id||null,workplaceId:row.workplace_id||null,focus:'incident'},
   priority:(row.escalated_at||['urgent','critical'].includes(String(row.urgency||'').toLowerCase())?'critical':'high') as 'critical'|'high',
   createdAt:row.created_at,
  })),
  ...(assignmentRows.length?[{
   key:'tasks:open',
   title:'OPEN TAAKTOEWIJZINGEN',
   detail:assignmentRows.length+' open taaktoewijzing(en) wachten op opvolging.',
   href:'/tasks',
   context:{focus:'open-tasks'},
   priority:'normal' as const,
  }]:[]),
  ...(syncRows.length?[{
   key:'sync:problems',
   title:'SYNCHRONISATIE CONTROLEREN',
   detail:syncRows.length+' serveroperatie(s) zijn nog niet gesynchroniseerd.',
   href:'/sync',
   context:{focus:'sync'},
   priority:'high' as const,
  }]:[]),
 ]
 return <main className="mx-auto max-w-7xl space-y-7 p-4 pb-28 md:p-8"><RealtimeRefresh/><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[.2em] text-violet-400">UP TILL DAWN BEHEER</p><h1 className="text-3xl font-black">Operationeel command center</h1><p className="text-muted-foreground">Realtime serverstatus voor personeel, goedkeuringen, help oproepen, taken en synchronisatie.</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/time-records" className="rounded-xl border px-4 py-3">Tijdcorrecties</Link></div></div>
 <PlatformAiAssistant/>
 <section className="space-y-3 rounded-2xl border p-4">
  <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Event command centers</h2><p className="text-sm text-muted-foreground">Lopende en eerstvolgende evenementen met directe toegang tot readiness, briefing, inventory, guestlist en sales.</p></div><Link href="/events" className="text-sm underline">Alle events</Link></div>
  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
   {eventRows.filter(event=>Date.parse(event.end_at)>=nowMs).slice(0,6).map(event=>{
    const live=Date.parse(event.start_at)<=nowMs&&Date.parse(event.end_at)>=nowMs
    return <ContextLink key={event.id} href={'/events/'+event.id+'/command'} context={{eventId:event.id}} className="rounded-xl border p-4 hover:border-violet-500/60">
     <div className="flex items-start justify-between gap-3"><div><p className="font-black">{event.name}</p><p className="text-xs text-muted-foreground">{new Date(event.start_at).toLocaleString('nl-BE')}</p></div><span className={`rounded-full border px-2 py-1 text-xs font-black ${live?'border-emerald-500/50 text-emerald-500':'text-muted-foreground'}`}>{live?'LOPEND':'VOLGEND'}</span></div>
     <p className="mt-3 text-sm font-semibold text-violet-400">Open command center →</p>
    </ContextLink>
   })}
  </div>
 </section>
 <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat href="/personnel" label="Acties met prioriteit" value={actionQueue.filter(item=>item.priority==='critical'||item.priority==='high').length} detail="Kritieke en hoge acties in het actiecentrum"/><Stat href="/events" label="Actieve evenementen" value={activeEvents.length} detail={String(eventRows.length)+' niet gearchiveerd'}/><Stat href="/operations" label="Aan het werk" value={sessionRows.length} detail={String(breakRows.length)+' op pauze'}/><Stat href="/operations" label="Wachtende werkurengoedkeuringen" value={inRows.length+outRows.length} detail={String(inRows.length)+' inklokverzoek · '+String(outRows.length)+' uitklokverzoek'}/><Stat href="/personnel" label="Nieuwe accountgoedkeuringen" value={pendingProfileRows.length}/><Stat href="/incidents" label="Open help oproepen" value={incidentRows.length}/><Stat href="/operations" label="Ontbrekende inklokacties" value={missing.length} detail="Dienst actief of binnen 60 min"/><Stat href="/tasks" label="Open taaktoewijzingen" value={assignmentRows.length}/><Stat href="/crew" label="Goedgekeurd personeel" value={profileRows.length}/></section>
 <section className="grid gap-5 lg:grid-cols-2"><div className="space-y-3 rounded-2xl border p-4"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Actief personeel</h2><span className="text-sm text-muted-foreground">{activePersonnel.length} actief</span></div><AdminActivePersonnel people={activePersonnel}/></div><AdminActionCenter items={actionQueue}/></section>
 <section className="grid gap-5 lg:grid-cols-2"><div className="space-y-3 rounded-2xl border p-4"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Open help oproepen</h2><Link href="/incidents" className="text-sm underline">Alles bekijken</Link></div>{!incidentRows.length&&<p className="text-muted-foreground">Geen open help oproepen.</p>}{incidentRows.slice(0,6).map(x=><article key={x.id} className="rounded-xl border p-3"><p className="font-semibold">{x.message}</p><p className="text-xs text-muted-foreground">{eventMap.get(x.event_id||'')?.name||'Evenement'} · {new Date(x.created_at).toLocaleString('nl-BE')} · {nlStatus(x.status)}</p></article>)}</div><div className="space-y-3 rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Lopende diensten & pauzes</h2><span className="text-sm text-muted-foreground">{activeShiftRows.length} lopend</span></div><AdminRunningShifts shifts={activeShiftRows}/></div></section></main>
}
