import Link from 'next/link'
import { SandboxEvents } from '@/components/training/sandbox-events'
import { DateInput } from '@/components/crew/date-input'
import { AdminOnly } from '@/components/auth/admin-only'
import { GeoapifyPlaceFields } from '@/components/events/geoapify-place-fields'
import { FacebookEventField } from '@/components/events/facebook-event-field'
import { ArchiveEventButton } from '@/components/events/archive-event-button'
import { ArchiveCenter } from '@/components/events/archive-center'
import { ContextLink } from '@/components/admin/context-link'
import { EmergencyInformationPanel } from '@/components/crew/emergency-information-panel'
import { EventDocumentsPanel } from '@/components/crew/event-documents-panel'
import { nlStatus } from '@/lib/ui-nl'
import { createClient } from '@/lib/supabase/crew-server'
import { getCurrentUser } from '@/lib/actions/auth'
import { applyEventTemplate, captureEventTemplate } from '@/lib/actions/events'
import {
  addWorkplace,
  assignAvailableCrewShift,
  createEvent,
  duplicateEvent,
  setEventAvailability,
  updateEvent,
} from '@/lib/actions/uptilldawn'

export const dynamic = 'force-dynamic'
const input='rounded-lg border bg-background p-3'

export default async function Page({searchParams}:{searchParams?:Promise<{event?:string;tour?:string}>}){
  const params=searchParams?await searchParams:{}
  const s=await createClient()
  const user=await getCurrentUser()
  if(!user)return null
  if(params.tour==='1'&&!user.isAdmin)return <SandboxEvents/>

  const [eventsResult,membershipResult,shiftResult,startedResult,availabilityResult,responsibleResult,emergencyResult]=await Promise.all([
    s.from('events').select('id,name,venue,address,start_at,end_at,registration_deadline,max_joiners,status,latitude,longitude,checkin_radius_m,archived_at,archived_by,archive_reason,restored_at,restored_by,pre_archive_status').order('start_at'),
    s.from('event_members').select('event_id,user_id'),
    s.from('shifts').select('event_id,workplace_id,workplaces(name)').eq('user_id',user.id).neq('status','cancelled').neq('response_status','declined'),
    s.from('events').select('id').lte('start_at','now'),
    s.from('event_availability').select('event_id,user_id,response,setup_available,breakdown_available,updated_at,queue_joined_at'),
    s.from('responsible_assignments').select('event_id,workplace_id,workplaces(name,is_active)').eq('user_id',user.id),
    s.from('event_emergency_information').select('*'),
  ])
  const templateResult=user.isAdmin
    ? await s.from('event_templates').select('id,name,sections,source_event_id,created_at').order('updated_at',{ascending:false})
    : {data:[],error:null}
  const peopleResult=user.isAdmin
    ? await s.from('profiles').select('id,full_name,preferred_workplace_id').eq('approved',true).order('full_name')
    : {data:[],error:null}
  const [workplacesResult,adminShiftsResult]=user.isAdmin
    ? await Promise.all([
        s.from('workplaces').select('id,event_id,name,is_active,catalog_workplace_id').order('sort_order'),
        s.from('shifts').select('id,event_id,workplace_id,user_id,role_name,scheduled_start,scheduled_end,status,shift_kind').order('scheduled_start'),
      ])
    : [{data:[],error:null},{data:[],error:null}]

  const events=eventsResult.data||[]
  const people=peopleResult.data||[]
  const activeEvents=events.filter(event=>event.status!=='archived')
  const archivedEvents=events.filter(event=>event.status==='archived').sort((a,b)=>Date.parse(b.archived_at||b.end_at)-Date.parse(a.archived_at||a.end_at))
  const workplaces=workplacesResult.data||[]
  const adminShifts=adminShiftsResult.data||[]
  const memberships=membershipResult.data||[]
  const availability=availabilityResult.data||[]
  const startedEventIds=new Set((startedResult.data||[]).map(event=>event.id))
  const assignedEventIds=new Set([
    ...memberships.filter(row=>row.user_id===user.id).map(row=>row.event_id),
    ...(shiftResult.data||[]).map(row=>row.event_id),
    ...(user.role==='responsible_lead'?(responsibleResult.data||[]).map(row=>row.event_id):[]),
  ])
  const nowMs=new Date().getTime()
  const baseVisibleEvents=user.isAdmin
    ? activeEvents
    : activeEvents.filter(event=>{
        const end=Date.parse(event.end_at)
        const visibleWhileOpen=event.status!=='archived'&&nowMs<=end
        const assigned=assignedEventIds.has(event.id)&&nowMs<=end+3*24*60*60*1000
        return visibleWhileOpen||assigned
      })
  const visibleEvents=[...baseVisibleEvents].sort((a,b)=>Number(b.id===params.event)-Number(a.id===params.event)||Date.parse(a.start_at)-Date.parse(b.start_at))
  const memberKeys=new Set(memberships.map(row=>`${row.event_id}:${row.user_id}`))
  const peopleById=new Map(people.map(person=>[person.id,person]))
  const emergencyByEvent=new Map((emergencyResult.data||[]).map(row=>[row.event_id,row]))

  return <main id="eventbeheer" className="scroll-mt-24 space-y-6 p-4 md:p-8">
    <div>
      <h1 className="text-3xl font-black">Evenementen</h1>
      <p className="text-sm text-muted-foreground">Beheer de volledige eventlevenscyclus: planning, briefing, readiness, documenten, afsluiting en archief. Klik op een evenement om de context mee te nemen naar andere modules.</p>
    </div>

    {user.isAdmin&&<AdminOnly><form action={createEvent} className="grid gap-3 rounded-2xl border p-4">
      <FacebookEventField/>
      <div className="rounded-xl border p-3">
        <p className="mb-3 text-sm font-semibold">Handmatige gegevens / fallback</p>
        <div className="grid gap-3">
          <input name="name" maxLength={200} placeholder="Evenementnaam" className={input}/>
          <GeoapifyPlaceFields/>
          <div className="grid gap-3 md:grid-cols-3">
            <DateInput name="start_at" required={false}/>
            <DateInput name="end_at" required={false}/>
            <label className="grid gap-1 text-sm">Aanmelddeadline (leeg = start evenement)<DateInput name="registration_deadline" required={false}/></label>
            <label className="grid gap-1 text-sm">Maximum bevestigde deelnemers<input name="max_joiners" type="number" min="1" max="10000" placeholder="Onbeperkt" className={input}/></label>
            <label className="grid gap-1 text-sm">GPS-radius (m)<input name="radius" type="number" defaultValue="100" min="10" max="10000" className={input}/></label>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Bij een openbare Facebook-link worden gevonden naam, locatie en evenementuren automatisch gebruikt. Ontbrekende gegevens worden uit de handmatige velden genomen.</p>
      <button className="rounded-xl bg-violet-600 p-3 font-bold">EVENEMENT AANMAKEN</button>
    </form></AdminOnly>}

    {user.isAdmin&&<AdminOnly><section className="space-y-4 rounded-2xl border p-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">EVENTTEMPLATES</p>
        <h2 className="text-xl font-black">Event hergebruiken</h2>
        <p className="text-sm text-muted-foreground">Sla een bestaand event op als template of maak een nieuw event vanuit werkplekken, briefing, taken, checklists en inventory.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <form action={captureEventTemplate} className="grid gap-2 rounded-xl border p-3">
          <b>Template maken van bestaand event</b>
          <select name="event_id" required className={input}><option value="">Bron-event…</option>{activeEvents.map(event=><option key={event.id} value={event.id}>{event.name}</option>)}</select>
          <input name="template_name" required minLength={3} maxLength={200} placeholder="Templatenaam" className={input}/>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {['workplaces','briefing','tasks','checklists','inventory'].map(section=><label key={section} className="flex items-center gap-2 rounded-lg border p-2"><input type="checkbox" name={'section_'+section} defaultChecked/>{section}</label>)}
          </div>
          <button className="rounded-xl bg-violet-600 p-3 font-bold text-white">TEMPLATE OPSLAAN</button>
        </form>
        <form action={applyEventTemplate} className="grid gap-2 rounded-xl border p-3">
          <b>Nieuw event vanuit template</b>
          <select name="template_id" required className={input}><option value="">Template…</option>{(templateResult.data||[]).map(template=><option key={template.id} value={template.id}>{template.name}</option>)}</select>
          <input name="name" required maxLength={200} placeholder="Naam nieuw evenement" className={input}/>
          <DateInput name="start_at" required/>
          <DateInput name="end_at" required/>
          <input name="venue" maxLength={200} placeholder="Locatie/venue (optioneel)" className={input}/>
          <input name="address" maxLength={500} placeholder="Adres (optioneel)" className={input}/>
          <button className="rounded-xl bg-violet-600 p-3 font-bold text-white">EVENT VAN TEMPLATE MAKEN</button>
        </form>
      </div>
    </section></AdminOnly>}

    {eventsResult.error&&<p>Evenementen konden niet worden geladen.</p>}
    {!eventsResult.error&&!visibleEvents.length&&<p className="rounded-xl border p-4 text-muted-foreground">Geen evenementen beschikbaar.</p>}

    <div className="space-y-3">{visibleEvents.map(event=>{
      const started=startedEventIds.has(event.id)
      const ended=nowMs>Date.parse(event.end_at)
      const registrationDeadline=event.registration_deadline||event.start_at
      const registrationOpen=event.status!=='archived'&&nowMs<Date.parse(registrationDeadline)
      const confirmedCount=memberships.filter(row=>row.event_id===event.id).length
      const capacityFull=event.max_joiners!==null&&confirmedCount>=event.max_joiners
      const myAvailability=availability.find(row=>row.event_id===event.id&&row.user_id===user.id)
      const myResponse=myAvailability?.response
      const eventWorkplaces=user.isAdmin?workplaces.filter(workplace=>workplace.event_id===event.id&&workplace.is_active):[]
      const preferenceName=(userId:string)=>{
        const preferred=peopleById.get(userId)?.preferred_workplace_id
        if(!preferred)return 'Geen voorkeur'
        return eventWorkplaces.find(workplace=>workplace.catalog_workplace_id===preferred)?.name||'Andere voorkeur'
      }
      const canRows=user.isAdmin
        ? availability
            .filter(row=>row.event_id===event.id&&(row.response==='can'||row.setup_available===true||row.breakdown_available===true))
            .sort((a,b)=>{
              const aMember=memberKeys.has(`${event.id}:${a.user_id}`)
              const bMember=memberKeys.has(`${event.id}:${b.user_id}`)
              if(aMember!==bMember)return aMember?-1:1
              const preferenceCompare=preferenceName(a.user_id).localeCompare(preferenceName(b.user_id),'nl')
              if(preferenceCompare!==0)return preferenceCompare
              const aq=a.queue_joined_at?Date.parse(a.queue_joined_at):Number.MAX_SAFE_INTEGER
              const bq=b.queue_joined_at?Date.parse(b.queue_joined_at):Number.MAX_SAFE_INTEGER
              return aq-bq||a.user_id.localeCompare(b.user_id)
            })
        :[]
      const responsibleWorkplaces=user.role==='responsible_lead'
        ? (responsibleResult.data||[])
            .filter(row=>row.event_id===event.id&&row.workplaces?.is_active!==false)
            .map(row=>({id:row.workplace_id,label:row.workplaces?.name||'Werkplek'}))
        : []
      const staffWorkplaces=user.role==='staff'
        ? (shiftResult.data||[])
            .filter(row=>row.event_id===event.id&&row.workplace_id)
            .map(row=>({id:row.workplace_id,label:row.workplaces?.name||'Werkplek'}))
        : []
      const rawDocumentWorkplaces=user.isAdmin
        ? eventWorkplaces.map(workplace=>({id:workplace.id,label:workplace.name}))
        : user.role==='responsible_lead'
          ? responsibleWorkplaces
          : staffWorkplaces
      const documentWorkplaceOptions=[...new Map(rawDocumentWorkplaces.map(item=>[item.id,item])).values()]
      const canManageDocuments=user.isAdmin||(user.role==='responsible_lead'&&responsibleWorkplaces.length>0)
      const chatUntil=new Date(new Date(event.end_at).getTime()+3*24*60*60*1000)
      const assigned=assignedEventIds.has(event.id)
      return <details key={event.id} open={event.id===params.event||undefined} className={'rounded-2xl border bg-card '+(event.id===params.event?'border-violet-500/70 ring-1 ring-violet-500/20':'')}>
        <summary className="cursor-pointer list-none p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">{event.name}</h2>
              <p className="text-sm text-muted-foreground">{event.venue||'Locatie nog niet ingesteld'} · {new Date(event.start_at).toLocaleString('nl-BE')} · {nlStatus(event.status)}</p>
              {event.address&&<p className="text-xs text-muted-foreground">{event.address}</p>}
              {event.max_joiners!==null&&<p className="text-xs font-semibold text-muted-foreground">{confirmedCount}/{event.max_joiners} bevestigd{capacityFull?' · VOL':''}</p>}
            </div>
            {!started&&<span className="rounded-full border px-2 py-1 text-xs font-bold">Toekomstig</span>}
            {started&&!ended&&<span className="rounded-full border border-emerald-500/50 px-2 py-1 text-xs font-bold text-emerald-600">LOPEND</span>}
            {assigned&&<span className="rounded-full border px-2 py-1 text-xs font-bold">Toegewezen</span>}
          </div>
        </summary>

        <div className="space-y-4 border-t p-4">
          <div className="flex flex-wrap gap-2">
            <ContextLink href={'/events/'+event.id+'/command'} context={{eventId:event.id}} className="inline-flex rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold text-white">COMMAND CENTER</ContextLink>
            {user.isAdmin&&<ContextLink href="/briefings" context={{eventId:event.id,focus:'briefing'}} className="inline-flex rounded-xl border px-3 py-2 text-sm font-bold" title="Beheer briefing, bevestigingen en eventchecklists.">Briefing beheren</ContextLink>}
            {user.isAdmin&&<ContextLink href="/workplaces" context={{eventId:event.id}} className="inline-flex rounded-xl border px-3 py-2 text-sm font-bold" title="Open werkplaatsen, verantwoordelijken, personeel en shifts voor dit evenement.">Werkplaatsen & shifts</ContextLink>}
          </div>
          {!user.isAdmin&&assigned&&<Link href={'/onboarding?event='+event.id} className="inline-flex rounded-xl border px-3 py-2 text-sm font-bold">Onboarding openen</Link>}
          <EmergencyInformationPanel
            compact
            canEdit={user.isAdmin}
            info={{
              eventId:event.id,
              eventName:event.name,
              eventAddress:event.address||'',
              emergencyNumber:emergencyByEvent.get(event.id)?.emergency_number||'',
              firstAidContact:emergencyByEvent.get(event.id)?.first_aid_contact||null,
              securityContact:emergencyByEvent.get(event.id)?.security_contact||null,
              assemblyPoint:emergencyByEvent.get(event.id)?.assembly_point||null,
              procedure:emergencyByEvent.get(event.id)?.procedure||null,
              updatedAt:emergencyByEvent.get(event.id)?.updated_at||null,
            }}
          />

          <EventDocumentsPanel
            eventId={event.id}
            canManage={canManageDocuments}
            allowEventWide={user.isAdmin}
            workplaceOptions={documentWorkplaceOptions}
          />

          {!user.isAdmin&&<div className="rounded-xl border p-3 text-sm">
            <p><span className="font-semibold">Aanmelddeadline:</span> {new Date(registrationDeadline).toLocaleString('nl-BE')}</p>
            {!registrationOpen&&<p className="mt-1 font-semibold text-amber-600">Aanmelddeadline verstreken. Je kunt dit evenement nog bekijken, maar niet meer joinen.</p>}
            {capacityFull&&<p className="mt-1 font-semibold text-amber-600">Maximum aantal bevestigde deelnemers bereikt. Als er een plaats vrijkomt, krijgt de wachtlijst voorrang.</p>}
          </div>}

          {!user.isAdmin&&registrationOpen&&<section className="space-y-3">
            <p className="font-semibold">Beschikbaarheid bevestigen</p>
            <form action={setEventAvailability} className="grid gap-3 rounded-xl border p-3 md:grid-cols-3">
              <input type="hidden" name="event_id" value={event.id}/>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">Evenement</legend>
                <label className="flex items-center gap-2"><input required type="radio" name="response" value="can" defaultChecked={myResponse==='can'}/> Ja</label>
                <label className="flex items-center gap-2"><input required type="radio" name="response" value="cannot" defaultChecked={myResponse==='cannot'}/> Nee</label>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">Opbouw</legend>
                <label className="flex items-center gap-2"><input required type="radio" name="setup_available" value="yes" defaultChecked={myAvailability?.setup_available===true}/> Ja</label>
                <label className="flex items-center gap-2"><input required type="radio" name="setup_available" value="no" defaultChecked={myAvailability?.setup_available===false}/> Nee</label>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">Afbouw</legend>
                <label className="flex items-center gap-2"><input required type="radio" name="breakdown_available" value="yes" defaultChecked={myAvailability?.breakdown_available===true}/> Ja</label>
                <label className="flex items-center gap-2"><input required type="radio" name="breakdown_available" value="no" defaultChecked={myAvailability?.breakdown_available===false}/> Nee</label>
              </fieldset>
              <button className="rounded-xl bg-violet-600 p-3 font-bold text-white md:col-span-3">BESCHIKBAARHEID OPSLAAN</button>
            </form>
          </section>}

          {!user.isAdmin&&!registrationOpen&&!ended&&(assigned||myResponse==='can')&&<form action={setEventAvailability} className="rounded-xl border border-amber-500/40 p-3">
            <input type="hidden" name="event_id" value={event.id}/>
            <input type="hidden" name="response" value="cannot"/>
            <input type="hidden" name="setup_available" value="no"/>
            <input type="hidden" name="breakdown_available" value="no"/>
            <p className="mb-2 text-sm">Kun je toch niet meer deelnemen? Afmelden blijft mogelijk na de aanmelddeadline.</p>
            <label className="mb-3 grid gap-1 text-sm font-semibold">Reden van afmelding
              <textarea name="reason" required minLength={3} maxLength={1000} placeholder="Geef kort aan waarom je niet meer kunt deelnemen." className={input}/>
            </label>
            <button className="rounded-lg border border-red-500/50 px-3 py-2 text-sm font-bold text-red-500">IK KAN TOCH NIET</button>
          </form>}

          {!user.isAdmin&&started&&assigned&&<div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 text-sm">
            <p className="text-muted-foreground">Na afloop blijft de eventchat beschikbaar tot {chatUntil.toLocaleString('nl-BE')}.</p>
            <Link href="/chat" className="mt-2 inline-block rounded-lg bg-violet-600 px-3 py-2 font-bold text-white">Chats openen</Link>
          </div>}

          {user.isAdmin&&<AdminOnly><div className="space-y-4">
            <section className="space-y-3 rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold">Beschikbare mensen</h3>
                  <p className="text-sm text-muted-foreground">Wijs hier meteen een werkplek, diensturen en functie toe.</p>
                </div>
                <span className="text-sm text-muted-foreground">{canRows.length}</span>
              </div>

              {!eventWorkplaces.length&&<div className="rounded-xl border border-amber-500/40 p-3">
                <p className="text-sm font-semibold">Maak eerst minstens één werkplek voor dit evenement.</p>
                <form action={addWorkplace} className="mt-3 grid gap-2 md:grid-cols-2">
                  <input type="hidden" name="event_id" value={event.id}/>
                  <input name="name" required maxLength={200} placeholder="Nieuwe werkplek" className={input}/>
                  <input name="description" maxLength={1000} placeholder="Omschrijving (optioneel)" className={input}/>
                  <input type="hidden" name="sort_order" value="0"/>
                  <button className="rounded-xl bg-violet-600 px-4 py-3 font-bold text-white md:col-span-2">WERKPLEK TOEVOEGEN</button>
                </form>
              </div>}

              {canRows.length
                ? <div className="space-y-3">{canRows.map(row=>{
                    const person=peopleById.get(row.user_id)
                    const alreadyAdded=memberKeys.has(`${event.id}:${row.user_id}`)
                    const waitingRows=canRows.filter(candidate=>candidate.response==='can'&&!memberKeys.has(`${event.id}:${candidate.user_id}`))
                    const waitlistPosition=!alreadyAdded&&row.response==='can'
                      ? waitingRows.findIndex(candidate=>candidate.user_id===row.user_id)+1
                      : 0
                    const existingShifts=adminShifts.filter(shift=>shift.event_id===event.id&&shift.user_id===row.user_id&&shift.status!=='cancelled')
                    return <article key={row.user_id} className="rounded-xl border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">{person?.full_name||row.user_id}</p>
                          <p className="text-xs font-semibold text-violet-500">Voorkeur: {preferenceName(row.user_id)}</p>
                          <p className="text-xs text-muted-foreground">
                            {alreadyAdded?'Toegevoegd aan evenement':waitlistPosition>0?`Wachtlijst #${waitlistPosition}`:'Nog niet toegewezen'}
                            {existingShifts.length?` · ${existingShifts.length} dienst(en)`:''}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1 text-xs font-bold">
                          {row.response==='can'&&<span className="rounded-full border border-emerald-500/50 px-2 py-1 text-emerald-600">EVENT</span>}
                          {row.setup_available&&<span className="rounded-full border border-sky-500/50 px-2 py-1 text-sky-500">OPBOUW</span>}
                          {row.breakdown_available&&<span className="rounded-full border border-amber-500/50 px-2 py-1 text-amber-500">AFBOUW</span>}
                        </div>
                      </div>

                      {existingShifts.length>0&&<div className="mt-2 space-y-1 rounded-lg bg-muted/40 p-2 text-xs">
                        {existingShifts.map(shift=>{
                          const workplace=eventWorkplaces.find(item=>item.id===shift.workplace_id)
                          return <p key={shift.id}>
                            {workplace?.name||'Werkplek'} · {shift.shift_kind==='setup'?'Opbouw':shift.shift_kind==='breakdown'?'Afbouw':'Evenement'} · {shift.role_name} · {new Date(shift.scheduled_start).toLocaleString('nl-BE')} → {new Date(shift.scheduled_end).toLocaleString('nl-BE')}
                          </p>
                        })}
                      </div>}

                      {eventWorkplaces.length>0&&<form action={assignAvailableCrewShift} className="mt-3 grid gap-2 md:grid-cols-2">
                        <input type="hidden" name="event_id" value={event.id}/>
                        <input type="hidden" name="user_id" value={row.user_id}/>
                        <label className="grid gap-1 text-sm">Werkplek
                          <select name="workplace_id" required className={input}>
                            <option value="">Werkplek kiezen…</option>
                            {eventWorkplaces.map(workplace=><option key={workplace.id} value={workplace.id}>{workplace.name}</option>)}
                          </select>
                        </label>
                        <label className="grid gap-1 text-sm">Rol / functie
                          <input name="role_name" required maxLength={200} placeholder="bv. Ticket Scan, Bar, Artistbegeleiding" className={input}/>
                        </label>
                        <label className="grid gap-1 text-sm">Shift-type
                          <select name="shift_kind" defaultValue={row.response==='can'?'event':row.setup_available?'setup':'breakdown'} className={input}>
                            {row.response==='can'&&<option value="event">Evenement</option>}
                            {row.setup_available&&<option value="setup">Opbouw — max. 3 dagen vooraf</option>}
                            {row.breakdown_available&&<option value="breakdown">Afbouw — max. 3 dagen nadien</option>}
                          </select>
                        </label>
                        <DateInput name="start" initial={event.start_at}/>
                        <DateInput name="end" initial={event.end_at}/>
                        <label className="flex items-center gap-2 text-sm md:col-span-2">
                          <input type="checkbox" name="overlap_allowed"/> Overlappende dienst expliciet toestaan
                        </label>
                        <button className="rounded-xl bg-violet-600 px-4 py-3 font-bold text-white md:col-span-2">
                          {alreadyAdded?'DIENST TOEVOEGEN':'TOEWIJZEN + DIENST AANMAKEN'}
                        </button>
                      </form>}
                    </article>
                  })}</div>
                : <p className="text-sm text-muted-foreground">Nog niemand heeft beschikbaarheid bevestigd.</p>}
            </section>

            <details className="rounded-xl border p-3">
              <summary className="cursor-pointer font-semibold">Alle informatie bewerken</summary>
              <form action={updateEvent} className="mt-3 grid gap-3">
                <input type="hidden" name="event_id" value={event.id}/>
                <input aria-label="Evenementnaam" name="name" required maxLength={200} defaultValue={event.name} className={input}/>
                <GeoapifyPlaceFields defaultVenue={event.venue} defaultAddress={event.address} defaultLatitude={event.latitude} defaultLongitude={event.longitude}/>
                <div className="grid gap-3 md:grid-cols-3">
                  <DateInput name="start_at" initial={event.start_at}/>
                  <DateInput name="end_at" initial={event.end_at}/>
                  <label className="grid gap-1 text-sm">Aanmelddeadline<DateInput name="registration_deadline" initial={registrationDeadline}/></label>
                  <label className="grid gap-1 text-sm">Maximum bevestigde deelnemers<input name="max_joiners" type="number" min="1" max="10000" defaultValue={event.max_joiners??''} placeholder="Onbeperkt" className={input}/></label>
                  <label className="grid gap-1 text-sm">GPS-radius (m)<input name="radius" type="number" min={10} max={10000} defaultValue={event.checkin_radius_m} className={input}/></label>
                </div>
                <button className="rounded-xl bg-violet-600 p-3 font-bold">WIJZIGINGEN OPSLAAN</button>
              </form>
            </details>

            <details className="rounded-xl border p-3">
              <summary className="cursor-pointer font-semibold">Evenement dupliceren</summary>
              <form action={duplicateEvent} className="mt-3 grid gap-2">
                <input type="hidden" name="event_id" value={event.id}/>
                <input name="name" required maxLength={200} defaultValue={`${event.name} — kopie`} className={input}/>
                <DateInput name="start_at"/>
                <DateInput name="end_at"/>
                <button className="rounded-xl border p-3">Configuratie kopiëren</button>
              </form>
            </details>

            <ArchiveEventButton eventId={event.id} eventName={event.name} eventStatus={event.status}/>
          </div></AdminOnly>}
        </div>
      </details>
    })}</div>

    {user.isAdmin&&<AdminOnly><ArchiveCenter events={archivedEvents.map(event=>({id:event.id,name:event.name,venue:event.venue,address:event.address,startAt:event.start_at,endAt:event.end_at,archivedAt:event.archived_at,archivedByName:event.archived_by?peopleById.get(event.archived_by)?.full_name||null:null,archiveReason:event.archive_reason,preArchiveStatus:event.pre_archive_status}))}/></AdminOnly>}
  </main>
}
