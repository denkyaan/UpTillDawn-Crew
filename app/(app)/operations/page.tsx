import Link from 'next/link'
import { createClient } from '@/lib/supabase/crew-server'
import { getCurrentUser } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'
import OperationsClient from './operations-client'
import type { Tables, Database } from '@/types/crew-database'
import { ShiftHandoverPanel, type HandoverCandidate, type HandoverScope, type HandoverView } from '@/components/responsible/shift-handover-panel'
import { SandboxOperations } from '@/components/training/sandbox-operations'

export const dynamic='force-dynamic'

export default async function Page({searchParams}:{searchParams?:Promise<{event?:string;workplace?:string;user?:string;focus?:string;tour?:string}>}){
  const params=searchParams?await searchParams:{}
  const s=await createClient()
  const current=await getCurrentUser()
  if(!current)redirect('/login')

  if(params.tour==='1')return <SandboxOperations userName={current.full_name||'Crew'} role={current.role}/>

  const role=current.role
  const isAdmin=role==='admin'
  const isResponsible=role==='responsible_lead'
  const manager=isAdmin||isResponsible
  const nowDate=new Date()
  const now=nowDate.toISOString()
  const startWindowEnd=new Date(nowDate.getTime()+60*60*1000).toISOString()
  const windowStart=new Date(nowDate.getTime()-3*24*60*60*1000).toISOString()
  const windowEnd=new Date(nowDate.getTime()+3*24*60*60*1000).toISOString()

  const {data:candidateEvents,error:eventError}=await s.from('events')
    .select('*')
    .lte('start_at',windowEnd)
    .gte('end_at',windowStart)
    .neq('status','archived')
    .order('start_at')

  if(eventError)return <main className="p-8">Werkgegevens konden niet worden geladen. Probeer opnieuw.</main>

  const candidateEventIds=(candidateEvents||[]).map(event=>event.id)
  const shifts=candidateEventIds.length
    ? await s.from('shifts')
        .select('*')
        .eq('user_id',current.id)
        .in('event_id',candidateEventIds)
        .neq('status','cancelled')
        .lte('scheduled_start',startWindowEnd)
        .gte('scheduled_end',now)
        .order('scheduled_start')
    : {data:[],error:null}

  const session=await s.from('work_sessions')
    .select('*')
    .eq('user_id',current.id)
    .is('ended_at',null)
    .maybeSingle()

  if(shifts.error||session.error){
    return <main className="p-8">Werkgegevens konden niet worden geladen. Probeer opnieuw.</main>
  }

  let operationalEventIds=isAdmin
    ? candidateEventIds
    : [...new Set([
        ...(shifts.data||[]).map(shift=>shift.event_id),
        ...(session.data?[session.data.event_id]:[]),
      ])]
  if(isAdmin&&params.event&&candidateEventIds.includes(params.event))operationalEventIds=[params.event]

  if(!operationalEventIds.length){
    if(!isAdmin)redirect('/events')
    return <main className="p-8">Er is momenteel geen actieve evenement-, opbouw- of afbouwshift.</main>
  }

  const operationalEvents=(candidateEvents||[]).filter(event=>operationalEventIds.includes(event.id))
  const [workplaces,pause,checkins,checkouts]=await Promise.all([
    s.from('workplaces').select('*').in('event_id',operationalEventIds),
    s.from('break_sessions').select('*').eq('user_id',current.id).is('ended_at',null).maybeSingle(),
    s.from('check_ins').select('*').in('event_id',operationalEventIds).order('requested_at',{ascending:false}).limit(100),
    s.from('check_outs').select('*').in('event_id',operationalEventIds).order('requested_at',{ascending:false}).limit(100),
  ])

  if([workplaces,pause,checkins,checkouts].some(query=>query.error)){
    return <main className="p-8">Werkgegevens konden niet worden geladen. Probeer opnieuw.</main>
  }

  const personalWork=!isAdmin&&Boolean(shifts.data?.length||session.data)
  if(!isAdmin&&!personalWork&&!current.isEditMode)redirect('/events')

  const responsibleScope=!isAdmin&&manager
    ? (await s.from('responsible_assignments').select('event_id,workplace_id').eq('user_id',current.id).in('event_id',operationalEventIds)).data||[]
    : []
  const scopedWorkplaceIds=new Set([
    ...(shifts.data||[]).map(shift=>shift.workplace_id),
    ...responsibleScope.map(row=>row.workplace_id),
  ])
  const scopedWorkplaces=isAdmin
    ? [...(workplaces.data||[])].sort((a,b)=>Number(b.id===params.workplace)-Number(a.id===params.workplace))
    : (workplaces.data||[]).filter(workplace=>scopedWorkplaceIds.has(workplace.id))
  const scopedCheckins=isAdmin
    ? [...(checkins.data||[])].sort((a,b)=>Number(b.user_id===params.user||b.workplace_id===params.workplace)-Number(a.user_id===params.user||a.workplace_id===params.workplace))
    : manager
      ? (checkins.data||[]).filter(row=>row.user_id===current.id||scopedWorkplaceIds.has(row.workplace_id))
      : (checkins.data||[]).filter(row=>row.user_id===current.id)
  const scopedCheckouts=isAdmin
    ? [...(checkouts.data||[])].sort((a,b)=>Number(b.user_id===params.user||b.workplace_id===params.workplace)-Number(a.user_id===params.user||a.workplace_id===params.workplace))
    : manager
      ? (checkouts.data||[]).filter(row=>row.user_id===current.id||Boolean(row.workplace_id&&scopedWorkplaceIds.has(row.workplace_id)))
      : (checkouts.data||[]).filter(row=>row.user_id===current.id)

  const summary=personalWork&&session.data
    ? await s.rpc('upt_work_session_time_summary',{p_work_session:session.data.id})
    : null

  const [timeReviews,operationalAlerts]=await Promise.all([
    isAdmin
      ? s.from('time_review_requests').select('*').eq('status','pending').order('created_at')
      : Promise.resolve({data:[],error:null}),
    manager
      ? s.rpc('upt_operational_alerts')
      : Promise.resolve({data:[],error:null}),
  ])

  if(timeReviews.error||operationalAlerts.error){
    return <main className="p-8">Operationele controles konden niet worden geladen. Probeer opnieuw.</main>
  }

  type ManagerLiveSession=Database['public']['Functions']['upt_manager_live_sessions']['Returns'][number]
  let handoverScopes:HandoverScope[]=[]
  let handoverCandidates:HandoverCandidate[]=[]
  let handovers:HandoverView[]=[]

  if(isResponsible){
    handoverScopes=responsibleScope.map(scope=>({
      eventId:scope.event_id,
      eventName:operationalEvents.find(event=>event.id===scope.event_id)?.name||'Evenement',
      workplaceId:scope.workplace_id,
      workplaceName:scopedWorkplaces.find(workplace=>workplace.id===scope.workplace_id)?.name||'Werkplek',
    }))

    const [handoverResult,snapshotResult,candidateResults]=await Promise.all([
      s.rpc('upt_shift_handovers'),
      s.rpc('upt_shift_handover_inventory_snapshots'),
      Promise.all(responsibleScope.map(scope=>
        s.rpc('upt_handover_candidates',{p_event:scope.event_id,p_workplace:scope.workplace_id})
      )),
    ])

    if(handoverResult.error||snapshotResult.error||candidateResults.some(result=>result.error)){
      return <main className="p-8">Shift overdrachten konden niet worden geladen. Probeer opnieuw.</main>
    }

    const inventorySnapshots=new Map((snapshotResult.data||[]).map(row=>[row.handover_id,row.inventory_snapshot]))
    handovers=(handoverResult.data||[])
      .filter(row=>operationalEventIds.includes(row.event_id))
      .map(row=>({
        id:row.id,
        eventId:row.event_id,
        workplaceId:row.workplace_id,
        outgoingResponsibleId:row.outgoing_responsible_id,
        outgoingName:row.outgoing_name||'Verantwoordelijke',
        incomingResponsibleId:row.incoming_responsible_id||null,
        incomingName:row.incoming_name||null,
        status:row.status==='accepted'?'accepted':row.status==='ready'?'ready':'draft',
        openTaskIds:row.open_task_ids||[],
        openIncidentIds:row.open_incident_ids||[],
        equipmentNotes:row.equipment_notes||null,
        notes:row.notes||null,
        createdAt:row.created_at,
        updatedAt:row.updated_at,
        readyAt:row.ready_at||null,
        acceptedAt:row.accepted_at||null,
        inventorySnapshot:inventorySnapshots.get(row.id)||null,
      }))

    handoverCandidates=candidateResults.flatMap((result,index)=>{
      const scope=responsibleScope[index]
      return (result.data||[]).map(candidate=>({
        eventId:scope.event_id,
        workplaceId:scope.workplace_id,
        userId:candidate.user_id,
        fullName:candidate.full_name||'Verantwoordelijke',
      }))
    })
  }

  let liveSessions:ManagerLiveSession[]=[]
  let liveBreaks:Tables<'break_sessions'>[]=[]
  let crewDirectory:Array<{id:string;full_name:string|null;phone_number:string|null;profile_photo_url:string|null}>=[]

  if(manager){
    const liveResult=await s.rpc('upt_manager_live_sessions')
    if(liveResult.error){
      return <main className="p-8">Live personeelstatus kon niet worden geladen. Probeer opnieuw.</main>
    }
    liveSessions=(liveResult.data||[]).filter(row=>operationalEventIds.includes(row.event_id))
    const liveSessionIds=liveSessions.map(row=>row.session_id)
    if(liveSessionIds.length){
      const breaksResult=await s.from('break_sessions')
        .select('*')
        .in('work_session_id',liveSessionIds)
        .order('started_at')
      if(breaksResult.error){
        return <main className="p-8">Live pauzestatus kon niet worden geladen. Probeer opnieuw.</main>
      }
      liveBreaks=breaksResult.data||[]
    }

    if(isAdmin){
      const {data}=await s.from('profiles').select('id,full_name,phone_number,profile_photo_url').eq('approved',true)
      crewDirectory=data||[]
    }else{
      const rows=await Promise.all(responsibleScope.map(assignment=>
        s.rpc('upt_responsible_crew_directory',{event_uuid:assignment.event_id,workplace_uuid:assignment.workplace_id})
      ))
      const unique=new Map<string,(typeof crewDirectory)[number]>()
      for(const row of rows)for(const member of row.data||[])unique.set(member.id,member)
      crewDirectory=[...unique.values()]
    }
  }

  return <>
    {isAdmin&&<div className="mx-auto flex max-w-4xl flex-wrap gap-2 px-4 pt-4 md:px-8 md:pt-8">
      <Link id="tijdcorrecties" href="/admin/time-records" className="scroll-mt-24 rounded-xl border px-4 py-3 text-sm font-bold">Tijdcorrecties</Link>
      <Link id="excel-export" href="/exports" className="scroll-mt-24 rounded-xl border px-4 py-3 text-sm font-bold">Excel exporteren</Link>
      <span className="self-center text-xs text-muted-foreground">Werkuren, correcties en export horen bij dezelfde tijdregistratieworkflow.</span>
    </div>}
    {isResponsible&&handoverScopes.length>0&&<div className="mx-auto max-w-4xl px-4 pt-4 md:px-8 md:pt-8">
      <ShiftHandoverPanel
        userId={current.id}
        scopes={handoverScopes}
        candidates={handoverCandidates}
        handovers={handovers}
      />
    </div>}
    <OperationsClient
    userId={current.id}
    shifts={shifts.data||[]}
    events={operationalEvents}
    workplaces={scopedWorkplaces}
    activeSession={personalWork?session.data:null}
    activeBreak={personalWork?pause.data:null}
    checkins={scopedCheckins}
    checkouts={scopedCheckouts}
    manager={manager}
    isAdmin={isAdmin}
    personalWork={personalWork}
    summary={summary?.data?.[0]||null}
    summaryAsOf={nowDate.getTime()}
    liveSessions={liveSessions}
    liveBreaks={liveBreaks}
    crewDirectory={crewDirectory}
    timeReviews={timeReviews.data||[]}
    operationalAlerts={operationalAlerts.data||[]}
    focusUserId={params.user||null}
    focusWorkplaceId={params.workplace||null}
    focusKind={params.focus||null}
  />
  </>
}
