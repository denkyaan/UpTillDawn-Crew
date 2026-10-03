import { createClient } from '@/lib/supabase/crew-server'
import { addWorkplace,assignResponsible,demoteResponsibleToStaff,updateWorkplace } from '@/lib/actions/uptilldawn'
import { AdminOnly } from '@/components/auth/admin-only'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { responsibleCoverageGaps } from '@/lib/responsible-coverage-health'
import { coverageWindows } from '@/lib/staffing-coverage'
import { staffNeededForTarget, workplaceStaffingState } from '@/lib/workplace-capacity'
import { WorkplaceShiftPlanner, type WorkplacePlannerPerson, type WorkplacePlannerShift } from '@/components/crew/workplace-shift-planner'
import { DateInput } from '@/components/crew/date-input'
import { ShiftChangeCenter, type ClaimableShift, type ShiftChangeRequestView, type ShiftReplacementCandidate, type ShiftSwapCandidate } from '@/components/crew/shift-change-controls'
import { ContextLink } from '@/components/admin/context-link'

export const dynamic='force-dynamic'

type Person={id:string;full_name:string|null;role?:string|null}

export default async function Page({searchParams}:{searchParams?:Promise<{event?:string;workplace?:string}>}){
  const params=searchParams?await searchParams:{}
  const s=await createClient()
  const current=await getCurrentUser()
  if(!current)return null
  const user={id:current.id}
  const requestNow=new Date().toISOString()

  const isAdmin=current.role==='admin'
  const isResponsible=current.role==='responsible_lead'
  const isStaff=current.role==='staff'||current.role==='employee'
  if(!isAdmin&&!isResponsible&&!isStaff)redirect('/')

  let events:Array<{id:string;name:string}>=[]
  let catalogWorkplaces:Array<{id:string;name:string;description:string|null;sort_order:number}>=[]
  let workplaces:Array<{
    id:string
    event_id:string
    name:string
    description:string|null
    sort_order:number
    is_active:boolean
    minimum_staff:number
    target_staff:number
    maximum_staff:number|null
    default_shift_start:string|null
    default_shift_end:string|null
    events:{name:string;start_at:string;end_at:string}|null
  }>=[]
  let assignedCrew:Array<{
    id:string
    full_name:string|null
    event_id:string
    workplace_id:string
    role_name:string
  }>=[]
  let responsibleAssignments:Array<{workplace_id:string;user_id:string}>=[]
  let coverageShifts:Array<{userId:string;workplaceId:string;startsAt:number;endsAt:number}>=[]
  let plannerShifts:WorkplacePlannerShift[]=[]
  const plannerPeopleByEvent=new Map<string,WorkplacePlannerPerson[]>()
  let peopleById=new Map<string,Person>()
  let shiftChangeRequests:ShiftChangeRequestView[]=[]
  let claimableShifts:ClaimableShift[]=[]
  const replacementCandidatesByShift=new Map<string,ShiftReplacementCandidate[]>()
  const swapCandidatesByShift=new Map<string,ShiftSwapCandidate[]>()
  let shiftChangeError=false

  if(isAdmin){
    const [
      {data:eventRows,error:eventRowsError},
      {data:catalogRows},
      {data:workplaceRows,error:workplaceRowsError},
      {data:shiftRows},
      {data:profileRows},
      {data:responsibleRows},
      {data:availabilityRows},
    ]=await Promise.all([
      s.from('events').select('id,name,start_at,end_at').neq('status','archived').order('start_at'),
      s.from('workplace_catalog').select('id,name,description,sort_order').eq('is_active',true).order('sort_order').order('name'),
      s.from('workplaces').select('id,event_id,name,description,sort_order,is_active,minimum_staff,target_staff,maximum_staff,default_shift_start,default_shift_end').eq('is_active',true).order('sort_order'),
      s.from('shifts').select('id,event_id,workplace_id,user_id,role_name,shift_kind,status,response_status,response_reason,confirmed_at,scheduled_start,scheduled_end,overlap_allowed').neq('status','cancelled').neq('response_status','declined').order('scheduled_start'),
      s.from('profiles').select('id,full_name,role').eq('approved',true).order('full_name'),
      s.from('responsible_assignments').select('workplace_id,user_id'),
      s.from('event_availability').select('event_id,user_id,response,setup_available,breakdown_available').or('response.eq.can,setup_available.eq.true,breakdown_available.eq.true'),
    ])
    if(eventRowsError)throw new Error('Evenementen konden niet worden geladen: '+eventRowsError.message)
    if(workplaceRowsError)throw new Error('Werkplaatsen konden niet worden geladen: '+workplaceRowsError.message)
    events=(eventRows||[]).map(event=>({id:event.id,name:event.name}))
    catalogWorkplaces=catalogRows||[]
    const adminEventById=new Map((eventRows||[]).map(event=>[event.id,{name:event.name,start_at:event.start_at,end_at:event.end_at}]))
    workplaces=(workplaceRows||[]).map(workplace=>({...workplace,events:adminEventById.get(workplace.event_id)||null}))
    peopleById=new Map((profileRows||[]).map(person=>[person.id,person]))
    responsibleAssignments=responsibleRows||[]
    coverageShifts=(shiftRows||[]).filter(shift=>shift.status!=='cancelled'&&shift.response_status!=='declined').map(shift=>({userId:shift.user_id,workplaceId:shift.workplace_id,startsAt:Date.parse(shift.scheduled_start),endsAt:Date.parse(shift.scheduled_end)}))
    plannerShifts=(shiftRows||[]).map(shift=>({
      id:shift.id,
      workplaceId:shift.workplace_id,
      userId:shift.user_id,
      roleName:shift.role_name,
      shiftKind:shift.shift_kind==='setup'?'setup':shift.shift_kind==='breakdown'?'breakdown':'event',
      scheduledStart:shift.scheduled_start,
      scheduledEnd:shift.scheduled_end,
      status:shift.status||'scheduled',
      responseStatus:shift.response_status||'pending',
      responseReason:shift.response_reason||null,
      confirmedAt:shift.confirmed_at||null,
      overlapAllowed:Boolean(shift.overlap_allowed),
    }))
    for(const availability of availabilityRows||[]){
      const person=peopleById.get(availability.user_id)
      if(!person)continue
      const current=plannerPeopleByEvent.get(availability.event_id)||[]
      current.push({
        id:availability.user_id,
        fullName:person.full_name||'Naam ontbreekt',
        eventAvailable:availability.response==='can',
        setupAvailable:Boolean(availability.setup_available),
        breakdownAvailable:Boolean(availability.breakdown_available),
      })
      plannerPeopleByEvent.set(availability.event_id,current)
    }
    const seen=new Set<string>()
    assignedCrew=(shiftRows||[]).flatMap(shift=>{
      const person=peopleById.get(shift.user_id)
      const key=`${shift.workplace_id}:${shift.user_id}`
      if(!person||seen.has(key))return []
      seen.add(key)
      return [{
        id:shift.user_id,
        full_name:person.full_name,
        event_id:shift.event_id,
        workplace_id:shift.workplace_id,
        role_name:shift.role_name,
      }]
    })
  }else{
    const [{data:ownShifts},{data:ownResponsible}]=await Promise.all([
      s.from('shifts').select('event_id,workplace_id,scheduled_start,scheduled_end').eq('user_id',user.id).neq('status','cancelled').neq('response_status','declined'),
      s.from('responsible_assignments').select('event_id,workplace_id').eq('user_id',user.id),
    ])
    const workplaceIds=[...new Set([
      ...(ownShifts||[]).map(row=>row.workplace_id),
      ...(ownResponsible||[]).map(row=>row.workplace_id),
    ])]
    const eventIds=[...new Set([
      ...(ownShifts||[]).map(row=>row.event_id),
      ...(ownResponsible||[]).map(row=>row.event_id),
    ])]
    if(!eventIds.length||!workplaceIds.length)redirect('/events')

    const [{data:eventRows,error:eventRowsError},{data:workplaceRows,error:workplaceRowsError}]=await Promise.all([
      s.from('events').select('id,name,start_at,end_at').in('id',eventIds).neq('status','archived').order('start_at'),
      s.from('workplaces').select('id,event_id,name,description,sort_order,is_active,minimum_staff,target_staff,maximum_staff,default_shift_start,default_shift_end').in('id',workplaceIds).order('sort_order'),
    ])
    if(eventRowsError)throw new Error('Evenementen konden niet worden geladen: '+eventRowsError.message)
    if(workplaceRowsError)throw new Error('Werkplaatsen konden niet worden geladen: '+workplaceRowsError.message)
    const nowMs=Date.parse(requestNow)
    const futureShiftEventIds=new Set((ownShifts||[]).filter(shift=>Date.parse(shift.scheduled_end)>=nowMs).map(shift=>shift.event_id))
    const responsibleEventIds=new Set((ownResponsible||[]).map(row=>row.event_id))
    const visibleEventRows=(eventRows||[]).filter(event=>
      Date.parse(event.end_at)>=nowMs
      || futureShiftEventIds.has(event.id)
      || (responsibleEventIds.has(event.id)&&Date.parse(event.end_at)+3*24*60*60*1000>=nowMs)
    )
    events=visibleEventRows.map(event=>({id:event.id,name:event.name}))
    const assignedEventById=new Map(visibleEventRows.map(event=>[event.id,{name:event.name,start_at:event.start_at,end_at:event.end_at}]))
    workplaces=(workplaceRows||[]).filter(workplace=>assignedEventById.has(workplace.event_id)).map(workplace=>({...workplace,events:assignedEventById.get(workplace.event_id)||null}))
    if(!events.length||!workplaces.length)redirect('/events')

    if(isResponsible){
      const [{data:shiftRows},{data:responsibleRows}]=await Promise.all([
        s.from('shifts').select('id,event_id,workplace_id,user_id,role_name,shift_kind,status,response_status,response_reason,confirmed_at,scheduled_start,scheduled_end,overlap_allowed').in('workplace_id',workplaceIds).neq('status','cancelled').neq('response_status','declined').order('scheduled_start'),
        s.from('responsible_assignments').select('event_id,workplace_id,user_id').in('workplace_id',workplaceIds),
      ])
      const memberResults=await Promise.all(workplaces.map(workplace=>
        s.rpc('upt_responsible_event_members',{p_event:workplace.event_id,p_workplace:workplace.id})
      ))
      const people=new Map<string,Person>()
      for(const result of memberResults){
        for(const person of result.data||[])people.set(person.id,{id:person.id,full_name:person.full_name,role:null})
      }
      peopleById=people
      responsibleAssignments=(responsibleRows||[]).map(row=>({workplace_id:row.workplace_id,user_id:row.user_id}))
      coverageShifts=(shiftRows||[]).filter(shift=>shift.response_status!=='declined').map(shift=>({userId:shift.user_id,workplaceId:shift.workplace_id,startsAt:Date.parse(shift.scheduled_start),endsAt:Date.parse(shift.scheduled_end)}))
      plannerShifts=(shiftRows||[]).map(shift=>({
        id:shift.id,
        workplaceId:shift.workplace_id,
        userId:shift.user_id,
        roleName:shift.role_name,
        shiftKind:shift.shift_kind==='setup'?'setup':shift.shift_kind==='breakdown'?'breakdown':'event',
        scheduledStart:shift.scheduled_start,
        scheduledEnd:shift.scheduled_end,
        status:shift.status,
        responseStatus:shift.response_status||'pending',
        responseReason:shift.response_reason||null,
        confirmedAt:shift.confirmed_at||null,
        overlapAllowed:Boolean(shift.overlap_allowed),
      }))
      const seen=new Set<string>()
      assignedCrew=(shiftRows||[]).flatMap(shift=>{
        const person=peopleById.get(shift.user_id)
        const key=`${shift.workplace_id}:${shift.user_id}`
        if(!person||seen.has(key))return []
        seen.add(key)
        return [{
          id:shift.user_id,
          full_name:person.full_name,
          event_id:shift.event_id,
          workplace_id:shift.workplace_id,
          role_name:shift.role_name,
        }]
      })
    }
    if(isStaff){
      const [{data:shiftRows},{data:profileRow}]=await Promise.all([
        s.from('shifts').select('id,event_id,workplace_id,user_id,role_name,shift_kind,status,response_status,response_reason,confirmed_at,scheduled_start,scheduled_end,overlap_allowed').eq('user_id',user.id).in('workplace_id',workplaceIds).neq('status','cancelled').order('scheduled_start'),
        s.from('profiles').select('id,full_name,role').eq('id',user.id).single(),
      ])
      if(profileRow)peopleById=new Map([[profileRow.id,profileRow]])
      plannerShifts=(shiftRows||[]).map(shift=>({
        id:shift.id,
        workplaceId:shift.workplace_id,
        userId:shift.user_id,
        roleName:shift.role_name,
        shiftKind:shift.shift_kind==='setup'?'setup':shift.shift_kind==='breakdown'?'breakdown':'event',
        scheduledStart:shift.scheduled_start,
        scheduledEnd:shift.scheduled_end,
        status:shift.status||'scheduled',
        responseStatus:shift.response_status||'pending',
        responseReason:shift.response_reason||null,
        confirmedAt:shift.confirmed_at||null,
        overlapAllowed:Boolean(shift.overlap_allowed),
      }))
      coverageShifts=(shiftRows||[]).filter(shift=>shift.response_status!=='declined').map(shift=>({
        userId:shift.user_id,
        workplaceId:shift.workplace_id,
        startsAt:Date.parse(shift.scheduled_start),
        endsAt:Date.parse(shift.scheduled_end),
      }))
      assignedCrew=(shiftRows||[]).map(shift=>({
        id:shift.user_id,
        full_name:profileRow?.full_name||'Personeelslid',
        event_id:shift.event_id,
        workplace_id:shift.workplace_id,
        role_name:shift.role_name,
      }))
    }
  }

  const [{data:shiftChangeRows,error:shiftChangeRowsError},{data:claimableRows,error:claimableRowsError}]=await Promise.all([
    s.rpc('upt_shift_change_requests'),
    isAdmin?Promise.resolve({data:[],error:null}):s.rpc('upt_claimable_shifts'),
  ])
  shiftChangeError=Boolean(shiftChangeRowsError||claimableRowsError)
  shiftChangeRequests=(shiftChangeRows||[]).map(row=>({
    id:row.id,
    type:row.type==='swap'?'swap':row.type==='claim-open-shift'?'claim-open-shift':'replacement',
    shiftId:row.shift_id,
    targetShiftId:row.target_shift_id||null,
    requesterId:row.requester_id,
    requesterName:row.requester_name||'Personeelslid',
    replacementUserId:row.replacement_user_id||null,
    replacementName:row.replacement_name||null,
    status:row.status==='approved'?'approved':row.status==='rejected'?'rejected':row.status==='cancelled'?'cancelled':'pending',
    replacementResponse:row.replacement_response==='accepted'?'accepted':row.replacement_response==='declined'?'declined':row.replacement_response==='not-required'?'not-required':'pending',
    reason:row.reason,
    decisionReason:row.decision_reason||null,
    sourceScheduledStart:row.source_scheduled_start,
    sourceScheduledEnd:row.source_scheduled_end,
    sourceRoleName:row.source_role_name,
    sourceWorkplaceName:row.source_workplace_name,
    targetScheduledStart:row.target_scheduled_start||null,
    targetScheduledEnd:row.target_scheduled_end||null,
    targetRoleName:row.target_role_name||null,
    targetWorkplaceName:row.target_workplace_name||null,
    isStale:row.is_stale,
  }))
  claimableShifts=(claimableRows||[]).map(row=>({
    shiftId:row.shift_id,
    eventName:row.event_name,
    workplaceName:row.workplace_name,
    roleName:row.role_name,
    shiftKind:row.shift_kind,
    scheduledStart:row.scheduled_start,
    scheduledEnd:row.scheduled_end,
  }))

  if(!isAdmin){
    const ownCandidateShifts=plannerShifts.filter(shift=>
      shift.userId===user.id&&shift.status!=='cancelled'&&shift.responseStatus!=='declined'
    )
    const candidateResults=await Promise.all(ownCandidateShifts.map(async shift=>{
      const [replacementResult,swapResult]=await Promise.all([
        s.rpc('upt_shift_change_candidates',{p_shift:shift.id}),
        s.rpc('upt_swap_candidates',{p_shift:shift.id}),
      ])
      return {shiftId:shift.id,replacementResult,swapResult}
    }))
    for(const result of candidateResults){
      if(result.replacementResult.error||result.swapResult.error){
        shiftChangeError=true
        continue
      }
      replacementCandidatesByShift.set(
        result.shiftId,
        (result.replacementResult.data||[]).map(row=>({
          userId:row.user_id,
          fullName:row.full_name||'Personeelslid',
        })),
      )
      swapCandidatesByShift.set(
        result.shiftId,
        (result.swapResult.data||[]).map(row=>({
          targetShiftId:row.target_shift_id,
          userId:row.user_id,
          fullName:row.full_name||'Personeelslid',
          workplaceName:row.workplace_name,
          roleName:row.role_name,
          scheduledStart:row.scheduled_start,
          scheduledEnd:row.scheduled_end,
        })),
      )
    }
  }

  const responsibleKeys=new Set(responsibleAssignments.map(row=>`${row.workplace_id}:${row.user_id}`))
  const displayWorkplaces=[...workplaces].sort((a,b)=>{
    const aSelected=(params.workplace&&a.id===params.workplace)||(params.event&&a.event_id===params.event)
    const bSelected=(params.workplace&&b.id===params.workplace)||(params.event&&b.event_id===params.event)
    return Number(bSelected)-Number(aSelected)||a.sort_order-b.sort_order||a.name.localeCompare(b.name,'nl')
  })

  return <main id="werkplaatsbeheer" className="scroll-mt-24 space-y-5 p-4 md:p-8">
    <div>
      <h1 className="text-3xl font-black">Werkplaatsen & shifts</h1>
      {isAdmin
        ? <p className="text-sm text-muted-foreground">Plan werkplaatsen, verantwoordelijken, personeel en shifturen in één workflow. Vanuit elke werkplek open je direct Inventaris, Inkom & Guestlist, Taken en Briefing met dezelfde context.</p>
        : isResponsible
          ? <p className="text-sm text-muted-foreground">Bekijk je werkplekken, team en gekoppelde diensten/uren in één overzicht. Werkplekken aanmaken of verwijderen blijft voor admin.</p>
          : <p className="text-sm text-muted-foreground">Bekijk je toegewezen werkplek, shifturen en bevestig of weiger je dienst vanuit hetzelfde scherm.</p>}
    </div>

    {shiftChangeError&&<div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <p className="text-sm font-bold text-amber-700">Planningwaarschuwing</p>
      <p className="mt-1 text-sm text-muted-foreground">Niet alle shiftwijzigingen konden worden geladen. Je bestaande planning blijft behouden. Vernieuw de pagina.</p>
    </div>}
    <ShiftChangeCenter
      userId={user.id}
      isAdmin={isAdmin}
      requests={shiftChangeRequests}
      claimableShifts={claimableShifts}
    />

    {isAdmin&&<AdminOnly>
      <section className="space-y-3 rounded-2xl border border-violet-500/30 p-4">
        <div>
          <h2 className="text-xl font-black">Standaardwerkposten</h2>
          <p className="text-sm text-muted-foreground">Deze werkposten worden automatisch vooraf aangemaakt voor elk evenement. Daarnaast kun je onbeperkt eigen werkplaatsen toevoegen buiten deze standaardlijst.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {catalogWorkplaces.map(workplace=><span key={workplace.id} className="rounded-full border px-3 py-2 text-sm font-semibold">{workplace.name}</span>)}
        </div>
      </section>

      <details className="rounded-2xl border p-4">
        <summary className="cursor-pointer font-semibold">Eigen / extra werkplek toevoegen</summary>
      <form action={addWorkplace} className="mt-3 grid gap-2 md:grid-cols-2">
        <select name="event_id" required className="rounded-lg border bg-background p-3">
          <option value="">Evenement…</option>
          {events.map(event=><option key={event.id} value={event.id}>{event.name}</option>)}
        </select>
        <input name="name" required maxLength={200} placeholder="Nieuwe werkplek" className="rounded-lg border bg-background p-3"/>
        <label className="grid gap-1 text-sm font-semibold">Omschrijving (optioneel)<input name="description" maxLength={1000} placeholder="Korte uitleg over deze werkplek" className="rounded-lg border bg-background p-3 font-normal"/><span className="text-xs font-normal text-muted-foreground">Beschrijf wat deze werkplek doet of waarvoor ze wordt gebruikt.</span></label>
        <details className="rounded-xl border p-3 md:col-span-2">
          <summary className="cursor-pointer font-semibold">Bezettingsregels (optioneel)</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="grid gap-1 text-sm">Minimum<input name="minimum_staff" type="number" min="0" max="10000" defaultValue="0" className="rounded-lg border bg-background p-2"/></label>
            <label className="grid gap-1 text-sm">Doel<input name="target_staff" type="number" min="0" max="10000" defaultValue="0" className="rounded-lg border bg-background p-2"/></label>
            <label className="grid gap-1 text-sm">Maximum<input name="maximum_staff" type="number" min="0" max="10000" placeholder="Geen limiet" className="rounded-lg border bg-background p-2"/></label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Minimum en doel gelden voor de evenementuren. Maximum wordt ook server-side afgedwongen bij nieuwe of gewijzigde diensten.</p>
        </details>
        <div className="md:col-span-2">
          <p className="mb-2 text-sm font-semibold">Standaard werkuren voor deze werkplek</p>
          <div className="grid gap-2 md:grid-cols-2">
            <DateInput name="default_shift_start" required/>
            <DateInput name="default_shift_end" required/>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Deze uren worden automatisch voorgesteld wanneer je personeel aan deze werkplek koppelt.</p>
        </div>
                <button className="rounded-lg bg-violet-600 px-4 py-3 font-bold md:col-span-2">EXTRA WERKPLEK TOEVOEGEN</button>
      </form>
      </details>
    </AdminOnly>}

    <div className="grid gap-3 md:grid-cols-2">
      {displayWorkplaces.map(workplace=>{
        const crew=assignedCrew.filter(person=>person.workplace_id===workplace.id)
        const responsiblePeople=responsibleAssignments
          .filter(row=>row.workplace_id===workplace.id)
          .map(row=>peopleById.get(row.user_id))
          .filter((person):person is Person=>Boolean(person))
        const workplaceCoverageShifts=coverageShifts.filter(shift=>shift.workplaceId===workplace.id)
        const coverageGaps=responsibleCoverageGaps(
          workplace.id,
          workplaceCoverageShifts,
          responsibleAssignments.map(row=>({userId:row.user_id,workplaceId:row.workplace_id})),
        )
        const capacity={
          workplaceId:workplace.id,
          minimumStaff:workplace.minimum_staff,
          targetStaff:workplace.target_staff,
          maximumStaff:workplace.maximum_staff,
        }
        const staffingCoverage=workplace.events
          ? coverageWindows({
              workplaceId:workplace.id,
              startsAt:Date.parse(workplace.events.start_at),
              endsAt:Date.parse(workplace.events.end_at),
              requiredStaff:workplace.minimum_staff,
            },workplaceCoverageShifts)
          : []
        const staffingConfigured=workplace.minimum_staff>0||workplace.target_staff>0||workplace.maximum_staff!==null
        const staffingStates=staffingCoverage.map(window=>workplaceStaffingState(capacity,window.assignedStaff))
        const staffingState=staffingStates.includes('understaffed')
          ? 'understaffed'
          : staffingStates.includes('overstaffed')
            ? 'overstaffed'
            : 'target'
        const staffingGaps=staffingCoverage.filter(window=>window.shortfall>0)
        const overCapacity=workplace.maximum_staff===null
          ? []
          : staffingCoverage.filter(window=>window.assignedStaff>workplace.maximum_staff!)
        const targetNeed=staffingCoverage.reduce(
          (maximum,window)=>Math.max(maximum,staffNeededForTarget(capacity,window.assignedStaff)),
          0,
        )
        const selected=params.workplace===workplace.id||(Boolean(params.event)&&params.event===workplace.event_id)
        return <article id={'workplace-'+workplace.id} key={workplace.id} className={'rounded-2xl border p-4 '+(selected?'border-violet-500/70 ring-1 ring-violet-500/20':'')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <b>{workplace.name}</b>
              <p className="text-sm text-muted-foreground">{workplace.events?.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{workplace.description||'Geen omschrijving toegevoegd.'}</p>
            </div>
            <span className="rounded-full border px-2 py-1 text-xs">{workplace.is_active?'ACTIEF':'INACTIEF'}</span>
          </div>

          {isAdmin&&<AdminOnly>
            <details className="mt-3 rounded-xl border p-3">
              <summary className="cursor-pointer font-semibold">Werkplek bewerken</summary>
              <form action={updateWorkplace} className="mt-3 grid gap-2">
                <input type="hidden" name="workplace_id" value={workplace.id}/>
                <input name="name" required maxLength={200} defaultValue={workplace.name} className="rounded-lg border bg-background p-2"/>
                <textarea name="description" maxLength={1000} defaultValue={workplace.description||''} placeholder="Omschrijving (optioneel)" className="rounded-lg border bg-background p-2"/>
                <input type="hidden" name="sort_order" value={workplace.sort_order}/>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="grid gap-1 text-sm">Standaard startuur<DateInput name="default_shift_start" initial={workplace.default_shift_start||undefined} required/></label>
                  <label className="grid gap-1 text-sm">Standaard einduur<DateInput name="default_shift_end" initial={workplace.default_shift_end||undefined} required/></label>
                </div>
                <p className="text-xs text-muted-foreground">Nieuwe personeelsdiensten op deze werkplek nemen deze uren standaard over.</p>
                                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="grid gap-1 text-sm">Minimum<input name="minimum_staff" type="number" min="0" max="10000" defaultValue={workplace.minimum_staff} className="rounded-lg border bg-background p-2"/></label>
                  <label className="grid gap-1 text-sm">Doel<input name="target_staff" type="number" min="0" max="10000" defaultValue={workplace.target_staff} className="rounded-lg border bg-background p-2"/></label>
                  <label className="grid gap-1 text-sm">Maximum<input name="maximum_staff" type="number" min="0" max="10000" defaultValue={workplace.maximum_staff??''} placeholder="Geen limiet" className="rounded-lg border bg-background p-2"/></label>
                </div>
                <label className="flex items-center gap-2 text-sm"><input name="is_active" type="checkbox" defaultChecked={workplace.is_active}/>Actief</label>
                <button className="rounded-lg border px-3 py-2 font-semibold">WIJZIGINGEN OPSLAAN</button>
              </form>
            </details>
          </AdminOnly>}

          {isAdmin&&<div className="mt-3 space-y-2"><p className="text-xs font-semibold text-muted-foreground">Werkplekmodules — context blijft automatisch behouden.</p><div className="flex flex-wrap gap-2">
            <ContextLink href="/inventory" context={{eventId:workplace.event_id,workplaceId:workplace.id,focus:'inventory'}} className="rounded-lg border px-3 py-2 text-xs font-bold" title="Beheer materiaal, voorraad, ontbrekende en beschadigde items voor deze werkplek.">Inventaris</ContextLink>
            {/^(inkom|entrance)(\s*&\s*(guestlist|guest list))?$|^(guestlist|guest list)$/i.test(workplace.name.trim())&&<ContextLink href="/guestlist" context={{eventId:workplace.event_id,workplaceId:workplace.id,focus:'guestlist'}} className="rounded-lg border px-3 py-2 text-xs font-bold" title="Open de guestlist, voeg gasten of artiesten toe en importeer een bestand.">Guestlist maken & beheren</ContextLink>}
            {/bar|toog|counter|comptoir|theke|merch|token|jeton/i.test(workplace.name)&&<ContextLink href="/sales" context={{eventId:workplace.event_id,workplaceId:workplace.id,focus:'sales'}} className="rounded-lg border px-3 py-2 text-xs font-bold" title="Voer de prijslijst in of upload ze en open de verkoop voor deze werkplek.">Prijslijst & Sales</ContextLink>}
            <ContextLink href="/tasks" context={{eventId:workplace.event_id,workplaceId:workplace.id,focus:'tasks'}} className="rounded-lg border px-3 py-2 text-xs font-bold" title="Open taken in de context van deze werkplek.">Taken</ContextLink>
            <ContextLink href="/briefings" context={{eventId:workplace.event_id,workplaceId:workplace.id,focus:'briefing'}} className="rounded-lg border px-3 py-2 text-xs font-bold" title="Open briefing en checklists voor deze werkplek.">Briefing</ContextLink>
          </div></div>}

          <div className="mt-3 space-y-3">
            <WorkplaceShiftPlanner
              workplaceId={workplace.id}
              eventId={workplace.event_id}
              isAdmin={isAdmin}
              currentUserId={user.id}
              defaultStart={workplace.default_shift_start||workplace.events?.start_at||undefined}
              defaultEnd={workplace.default_shift_end||workplace.events?.end_at||undefined}
              people={isAdmin?plannerPeopleByEvent.get(workplace.event_id)||[]:[...peopleById.values()].map(person=>({id:person.id,fullName:person.full_name||'Naam ontbreekt',eventAvailable:true,setupAvailable:true,breakdownAvailable:true}))}
              shifts={plannerShifts.filter(shift=>shift.workplaceId===workplace.id)}
              replacementCandidatesByShift={replacementCandidatesByShift}
              swapCandidatesByShift={swapCandidatesByShift}
              openRequestShiftIds={shiftChangeRequests.filter(row=>row.status==='pending'&&row.requesterId===user.id).map(row=>row.shiftId)}
            />
            {staffingConfigured&&<section className="rounded-xl border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">Bezettingsplanning</p>
                  <p className="text-xs text-muted-foreground">Min. {workplace.minimum_staff} · doel {workplace.target_staff} · max. {workplace.maximum_staff??'geen limiet'}</p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-xs font-bold ${staffingState==='understaffed'?'border-amber-500/50 text-amber-600':staffingState==='overstaffed'?'border-red-500/50 text-red-600':'border-emerald-500/50 text-emerald-600'}`}>
                  {staffingState==='understaffed'?'ONDERBEZET':staffingState==='overstaffed'?'OVERBEZET':'CAPACITEIT OK'}
                </span>
              </div>
              {targetNeed>0&&<p className="mt-2 text-xs text-muted-foreground">Tot {targetNeed} extra medewerker(s) nodig om het doel tijdens alle evenementuren te halen.</p>}
              {staffingGaps.length>0&&<div className="mt-2 space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-muted-foreground">
                <p className="font-semibold text-amber-700">Onderbezetting tijdens deze uren</p>
                {staffingGaps.slice(0,3).map(gap=><p key={`staff:${gap.startsAt}:${gap.endsAt}`}>{new Date(gap.startsAt).toLocaleString('nl-BE')} → {new Date(gap.endsAt).toLocaleString('nl-BE')} · {gap.assignedStaff}/{workplace.minimum_staff}</p>)}
                {staffingGaps.length>3&&<p>+ {staffingGaps.length-3} extra onderbezette periode(s)</p>}
              </div>}
              {overCapacity.length>0&&<p className="mt-2 text-xs font-semibold text-red-600">{overCapacity.length} periode(s) overschrijden de ingestelde maximumbezetting.</p>}
            </section>}
            <section className="rounded-xl border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Verantwoordelijke</p>
                {workplaceCoverageShifts.length>0&&<span className={`rounded-full border px-2 py-1 text-xs font-bold ${coverageGaps.length?'border-amber-500/50 text-amber-600':'border-emerald-500/50 text-emerald-600'}`}>
                  {coverageGaps.length?`${coverageGaps.length} DEKKINGSGAT${coverageGaps.length===1?'':'EN'}`:'DEKKING OK'}
                </span>}
              </div>
              {coverageGaps.length>0&&<div className="mt-2 space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-muted-foreground">
                <p className="font-semibold text-amber-700">Geen verantwoordelijke dekking tijdens deze uren</p>
                {coverageGaps.slice(0,3).map(gap=><p key={`${gap.startsAt}:${gap.endsAt}`}>{new Date(gap.startsAt).toLocaleString('nl-BE')} → {new Date(gap.endsAt).toLocaleString('nl-BE')}</p>)}
                {coverageGaps.length>3&&<p>+ {coverageGaps.length-3} extra dekkingsgat(en)</p>}
              </div>}
              {responsiblePeople.length
                ? <div className="mt-2 space-y-2">{responsiblePeople.map(person=>
                    <div key={person.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-500/30 p-2">
                      <span className="font-semibold">
                        {person.full_name||'Naam ontbreekt'}{person.id===user.id?' (jij)':''}
                      </span>
                      {isAdmin&&person.role==='responsible_lead'&&<AdminOnly>
                        <form action={demoteResponsibleToStaff}>
                          <input type="hidden" name="workplace_id" value={workplace.id}/>
                          <input type="hidden" name="user_id" value={person.id}/>
                          <button className="rounded-lg border px-3 py-2 text-xs font-bold">PERSONEEL MAKEN</button>
                        </form>
                      </AdminOnly>}
                    </div>
                  )}</div>
                : <p className="mt-2 text-sm text-muted-foreground">Nog geen verantwoordelijke toegewezen.</p>}
            </section>

            <section className="rounded-xl border p-3">
              <p className="font-semibold">Personeel op deze werkplek</p>
              {crew.length
                ? <div className="mt-2 space-y-2">{crew.map(person=>{
                    const responsible=responsibleKeys.has(`${workplace.id}:${person.id}`)
                    return <div key={person.id} className="flex items-center justify-between gap-3 rounded-lg border p-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{person.full_name||'Naam ontbreekt'}{person.id===user.id?' (jij)':''}</p>
                        <p className="text-xs text-muted-foreground">{person.role_name}</p>
                      </div>
                      {responsible&&<span className="rounded-full border border-violet-500/50 px-2 py-1 text-xs font-bold">VERANTWOORDELIJKE</span>}
                    </div>
                  })}</div>
                : <p className="mt-2 text-sm text-muted-foreground">Nog niemand ingepland op deze werkplek.</p>}
            </section>

            {isAdmin&&crew.length>0&&<AdminOnly><form action={assignResponsible} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="workplace_id" value={workplace.id}/>
              <select name="user_id" required className="min-w-0 flex-1 rounded-lg border bg-background p-2">
                <option value="">Kies toegewezen persoon…</option>
                {crew.map(person=>{
                  const responsible=responsibleKeys.has(`${workplace.id}:${person.id}`)
                  return <option key={person.id} value={person.id} disabled={responsible}>
                    {person.full_name||'Naam ontbreekt'}{person.id===user.id?' (jij)':''}{responsible?' — al verantwoordelijk':''}
                  </option>
                })}
              </select>
              <button className="rounded-lg border px-3 py-2 font-semibold">VERANTWOORDELIJKHEID TOEWIJZEN</button>
            </form></AdminOnly>}
          </div>
        </article>
      })}
    </div>

    {!workplaces.length&&<p className="rounded-xl border p-4 text-muted-foreground">{isAdmin?'Geen actieve werkplaatsen gevonden voor de beschikbare evenementen.':'Geen toegewezen werkplaatsen beschikbaar.'}</p>}
  </main>
}
