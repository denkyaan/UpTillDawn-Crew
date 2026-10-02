import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, Clock3, MapPin, AlertTriangle, ArrowRight, ClipboardCheck, PackageCheck, ListTodo } from 'lucide-react'
import { createClient } from '@/lib/supabase/crew-server'
import { ManagerOnly } from '@/components/auth/manager-only'
import { AssignedEventOnly } from '@/components/auth/assigned-event-only'
import { getCurrentUser } from '@/lib/actions/auth'
import { ResponsibleLivePersonnel, type ResponsibleLivePerson } from '@/components/responsible/responsible-live-personnel'
import { StaffWorkplacePersonnel, type StaffWorkplacePerson } from '@/components/crew/staff-workplace-personnel'

export const dynamic = 'force-dynamic'

function Card({ href, icon: Icon, title, value }: { href: string; icon: typeof CalendarDays; title: string; value: number }) {
  return <Link href={href} className="rounded-2xl border border-border bg-card p-5">
    <div className="flex items-center justify-between"><Icon className="h-5 w-5 text-violet-400"/><ArrowRight className="h-4 w-4 text-muted-foreground"/></div>
    <div className="mt-5 text-3xl font-black">{value}</div>
    <div className="text-sm text-muted-foreground">{title}</div>
  </Link>
}

export default async function Dashboard() {
  const s = await createClient()
  const current = await getCurrentUser()
  if (!current) return null
  if (current.isAdmin) redirect('/admin')
  const user = { id: current.id }

  const nowDate = new Date()
  const nowMs = nowDate.getTime()
  const [profileResult, eventsResult, shiftsResult, incidentsResult, membershipsResult, responsibleAssignmentsResult] = await Promise.all([
    s.from('profiles').select('full_name,approved').eq('id', user.id).single(),
    s.from('events').select('id,name,venue,end_at,status').neq('status','archived').order('start_at', { ascending: true }),
    s.from('shifts').select('id,workplace_id,event_id,scheduled_start,scheduled_end,response_status').eq('user_id', user.id).neq('status','cancelled').neq('response_status','declined').order('scheduled_start', { ascending: true }),
    s.from('incidents').select('id,event_id,workplace_id').neq('status', 'resolved'),
    s.from('event_members').select('event_id,event_role').eq('user_id', user.id),
    s.from('responsible_assignments').select('event_id,workplace_id').eq('user_id', user.id),
  ])

  const profile = profileResult.data
  if (profile && !profile.approved) {
    return <div className="p-8"><div className="mx-auto mt-20 max-w-xl rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center"><h1 className="text-2xl font-black">ACCOUNT NOG NIET GOEDGEKEURD</h1><p className="mt-2 text-muted-foreground">Je account wacht op goedkeuring door een beheerder.</p></div></div>
  }

  const rawEvents = eventsResult.data || []
  const shifts = shiftsResult.data || []
  const memberships = membershipsResult.data || []
  const activeEventIds = new Set(rawEvents.filter(event=>Date.parse(event.end_at)>=nowMs).map(event=>event.id))
  const openEventIds = new Set(rawEvents.filter(event=>Date.parse(event.end_at)>=nowMs).map(event=>event.id))
  const responsibleAssignments=responsibleAssignmentsResult.data||[]
  const assignedEventIds=new Set([
    ...memberships.map(member=>member.event_id),
    ...shifts.map(shift=>shift.event_id),
    ...(current.role==='responsible_lead'?responsibleAssignments.map(row=>row.event_id):[]),
  ])
  const events=rawEvents.filter(event=>{
    const end=Date.parse(event.end_at)
    const visibleWhileOpen=event.status!=='archived'&&nowMs<=end
    const assigned=assignedEventIds.has(event.id)&&nowMs<=end+3*24*60*60*1000
    return visibleWhileOpen||assigned
  })
  const hasEventAssignment = memberships.some(member => openEventIds.has(member.event_id))
    || shifts.some(shift=>Date.parse(shift.scheduled_end)>=nowMs)
    || (current.role==='responsible_lead'&&responsibleAssignments.some(row=>{
      const event=rawEvents.find(item=>item.id===row.event_id)
      return Boolean(event&&Date.parse(event.end_at)+3*24*60*60*1000>=nowMs)
    }))
  const activeResponsibleAssignments=responsibleAssignments
    .filter(assignment=>activeEventIds.has(assignment.event_id))
  const activeResponsibleWorkplaces=new Set(activeResponsibleAssignments.map(assignment=>assignment.workplace_id))
  const hasActiveIncidentContext = current.role === 'responsible_lead' && activeResponsibleAssignments.length>0
  const activeIncidentCount = (incidentsResult.data || []).filter(incident =>
    Boolean(
      incident.event_id
      && activeEventIds.has(incident.event_id)
      && incident.workplace_id
      && activeResponsibleWorkplaces.has(incident.workplace_id)
    )
  ).length

  // Keep the authenticated landing render fast and deterministic. Live personnel widgets
  // refresh on their dedicated operational surfaces instead of blocking the root RSC response.
  const responsibleLivePeople:ResponsibleLivePerson[]=[]
  const responsibleLiveError=false
  const staffLivePeople:StaffWorkplacePerson[]=[]
  const staffLiveError=false

  const overviewSources=[profileResult,eventsResult,shiftsResult,incidentsResult,membershipsResult,responsibleAssignmentsResult]
  const failedOverviewSources=overviewSources.filter(result=>result.error).length+Number(responsibleLiveError)+Number(staffLiveError)
  const hasLoadError=failedOverviewSources>0

  return <main className="mx-auto max-w-7xl space-y-7 p-4 pb-28 md:p-8">
    <div>
      <p className="text-xs font-bold tracking-[.2em] text-violet-400">UP TILL DAWN PERSONEELSBEHEER</p>
      <h1 className="mt-1 text-3xl font-black">Welkom, {profile?.full_name || 'Personeelslid'}</h1>
      <p className="text-muted-foreground">Je operationele personeelsoverzicht.</p>
    </div>
    {hasLoadError && <p className="rounded-xl border border-amber-500/40 p-4">Een deel van de realtime gegevens is tijdelijk niet beschikbaar. De beschikbare onderdelen blijven bruikbaar.</p>}
    <section className="grid gap-4 md:grid-cols-3">
      <Card href="/events" icon={CalendarDays} title="Evenementen" value={events.length}/>
      <AssignedEventOnly available={hasEventAssignment}><Card href="/workplaces" icon={Clock3} title="Werkplaatsen & shifts" value={shifts.length}/></AssignedEventOnly>
      {hasActiveIncidentContext && <ManagerOnly><Card href="/incidents" icon={AlertTriangle} title="Open incidenten" value={activeIncidentCount}/></ManagerOnly>}
    </section>
    {current.role==='staff'&&hasEventAssignment&&<section className="space-y-3 rounded-2xl border bg-card p-4">
      <div><h2 className="text-lg font-bold">Mijn evenement</h2><p className="text-sm text-muted-foreground">Directe toegang tot je toegewezen werk, instructies en materiaal.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/operations" className="rounded-xl border p-4"><Clock3 className="mb-3 h-5 w-5 text-violet-400"/><p className="font-bold">Mijn werkuren</p><p className="text-xs text-muted-foreground">Start, pauze en stop je werk via de geldige workflow.</p></Link>
        <Link href="/briefings" className="rounded-xl border p-4"><ClipboardCheck className="mb-3 h-5 w-5 text-violet-400"/><p className="font-bold">Briefing</p><p className="text-xs text-muted-foreground">Lees en bevestig je instructies vóór je shift.</p></Link>
        <Link href="/workplaces" className="rounded-xl border p-4"><MapPin className="mb-3 h-5 w-5 text-violet-400"/><p className="font-bold">Werkplaats & shift</p><p className="text-xs text-muted-foreground">Bekijk waar en wanneer je bent ingepland.</p></Link>
        <Link href="/inventory" className="rounded-xl border p-4"><PackageCheck className="mb-3 h-5 w-5 text-violet-400"/><p className="font-bold">Inventaris</p><p className="text-xs text-muted-foreground">Bekijk materiaal van je toegewezen werkplek.</p></Link>
      </div>
    </section>}
    {current.role==='staff'&&<section className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Personeel van mijn werkplek</h2>
          <p className="text-sm text-muted-foreground">Live status van personeel op jouw werkplek.</p>
        </div>
        <span className="text-sm text-muted-foreground">{staffLivePeople.length} actief</span>
      </div>
      <StaffWorkplacePersonnel people={staffLivePeople}/>
    </section>}
    {current.role==='responsible_lead'&&activeResponsibleAssignments.length>0&&<section className="space-y-3 rounded-2xl border bg-card p-4">
      <div><h2 className="text-lg font-bold">Mijn operationele werkplek</h2><p className="text-sm text-muted-foreground">Directe toegang tot de functies die je als verantwoordelijke tijdens het evenement gebruikt.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/operations" className="rounded-xl border p-4"><Clock3 className="mb-3 h-5 w-5 text-violet-400"/><p className="font-bold">Mijn werkuren</p><p className="text-xs text-muted-foreground">Werk, pauze en operationele opvolging.</p></Link>
        <Link href="/briefings" className="rounded-xl border p-4"><ClipboardCheck className="mb-3 h-5 w-5 text-violet-400"/><p className="font-bold">Briefing & checklists</p><p className="text-xs text-muted-foreground">Instructies en opening- of sluitchecklists.</p></Link>
        <Link href="/inventory" className="rounded-xl border p-4"><PackageCheck className="mb-3 h-5 w-5 text-violet-400"/><p className="font-bold">Inventaris</p><p className="text-xs text-muted-foreground">Controleer materiaal en meld ontbrekend of defect materiaal.</p></Link>
        <Link href="/tasks" className="rounded-xl border p-4"><ListTodo className="mb-3 h-5 w-5 text-violet-400"/><p className="font-bold">Taken</p><p className="text-xs text-muted-foreground">Volg taken van je eigen werkplek op.</p></Link>
      </div>
    </section>}
    {current.role==='responsible_lead'&&<section className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Personeel van mijn werkplek</h2>
          <p className="text-sm text-muted-foreground">Live status en lopende werk- of pauzetimer.</p>
        </div>
        <span className="text-sm text-muted-foreground">{responsibleLivePeople.length} actief</span>
      </div>
      <ResponsibleLivePersonnel people={responsibleLivePeople}/>
    </section>}
    <section>
      <h2 className="mb-3 text-lg font-bold">Komende evenementen</h2>
      <div className="grid gap-3">
        {events.length ? events.slice(0, 3).map(event => <Link href="/events" key={event.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"><div><div className="font-bold">{event.name}</div><div className="flex gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4"/>{event.venue || 'Locatie nog niet ingesteld'}</div></div><ArrowRight className="h-5 w-5"/></Link>) : <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">Geen evenementen beschikbaar.</div>}
      </div>
    </section>
  </main>
}
