import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/crew-server'
import { TimeCorrectionForm } from '@/components/crew/time-correction-form'
import { getCurrentUser } from '@/lib/actions/auth'

export const dynamic = 'force-dynamic'

function durationLabel(seconds:number){
  const sign=seconds<0?'-':'+'
  const absolute=Math.abs(seconds)
  const hours=Math.floor(absolute/3600)
  const minutes=Math.floor((absolute%3600)/60)
  return `${sign}${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`
}

export default async function Page() {
  const s = await createClient()
  const current = await getCurrentUser()
  if (!current) redirect('/login')
  if (!current.isAdmin) redirect('/')
  const { data: sessions, error: sessionsError } = await s
    .from('work_sessions')
    .select('id,user_id,event_id,shift_id,started_at,ended_at')
    .order('started_at', { ascending: false })
    .limit(100)

  if (sessionsError) return <main className="p-8">Tijdregistraties konden niet worden geladen.</main>

  const sessionIds = (sessions || []).map(session => session.id)
  const shiftIds = [...new Set((sessions || []).map(session=>session.shift_id).filter((id):id is string=>Boolean(id)))]
  const breaksPromise = sessionIds.length
    ? s.from('break_sessions').select('id,work_session_id,user_id,started_at,ended_at').in('work_session_id', sessionIds).order('started_at', { ascending: false })
    : Promise.resolve({ data: [], error: null })
  const shiftsPromise = shiftIds.length
    ? s.from('shifts').select('id,scheduled_start,scheduled_end').in('id',shiftIds)
    : Promise.resolve({data:[],error:null})

  const [
    { data: breaks, error: breaksError },
    { data: shifts, error: shiftsError },
    { data: people, error: peopleError },
    { data: events, error: eventsError },
    { data: corrections, error: correctionsError },
  ] = await Promise.all([
    breaksPromise,
    shiftsPromise,
    s.from('profiles').select('id,full_name'),
    s.from('events').select('id,name'),
    s.from('time_corrections').select('id,user_id,field_name,original_value,corrected_value,reason,corrected_at').order('corrected_at', { ascending: false }).limit(100),
  ])

  if (breaksError || shiftsError || peopleError || eventsError || correctionsError) return <main className="p-8">Tijdregistraties konden niet volledig worden geladen.</main>

  const name = (id: string) => people?.find(person => person.id === id)?.full_name || 'Personeelslid'
  const fieldName = (value: string) => value === 'started_at' ? 'Starttijd' : value === 'ended_at' ? 'Eindtijd' : value
  const eventName = (id: string) => events?.find(event => event.id === id)?.name || 'Evenement'

  return <main className="mx-auto max-w-6xl space-y-6 p-4 pb-28 md:p-8">
    <div>
      <h1 className="text-3xl font-black">Tijdcorrecties</h1>
      <p className="text-muted-foreground">Alle correcties vereisen een reden en blijven bewaard in de auditgeschiedenis.</p>
    </div>
    <section className="rounded-xl border border-violet-500/40 bg-violet-500/5 p-4 text-sm">
      <p className="font-bold">Overuren t.o.v. planning</p>
      <p className="text-muted-foreground">Dit is een operationele vergelijking van netto gewerkte tijd met de geplande shiftduur. Het is geen loonberekening of wettelijke kwalificatie van overuren.</p>
    </section>
    <section className="space-y-4">
      {(sessions || []).map(session => {
        const ownBreaks=(breaks||[]).filter(pause=>pause.work_session_id===session.id)
        const shift=shifts?.find(row=>row.id===session.shift_id)
        const end=session.ended_at?Date.parse(session.ended_at):Date.now()
        const gross=Math.max(0,Math.floor((end-Date.parse(session.started_at))/1000))
        const pauseSeconds=ownBreaks.reduce((total,pause)=>total+Math.max(0,Math.floor(((pause.ended_at?Date.parse(pause.ended_at):Date.now())-Date.parse(pause.started_at))/1000)),0)
        const net=Math.max(0,gross-pauseSeconds)
        const scheduled=shift?Math.max(0,Math.floor((Date.parse(shift.scheduled_end)-Date.parse(shift.scheduled_start))/1000)):null
        const delta=scheduled===null?null:net-scheduled
        return <article key={session.id} className="rounded-2xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-bold">{name(session.user_id)} · {eventName(session.event_id)}</h2>
            {delta!==null&&<span className={`rounded-full px-3 py-1 text-xs font-black ${delta>0?'bg-amber-500/20 text-amber-300':'bg-muted text-muted-foreground'}`}>{delta>0?'OVER PLANNING ':'Planningverschil '}{durationLabel(delta)}</span>}
          </div>
          {scheduled!==null&&<p className="mt-1 text-xs text-muted-foreground">Netto gewerkt {durationLabel(net).slice(1)} · gepland {durationLabel(scheduled).slice(1)}</p>}
          <TimeCorrectionForm targetType="work_session" targetId={session.id} startedAt={session.started_at} endedAt={session.ended_at}/>
          {ownBreaks.map(pause => <div key={pause.id} className="ml-4 mt-3"><p className="text-sm font-semibold">Pauze</p><TimeCorrectionForm targetType="break_session" targetId={pause.id} startedAt={pause.started_at} endedAt={pause.ended_at}/></div>)}
        </article>
      })}
      {!sessions?.length && <p className="rounded-xl border p-4 text-muted-foreground">Nog geen tijdregistraties.</p>}
    </section>
    <section className="space-y-2">
      <h2 className="text-xl font-bold">Recente correctiegeschiedenis</h2>
      {(corrections || []).map(correction => <article key={correction.id} className="rounded-xl border p-3 text-sm"><p className="font-semibold">{name(correction.user_id)} · {fieldName(correction.field_name)}</p><p>{new Date(correction.original_value).toLocaleString('nl-BE')} → {new Date(correction.corrected_value).toLocaleString('nl-BE')}</p><p className="text-muted-foreground">{correction.reason} · {new Date(correction.corrected_at).toLocaleString('nl-BE')}</p></article>)}
    </section>
  </main>
}
