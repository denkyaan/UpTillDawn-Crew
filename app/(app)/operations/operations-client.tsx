'use client'
import Link from 'next/link'
import { useEffect,useMemo,useRef,useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/crew-client'
import { enqueue } from '@/lib/crew-queue'
import { saveOperationsSnapshot } from '@/lib/crew-offline-snapshot'
import { nlStatus } from '@/lib/ui-nl'
import type { Tables,Database } from '@/types/crew-database'
import { lateMinutes, noShowGraceMinutes } from '@/lib/no-show-policy'
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from '@/lib/locale-preferences'
type Summary=Database['public']['Functions']['upt_work_session_time_summary']['Returns'][number]
type CrewMember={id:string;full_name:string|null;phone_number:string|null;profile_photo_url:string|null}
type OperationalAlert=Database['public']['Functions']['upt_operational_alerts']['Returns'][number]
type ManagerLiveSession=Database['public']['Functions']['upt_manager_live_sessions']['Returns'][number]
type DriverSession={id:string;started_at:string;task_id:string|null;expected_km:number|null}
type DriverTask={task_id:string;direction:string;passenger_name:string;passenger_phone:string;address:string;scheduled_at:string;estimated_drive_minutes:number|null;expected_km:number|null;status:string;eta_at:string|null;guestlist_entry_id:string|null}
type DriverSummary={event_seconds:number;driving_seconds:number;total_km:number}
type DriverDashboard=Database['public']['Functions']['upt_driver_dashboard']['Returns'][number]
type Props={userId:string;shifts:Tables<'shifts'>[];events:Tables<'events'>[];workplaces:Tables<'workplaces'>[];activeSession:Tables<'work_sessions'>|null;activeBreak:Tables<'break_sessions'>|null;checkins:Tables<'check_ins'>[];checkouts:Tables<'check_outs'>[];manager:boolean;isAdmin:boolean;personalWork:boolean;summary:Summary|null;summaryAsOf:number;liveSessions:ManagerLiveSession[];liveBreaks:Tables<'break_sessions'>[];crewDirectory:CrewMember[];timeReviews:Tables<'time_review_requests'>[];operationalAlerts:OperationalAlert[];focusUserId?:string|null;focusWorkplaceId?:string|null;focusKind?:string|null;isDriverSession?:boolean;activeDriverSession?:DriverSession|null;driverSummary?:DriverSummary|null;driverTasks?:DriverTask[];driverDashboard?:DriverDashboard[]}
export default function OperationsClient(p:Props){
 const router=useRouter();const [busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[rejectionReasons,setRejectionReasons]=useState<Record<string,string>>({}),[alertNow,setAlertNow]=useState(()=>Date.now())
 const s=useMemo(()=>createClient(),[])
 useEffect(()=>{
  const refresh=()=>{if(navigator.onLine)router.refresh()}
  const onVisibility=()=>{if(document.visibilityState==='visible')refresh()}
  window.addEventListener('online',refresh)
  window.addEventListener('focus',refresh)
  document.addEventListener('visibilitychange',onVisibility)
  return()=>{window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',onVisibility)}
 },[router])
 useEffect(()=>{
  if(!p.manager)return
  const timer=window.setInterval(()=>{
   setAlertNow(Date.now())
   if(navigator.onLine)router.refresh()
  },60_000)
  return()=>window.clearInterval(timer)
 },[p.manager,router])
 useEffect(()=>{
  if(!p.focusUserId&&!p.focusWorkplaceId&&!p.focusKind)return
  const timer=window.setTimeout(()=>document.getElementById('operations-focus')?.scrollIntoView({behavior:'smooth',block:'center'}),120)
  return()=>window.clearTimeout(timer)
 },[p.focusUserId,p.focusWorkplaceId,p.focusKind])
 useEffect(()=>{void saveOperationsSnapshot({
  version:1,
  userId:p.userId,
  savedAt:Date.now(),
  events:p.events.map(e=>({id:e.id,name:e.name})),
  workplaces:p.workplaces.map(w=>({id:w.id,event_id:w.event_id,name:w.name})),
  shifts:p.shifts.map(x=>({id:x.id,event_id:x.event_id,workplace_id:x.workplace_id,role_name:x.role_name,scheduled_start:x.scheduled_start,scheduled_end:x.scheduled_end})),
  activeSession:p.activeSession?{id:p.activeSession.id,event_id:p.activeSession.event_id,shift_id:p.activeSession.shift_id,started_at:p.activeSession.started_at}:null,
  activeBreak:p.activeBreak?{id:p.activeBreak.id,work_session_id:p.activeBreak.work_session_id,started_at:p.activeBreak.started_at}:null,
  checkins:p.checkins.filter(x=>x.user_id===p.userId).map(x=>({event_id:x.event_id,workplace_id:x.workplace_id,status:x.status})),
 }).catch(()=>{})},[p.userId,p.events,p.workplaces,p.shifts,p.activeSession,p.activeBreak,p.checkins])
 async function run(action:()=>Promise<void>){if(busy)return;setBusy(true);setMsg('');try{await action();router.refresh()}catch{setMsg('Actie niet bevestigd. Controleer je verbinding en huidige status.')}finally{setBusy(false)}}
 async function work(type:string,payload:Record<string,string>){await enqueue(p.userId,type,payload);setMsg('Actie bewaard. Alleen de bevestigde serverstatus geldt.')}
 async function decide(kind:'in'|'out',id:string,approve:boolean){
  const notes=(rejectionReasons[id]||'').trim()
  if(!approve&&!notes){setMsg('Vul eerst een reden voor de afwijzing in.');return}
  const result=kind==='in'
   ?await s.rpc('upt_decide_check_in',{p_check_in:id,p_approve:approve,p_notes:notes||undefined})
   :await s.rpc('upt_decide_check_out',{p_check_out:id,p_approve:approve,p_notes:notes||undefined})
  if(result.error)throw result.error
  if(!approve)setRejectionReasons(current=>({...current,[id]:''}))
  setMsg(approve?'Goedgekeurd. De effectieve tijd is automatisch toegepast.':'Afgewezen. Het personeelslid ontvangt de reden en moet opnieuw aanvragen.')
 }
 const pendingStop=p.activeSession?p.checkouts.find(row=>row.user_id===p.userId&&row.status==='pending'&&(row.work_session_id===p.activeSession?.id||row.event_id===p.activeSession?.event_id)):null
 const approvals=(p.manager?[
  ...p.checkins.filter(row=>row.status==='pending'&&row.user_id!==p.userId&&(p.isAdmin||row.reviewer_kind!=='admin')).map(row=>({...row,kind:'in' as const})),
  ...p.checkouts.filter(row=>row.status==='pending'&&row.user_id!==p.userId&&(p.isAdmin||row.reviewer_kind!=='admin')).map(row=>({...row,kind:'out' as const}))
 ]:[]).sort((a,b)=>Number(b.user_id===p.focusUserId||b.workplace_id===p.focusWorkplaceId)-Number(a.user_id===p.focusUserId||a.workplace_id===p.focusWorkplaceId))
 const sortedAlerts=[...p.operationalAlerts].sort((a,b)=>Number(b.user_id===p.focusUserId||b.workplace_id===p.focusWorkplaceId||b.kind===p.focusKind)-Number(a.user_id===p.focusUserId||a.workplace_id===p.focusWorkplaceId||a.kind===p.focusKind))
 useEffect(()=>{
  if(!p.focusUserId&&!p.focusWorkplaceId&&!p.focusKind)return
  const timer=window.setTimeout(()=>{
   const match=document.querySelector('[data-focus-match="true"]')
   const fallback=document.getElementById('operations-approvals')||document.getElementById('operations-alerts')
   ;(match||fallback)?.scrollIntoView({behavior:'smooth',block:'center'})
  },150)
  return()=>window.clearTimeout(timer)
 },[p.focusKind,p.focusUserId,p.focusWorkplaceId,approvals.length,sortedAlerts.length])
 return <main className="mx-auto max-w-4xl space-y-6 p-4 pb-28 md:p-8"><div><h1 className="text-3xl font-black">{p.personalWork?'Mijn werkuren':'Werkuren'}</h1>{p.isAdmin&&<p className="text-sm text-muted-foreground">Beheer live werkuren, pauzes, check-in/out, afwijkingen en goedkeuringen. Tijdcorrecties en Excel-export horen bij dezelfde tijdregistratieworkflow.</p>}{!p.isAdmin&&p.manager&&<p className="text-sm text-muted-foreground">Volg je werkplekteam, keur start- en stopuren goed en handel operationele waarschuwingen af.</p>}</div>{msg&&<p role="status" className="rounded-xl border p-4">{msg}</p>}
 {p.personalWork&&p.activeSession&&<section className="space-y-4 rounded-2xl border border-violet-500 bg-card p-5"><h2 className="text-xl font-bold">WERK ACTIEF</h2><p>Gestart: {new Date(p.activeSession.started_at).toLocaleString('nl-BE')}</p>
 {p.summary&&<LiveWorkSummary summary={p.summary} activeBreak={p.activeBreak} summaryAsOf={p.summaryAsOf}/>} 
 {p.activeBreak&&p.summary&&p.summary.break_balance_seconds<=300&&<p role="alert" className="text-amber-300">Pauzetegoed bijna of volledig opgebruikt.</p>}
 {p.isDriverSession&&<DriverControls s={s} busy={busy} run={run} activeSessionId={p.activeSession.id} activeDriving={p.activeDriverSession||null} summary={p.driverSummary||null} tasks={p.driverTasks||[]}/>} 
 <button data-action={p.activeBreak?'break-stop':'break-start'} disabled={busy||Boolean(p.activeDriverSession)} className="w-full rounded-xl border p-4 font-bold" onClick={()=>run(()=>p.activeBreak?work('stop_break',{break_id:p.activeBreak.id}):work('start_break',{session_id:p.activeSession!.id}))}>{p.activeBreak?'PAUZE STOPPEN':'PAUZE STARTEN'}</button>
 {p.activeDriverSession?<DriverDrivingLockNotice/>:pendingStop
  ?<div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"><p className="font-semibold">Stopuren aangevraagd</p><p className="mt-1 text-sm">Je teller blijft doorlopen. Bij goedkeuring wordt de stoptijd teruggezet naar {new Date(pendingStop.requested_at).toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})}.</p></div>
  :<Link className="block w-full rounded-xl bg-red-700 p-4 text-center font-bold text-white" href="/qr">STOPUREN AANVRAGEN</Link>}
 </section>}
 {p.personalWork&&<section className="space-y-3"><h2 className="text-xl font-bold">Mijn diensten</h2>{!p.shifts.length&&<p>Er zijn geen diensten toegewezen binnen het huidige startvenster.</p>}{p.shifts.map(shift=>{const checkin=p.checkins.find(row=>row.user_id===p.userId&&(row.shift_id===shift.id||(row.shift_id===null&&row.event_id===shift.event_id&&row.workplace_id===shift.workplace_id)));return <article key={shift.id} className="space-y-3 rounded-2xl border p-4"><h3 className="font-bold">{p.events.find(e=>e.id===shift.event_id)?.name} · {p.workplaces.find(w=>w.id===shift.workplace_id)?.name}</h3><p>{new Date(shift.scheduled_start).toLocaleString('nl-BE')} → {new Date(shift.scheduled_end).toLocaleString('nl-BE')}</p><p>Shift: {shift.confirmed_at?'bevestigd':'wacht op bevestiging'}</p><p>Starturen: {checkin?nlStatus(checkin.status):'nog niet aangevraagd'}</p>
 {checkin?.status==='rejected'&&<p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">Afgewezen{checkin.notes?`: ${checkin.notes}`:''}. Dien bij je effectieve start opnieuw een aanvraag in.</p>}
 {checkin?.status==='pending'&&<p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">Wacht op goedkeuring door {checkin.reviewer_kind==='admin'?'admin':'de verantwoordelijke'}.</p>}
 {!p.activeSession&&(!checkin||checkin.status==='rejected')&&<Link className="block w-full rounded-xl bg-violet-600 p-4 text-center font-bold text-white" href="/qr">STARTUREN AANVRAGEN</Link>}
 {checkin?.status==='approved'&&!p.activeSession&&<p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">Goedgekeurd. De werkregistratie wordt automatisch gestart.</p>}
 {p.activeSession?.event_id===shift.event_id&&p.activeSession.shift_id!==shift.id&&<button disabled={busy} className="w-full rounded-xl border p-4" onClick={()=>run(()=>work('transition',{session_id:p.activeSession!.id,workplace_id:shift.workplace_id}))}>NIEUWE WERKPLEK — OVERGANG BEVESTIGEN</button>}
 </article>})}</section>}
 {p.manager&&sortedAlerts.length>0&&<section className="space-y-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4" role="alert">
  <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-bold">Operationele waarschuwingen</h2><p className="text-sm text-muted-foreground">Live bezetting · start/stop-controle · pauzecontrole · no-show vanaf {noShowGraceMinutes()} min</p></div><span className="rounded-full border px-3 py-1 text-xs font-bold">{sortedAlerts.length} OPEN</span></div>
  {sortedAlerts.map(alert=><OperationalAlertCard key={alert.id} alert={alert} workplaces={p.workplaces} crewDirectory={p.crewDirectory} alertNow={alertNow} focused={alert.user_id===p.focusUserId||alert.workplace_id===p.focusWorkplaceId||alert.kind===p.focusKind}/>)}
 </section>}
 {p.manager&&Boolean(p.driverDashboard?.length)&&<DriverBackstageDashboard rows={p.driverDashboard||[]}/>} 
 {p.manager&&<section className="space-y-3 rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Actuele personeelstatus</h2><span className="text-sm text-muted-foreground">{p.liveSessions.length} actief</span></div>{!p.liveSessions.length&&<p className="text-muted-foreground">Momenteel is er geen zichtbaar personeel aan het werk.</p>}{p.liveSessions.map(ws=>{const crew=p.crewDirectory.find(m=>m.id===ws.user_id);const onBreak=p.liveBreaks.some(b=>b.work_session_id===ws.session_id&&!b.ended_at);return <article key={ws.session_id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{crew?.full_name||'Personeelslid'}</p><p className="text-sm text-muted-foreground">{ws.workplace_name||'Werkplek'} · gestart {new Date(ws.started_at).toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})}</p>{crew?.phone_number&&<a className="text-sm underline" href={`tel:${crew.phone_number}`}>{crew.phone_number}</a>}</div><span className={`rounded-full px-3 py-1 text-xs font-bold ${onBreak?'bg-amber-500/20 text-amber-300':'bg-emerald-500/20 text-emerald-300'}`}>{onBreak?'PAUZE':'AAN HET WERK'}</span></div></article>})}</section>}
 {p.manager&&<section id="operations-approvals" className="space-y-3"><h2 className="text-xl font-bold">Goedkeuringen</h2>{!approvals.length&&<p className="rounded-xl border p-4 text-muted-foreground">Geen openstaande aanvragen.</p>}{approvals.map(request=>{const crew=p.crewDirectory.find(member=>member.id===request.user_id);const focused=request.user_id===p.focusUserId||request.workplace_id===p.focusWorkplaceId;return <article data-focus-match={focused?'true':'false'} key={request.id} className={'space-y-3 rounded-xl border p-4 '+(focused?'border-violet-500/70 ring-1 ring-violet-500/20':'')}><div><p className="font-bold">{request.kind==='in'?'Starturen':'Stopuren'} · {crew?.full_name||'Personeelslid'}</p><p className="text-sm text-muted-foreground">{p.workplaces.find(w=>w.id===request.workplace_id)?.name||'Werkplek'} · aangevraagd {new Date(request.requested_at).toLocaleString('nl-BE')}</p>{request.remote&&<span className="mt-2 inline-block rounded-full border px-2 py-1 text-xs font-bold">REMOTE</span>}{request.kind==='in'&&request.early_reason&&<p className="mt-2 rounded-lg border border-amber-500/40 p-3 text-sm">Reden vroegstart: {request.early_reason}</p>}</div><input value={rejectionReasons[request.id]||''} onChange={event=>setRejectionReasons(current=>({...current,[request.id]:event.target.value}))} maxLength={500} placeholder="Reden bij afwijzing (verplicht)" className="w-full rounded-lg border bg-background p-3"/><div className="flex flex-wrap gap-3"><button data-action={`${request.kind}-approve`} disabled={busy} className="rounded-lg bg-violet-600 p-3 font-bold text-white" onClick={()=>run(()=>decide(request.kind,request.id,true))}>GOEDKEUREN</button><button disabled={busy||!(rejectionReasons[request.id]||'').trim()} className="rounded-lg border p-3 font-bold disabled:opacity-50" onClick={()=>run(()=>decide(request.kind,request.id,false))}>AFWIJZEN</button></div></article>})}</section>}
 {p.isAdmin&&<section className="space-y-3"><h2 className="text-xl font-bold">Tijdcorrectie — vroegstartcontrole</h2>{!p.timeReviews.length&&<p className="rounded-xl border p-4 text-muted-foreground">Geen vroegstarts te controleren.</p>}{p.timeReviews.map(review=><EarlyReviewControls key={review.id} review={review} name={p.crewDirectory.find(member=>member.id===review.user_id)?.full_name||'Personeelslid'}/>)}</section>}
 </main>
}

function OperationalAlertCard({alert,workplaces,crewDirectory,alertNow,focused=false}:{alert:OperationalAlert;workplaces:Tables<'workplaces'>[];crewDirectory:CrewMember[];alertNow:number;focused?:boolean}){
 const workplace=workplaces.find(item=>item.id===alert.workplace_id)
 if(alert.kind==='understaffed')return <article data-focus-match={focused?'true':'false'} className={'rounded-xl border border-amber-500/50 bg-amber-500/5 p-4 '+(focused?'ring-1 ring-violet-500/40':'')}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{workplace?.name||'Werkplek'}</p><p className="text-sm text-muted-foreground">Actieve bezetting: {alert.active_staff??0}/{alert.minimum_staff??0} · minimum niet gehaald</p></div><span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-black text-amber-600">ONDERBEZET</span></div></article>

 const intelligence={
  'responsible-missing':{label:'VERANTWOORDELIJKE ONTBREEKT',detail:'Deze actieve werkplek heeft nog geen verantwoordelijke.',href:'/workplaces'},
  'briefing-unread':{label:'BRIEFING OPEN',detail:'Een verplichte briefing is nog niet bevestigd vóór de aankomende shift.',href:'/briefings'},
  'inventory-low':{label:'LAGE VOORRAAD',detail:'Materiaal op deze werkplek heeft het ingestelde minimum bereikt.',href:'/inventory'},
  'checklist-overdue':{label:'CHECKLIST OPEN',detail:'Een operationele checklist is na het geplande moment nog niet afgerond.',href:'/briefings'},
 }[alert.kind]
 if(intelligence){
  const href=intelligence.href+'?event='+alert.event_id+'&workplace='+alert.workplace_id+(alert.user_id?'&user='+alert.user_id:'')+'&focus='+alert.kind
  return <article data-focus-match={focused?'true':'false'} className={'rounded-xl border border-amber-500/50 bg-amber-500/5 p-4 '+(focused?'ring-1 ring-violet-500/40':'')}>
   <div className="flex flex-wrap items-start justify-between gap-3">
    <div><p className="font-bold">{workplace?.name||'Werkplek'}</p><p className="text-sm text-muted-foreground">{intelligence.detail}</p><Link href={href} className="mt-2 inline-block text-sm font-semibold text-violet-400 underline">Open juiste onderdeel</Link></div>
    <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-black text-amber-600">{intelligence.label}</span>
   </div>
  </article>
 }

 const crew=crewDirectory.find(member=>member.id===alert.user_id)
 if(alert.kind==='shift-overrun'||alert.kind==='missing-checkout'||alert.kind==='long-break'){
  const severe=alert.kind==='missing-checkout'
  const label=alert.kind==='shift-overrun'?'UITLOOP':alert.kind==='missing-checkout'?'STOPUREN ONTBREKEN':'LANGE PAUZE'
  const detail=alert.kind==='long-break'
   ? `Pauze gebruikt: ${alert.observed_minutes??0} min · waarschuwingsgrens ${alert.threshold_minutes??70} min`
   : `Geplande eindtijd ${new Date(alert.planned_end).toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})} · ${alert.observed_minutes??0} min voorbij zonder stopaanvraag`
  return <article data-focus-match={focused?'true':'false'} className={`rounded-xl border p-4 ${severe?'border-red-500/50 bg-red-500/5':'border-amber-500/50 bg-amber-500/5'} ${focused?'ring-1 ring-violet-500/40':''}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{crew?.full_name||'Personeelslid'} · {workplace?.name||'Werkplek'}</p><p className="text-sm text-muted-foreground">{detail}</p>{crew?.phone_number&&<a className="text-sm underline" href={`tel:${crew.phone_number}`}>{crew.phone_number}</a>}</div><span className={`rounded-full px-3 py-1 text-xs font-black ${severe?'bg-red-500/20 text-red-600':'bg-amber-500/20 text-amber-600'}`}>{label}</span></div></article>
 }

 const minutes=lateMinutes({shiftStartsAt:new Date(alert.planned_start).getTime(),checkedInAt:null,excused:false},alertNow)
 return <article data-focus-match={focused?'true':'false'} className={`rounded-xl border p-4 ${alert.kind==='no-show'?'border-red-500/50 bg-red-500/5':'border-amber-500/40'} ${focused?'ring-1 ring-violet-500/40':''}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{crew?.full_name||'Personeelslid'} · {workplace?.name||'Werkplek'}</p><p className="text-sm text-muted-foreground">Gepland {new Date(alert.planned_start).toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})} · {minutes} min zonder goedgekeurde start</p>{crew?.phone_number&&<a className="text-sm underline" href={`tel:${crew.phone_number}`}>{crew.phone_number}</a>}</div><span className={`rounded-full px-3 py-1 text-xs font-black ${alert.kind==='no-show'?'bg-red-500/20 text-red-600':'bg-amber-500/20 text-amber-600'}`}>{alert.kind==='no-show'?'NO-SHOW':'TE LAAT'}</span></div></article>
}

function EarlyReviewControls({review,name}:{review:Tables<'time_review_requests'>;name:string}){
 const router=useRouter()
 const s=useMemo(()=>createClient(),[])
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[adjusted,setAdjusted]=useState('')
 async function submit(value?:string){
  if(busy)return
  setBusy(true);setMessage('')
  const parsed=value?new Date(value):null
  if(value&&(!parsed||Number.isNaN(parsed.getTime()))){setMessage('Kies een geldige starttijd.');setBusy(false);return}
  const {error}=await s.rpc('upt_admin_review_early_start',{p_review:review.id,p_start:parsed?.toISOString()})
  if(error)setMessage(error.message)
  else{setMessage('Vroegstart verwerkt.');router.refresh()}
  setBusy(false)
 }
 return <article className="space-y-3 rounded-xl border border-amber-500/40 p-4"><div><p className="font-bold">{name}</p><p className="text-sm text-muted-foreground">Aangevraagd: {new Date(review.requested_start).toLocaleString('nl-BE')} · gepland: {new Date(review.scheduled_start).toLocaleString('nl-BE')}</p><p className="mt-2 text-sm">Reden: {review.reason}</p></div><div className="grid gap-2 md:grid-cols-[1fr_auto_auto]"><input type="datetime-local" value={adjusted} onChange={event=>setAdjusted(event.target.value)} className="rounded-lg border bg-background p-3"/><button disabled={busy} className="rounded-lg border p-3 font-bold" onClick={()=>submit()}>GOEDKEUREN</button><button disabled={busy||!adjusted} className="rounded-lg bg-violet-600 p-3 font-bold text-white disabled:opacity-50" onClick={()=>submit(adjusted)}>TIJD AANPASSEN</button></div>{message&&<p role="status" className="text-sm">{message}</p>}</article>
}

function formatDigital(totalSeconds:number){
 const seconds=Math.max(0,Math.floor(totalSeconds))
 const hours=Math.floor(seconds/3600)
 const minutes=Math.floor((seconds%3600)/60)
 const secs=seconds%60
 return [hours,minutes,secs].map(value=>String(value).padStart(2,'0')).join(':')
}

function LiveWorkSummary({summary,activeBreak,summaryAsOf}:{summary:Summary;activeBreak:Tables<'break_sessions'>|null;summaryAsOf:number}){
 const [now,setNow]=useState(()=>Date.now())
 useEffect(()=>{
  const timer=window.setInterval(()=>setNow(Date.now()),1000)
  return()=>window.clearInterval(timer)
 },[])
 const elapsed=Math.max(0,Math.floor((now-summaryAsOf)/1000))
 const gross=summary.gross_seconds+elapsed
 const pause=summary.break_seconds+(activeBreak?elapsed:0)
 const work=Math.max(0,gross-pause)
 const remaining=Math.max(0,summary.break_balance_seconds-(activeBreak?elapsed:0))
 return <div className="grid gap-3 sm:grid-cols-3">
  <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Werk</p><p className="font-mono text-xl font-black tabular-nums">{formatDigital(work)}</p></div>
  <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pauze</p><p className="font-mono text-xl font-black tabular-nums">{formatDigital(pause)}</p></div>
  <div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pauze over</p><p className="font-mono text-xl font-black tabular-nums">{formatDigital(remaining)}</p></div>
 </div>
}


function DriverDrivingLockNotice(){
 const [l,setL]=useState<SupportedUiLocale>(()=>activeUiLocale())
 useEffect(()=>{const fn=()=>setL(activeUiLocale());addEventListener(LANGUAGE_APPLIED_EVENT,fn);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,fn)},[])
 const copy={nl:"STOP DRIVING is verplicht vóór pauze of stopuren.",en:"STOP DRIVING is required before a break or clocking out.",fr:"STOP DRIVING est obligatoire avant une pause ou la fin du travail.",de:"STOP DRIVING ist vor einer Pause oder dem Arbeitsende erforderlich."}
 return <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 font-semibold">{copy[l]}</p>
}

function DriverBackstageDashboard({rows}:{rows:DriverDashboard[]}){
 const [l,setL]=useState<SupportedUiLocale>(()=>activeUiLocale())
 useEffect(()=>{const fn=()=>setL(activeUiLocale());addEventListener(LANGUAGE_APPLIED_EVENT,fn);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,fn)},[])
 const tx=(nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
 return <section className="space-y-3 rounded-2xl border border-violet-500/40 p-4"><div><h2 className="text-xl font-bold">{tx("Driver-overzicht","Driver overview","Aperçu chauffeurs","Fahrerübersicht")}</h2><p className="text-sm text-muted-foreground">{tx("Backstage volgt hier de actieve transporten en ETA.","Backstage tracks active transport and ETA here.","Backstage suit ici les transports actifs et les ETA.","Backstage verfolgt hier aktive Fahrten und ETA.")}</p></div>{rows.map((row,i)=><article key={row.user_id+":"+i} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{row.driver_name||tx("Driver","Driver","Chauffeur","Fahrer")}</p><p className="text-sm">{row.passenger_name||"—"}{row.address?" · "+row.address:""}</p>{row.eta_at&&<p className="text-sm font-semibold">ETA {new Date(row.eta_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</p>}</div><span className="rounded-full border px-2 py-1 text-xs font-bold">{row.driving?tx("ONDERWEG","DRIVING","EN ROUTE","UNTERWEGS"):tx("OP EVENT","AT EVENT","SUR ÉVÉNEMENT","AM EVENT")}</span></div></article>)}</section>
}

function DriverControls({s,busy,run,activeSessionId,activeDriving,summary,tasks}:{s:ReturnType<typeof createClient>;busy:boolean;run:(fn:()=>Promise<void>)=>Promise<void>;activeSessionId:string;activeDriving:DriverSession|null;summary:DriverSummary|null;tasks:DriverTask[]}){
 const [l,setL]=useState<SupportedUiLocale>(()=>activeUiLocale())
 const [taskId,setTaskId]=useState(activeDriving?.task_id||tasks.find(t=>t.status!=="completed")?.task_id||"")
 const [trackedKm,setTrackedKm]=useState(0)
 const last=useRef<{lat:number;lon:number}|null>(null)
 const selected=tasks.find(task=>task.task_id===taskId)
 const tx=(nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
 useEffect(()=>{const fn=()=>setL(activeUiLocale());addEventListener(LANGUAGE_APPLIED_EVENT,fn);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,fn)},[])
 useEffect(()=>{
  if(!activeDriving||!navigator.geolocation)return
  const id=navigator.geolocation.watchPosition(pos=>{
   const next={lat:pos.coords.latitude,lon:pos.coords.longitude},prev=last.current
   if(prev&&pos.coords.accuracy<=100){
    const r=6371,dLat=(next.lat-prev.lat)*Math.PI/180,dLon=(next.lon-prev.lon)*Math.PI/180
    const a=Math.sin(dLat/2)**2+Math.cos(prev.lat*Math.PI/180)*Math.cos(next.lat*Math.PI/180)*Math.sin(dLon/2)**2
    const km=2*r*Math.asin(Math.sqrt(a))
    if(km<2)setTrackedKm(v=>v+km)
   }
   last.current=next
  },()=>{}, {enableHighAccuracy:true,maximumAge:5000,timeout:15000})
  return()=>navigator.geolocation.clearWatch(id)
 },[activeDriving])
 const locate=()=>new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:12000,maximumAge:0}))
 async function setStatus(status:string,eta?:string){if(!selected)return;const {error}=await s.rpc("upt_driver_set_trip_status",{p_task:selected.task_id,p_status:status,p_eta:eta});if(error)throw error}
 async function startDriving(){
  if(!selected)return
  const pos=await locate()
  const {error}=await s.rpc("upt_start_driving",{p_work_session:activeSessionId,p_task:selected.task_id,p_latitude:pos.coords.latitude,p_longitude:pos.coords.longitude,p_expected_km:selected.expected_km??undefined})
  if(error)throw error
  await setStatus("driving")
 }
 async function stopDriving(){
  if(!activeDriving)return
  const pos=await locate()
  const fallback=(activeDriving.expected_km||selected?.expected_km||0)*2
  const actual=trackedKm>0.1?Math.round(trackedKm*100)/100:fallback||undefined
  const {error}=await s.rpc("upt_stop_driving",{p_driver_session:activeDriving.id,p_latitude:pos.coords.latitude,p_longitude:pos.coords.longitude,p_actual_km:actual})
  if(error)throw error
  if(selected)await setStatus("completed")
 }
 async function returning(){
  if(!selected)return
  const eta=new Date(Date.now()+(selected.estimated_drive_minutes||0)*60_000).toISOString()
  await setStatus("returning",eta)
 }
 return <div className="space-y-3 rounded-xl border border-violet-500/50 bg-violet-500/5 p-4">
  <div><p className="font-black">DRIVER</p><p className="text-sm text-muted-foreground">{activeDriving?tx("Rijtijd actief · eventtijd staat automatisch stil.","Driving time active · event time is automatically paused.","Temps de conduite actif · le temps événement est automatiquement suspendu.","Fahrzeit aktiv · Eventzeit wird automatisch pausiert."):tx("Eventtijd actief.","Event time active.","Temps événement actif.","Eventzeit aktiv.")}</p></div>
  {summary&&<div className="grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded-lg border p-2"><b>{formatDigital(summary.event_seconds)}</b><br/>{tx("Event","Event","Événement","Event")}</div><div className="rounded-lg border p-2"><b>{formatDigital(summary.driving_seconds)}</b><br/>Driving</div><div className="rounded-lg border p-2"><b>{Number(summary.total_km||0).toFixed(1)} km</b><br/>{tx("Kilometers","Kilometres","Kilomètres","Kilometer")}</div></div>}
  {!activeDriving&&<><select value={taskId} onChange={e=>setTaskId(e.target.value)} className="w-full rounded-lg border bg-background p-3"><option value="">{tx("Rit selecteren","Select trip","Sélectionner le trajet","Fahrt auswählen")}</option>{tasks.filter(task=>task.status!=="completed").map(task=><option key={task.task_id} value={task.task_id}>{task.direction==="pickup"?tx("Ophalen","Pick up","Prendre en charge","Abholen"):tx("Afzetten","Drop off","Déposer","Absetzen")} · {task.passenger_name} · {new Date(task.scheduled_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</option>)}</select>{selected&&<div className="rounded-lg border p-3 text-sm"><p className="font-bold">{selected.passenger_name}</p><a href={`tel:${selected.passenger_phone}`} className="underline">{selected.passenger_phone}</a><p>{selected.address}</p><p>{tx("Geschatte rijtijd","Estimated drive","Trajet estimé","Geschätzte Fahrzeit")}: {selected.estimated_drive_minutes??"—"} min · {selected.expected_km?.toFixed(1)??"—"} km</p><a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selected.address)}`} className="mt-2 inline-block rounded-lg border px-3 py-2 font-bold">{tx("NAVIGEREN","NAVIGATE","NAVIGUER","NAVIGIEREN")}</a></div>}<button disabled={busy||!taskId} onClick={()=>run(startDriving)} className="w-full rounded-xl bg-violet-600 p-4 font-black text-white disabled:opacity-50">START DRIVING</button></>}
  {activeDriving&&selected&&<div className="grid gap-2"><p className="text-sm font-semibold">{tx("GPS-kilometers deze rit","GPS kilometres this trip","Kilomètres GPS de ce trajet","GPS-Kilometer dieser Fahrt")}: {trackedKm.toFixed(2)} km</p>{selected.status==="driving"&&<button disabled={busy} onClick={()=>run(()=>setStatus("at_passenger"))} className="w-full rounded-xl border p-3 font-bold">{tx("AANGEKOMEN BIJ PERSOON","ARRIVED AT PERSON","ARRIVÉ CHEZ LA PERSONNE","BEI PERSON ANGEKOMMEN")}</button>}{selected.status==="at_passenger"&&<button disabled={busy} onClick={()=>run(returning)} className="w-full rounded-xl border p-3 font-bold">{tx("TERUGRIT STARTEN","START RETURN TRIP","DÉMARRER LE RETOUR","RÜCKFAHRT STARTEN")}</button>}{selected.status==="returning"&&<button disabled={busy} onClick={()=>run(stopDriving)} className="w-full rounded-xl bg-violet-600 p-4 font-black text-white">{tx("STOP DRIVING · TERUG OP EVENT","STOP DRIVING · BACK AT EVENT","STOP DRIVING · RETOUR À L’ÉVÉNEMENT","STOP DRIVING · ZURÜCK AM EVENT")}</button>}</div>}
 </div>
}
