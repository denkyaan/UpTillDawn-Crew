import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/crew-server'
import { completeEventOnboardingStep } from '@/lib/actions/onboarding'

export const dynamic='force-dynamic'

const STEPS=[
  ['briefing','Briefing bevestigd'],
  ['safety','Veiligheidsregels gelezen'],
  ['map','Eventkaart bekeken'],
  ['workplace','Werkplek bekeken'],
  ['responsible','Verantwoordelijke gekend'],
  ['inventory','Materiaal en inventaris bekeken'],
] as const

export default async function OnboardingPage({searchParams}:{searchParams:Promise<{event?:string}>}){
  const current=await getCurrentUser()
  if(!current)redirect('/login')
  const s=await createClient()
  const params=await searchParams
  const [{data:members},{data:shifts}]=await Promise.all([
    s.from('event_members').select('event_id').eq('user_id',current.id),
    s.from('shifts').select('event_id').eq('user_id',current.id).neq('status','cancelled').neq('response_status','declined'),
  ])
  const eventIds=[...new Set([...(members||[]).map(x=>x.event_id),...(shifts||[]).map(x=>x.event_id)])]
  if(!eventIds.length)return <main className="mx-auto max-w-3xl p-4 md:p-8"><h1 className="text-3xl font-black">Event-onboarding</h1><p className="mt-4 rounded-xl border p-4 text-muted-foreground">Geen toegewezen evenement voor onboarding.</p></main>
  const {data:events,error}=await s.from('events').select('id,name,start_at,end_at,status,onboarding_required').in('id',eventIds).neq('status','archived').order('start_at')
  if(error)throw new Error('Onboarding kon niet worden geladen.')
  const selected=(events||[]).find(e=>e.id===params.event)||(events||[])[0]
  if(!selected)return <main className="mx-auto max-w-3xl p-4 md:p-8"><h1 className="text-3xl font-black">Event-onboarding</h1><p className="mt-4 rounded-xl border p-4 text-muted-foreground">Geen actieve onboarding beschikbaar.</p></main>
  const {data:status}=await s.rpc('upt_event_onboarding_status',{p_event:selected.id})
  const state=(status&&typeof status==='object'&&!Array.isArray(status)?status:{}) as {completed?:unknown;ready?:unknown;required?:unknown}
  const completed=new Set(Array.isArray(state.completed)?state.completed.filter((x):x is string=>typeof x==='string'):[])
  const ready=state.ready===true

  return <main className="mx-auto max-w-3xl space-y-5 p-4 pb-28 md:p-8">
    <div><p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">EVENT READY</p><h1 className="text-3xl font-black">Event-onboarding</h1><p className="text-sm text-muted-foreground">Doorloop de verplichte voorbereiding vóór je operationele shift.</p></div>
    <nav className="flex flex-wrap gap-2">{(events||[]).map(e=><Link key={e.id} href={'/onboarding?event='+e.id} className={'rounded-xl border px-3 py-2 text-sm font-bold '+(e.id===selected.id?'bg-violet-600 text-white':'')}>{e.name}</Link>)}</nav>
    <section className="rounded-2xl border p-4"><h2 className="text-xl font-black">{selected.name}</h2><p className="text-sm text-muted-foreground">{new Date(selected.start_at).toLocaleString('nl-BE')}</p></section>
    {!selected.onboarding_required&&<p className="rounded-xl border border-emerald-500/40 p-4">Onboarding is voor dit evenement niet verplicht.</p>}
    <section className="space-y-2">{STEPS.map(([key,label])=>{
      const done=completed.has(key)
      return <div key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><b>{label}</b><p className="text-xs text-muted-foreground">{done?'Afgerond':'Nog te bevestigen'}</p></div>{done?<span className="rounded-full border border-emerald-500/50 px-3 py-1 text-xs font-black text-emerald-600">GEREED</span>:<form action={completeEventOnboardingStep}><input type="hidden" name="event_id" value={selected.id}/><input type="hidden" name="step" value={key}/><button className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white">BEVESTIG</button></form>}</div>
    })}</section>
    <section className="rounded-2xl border p-4">{ready?<div><h2 className="text-xl font-black text-emerald-600">Klaar voor het evenement</h2><p className="text-sm text-muted-foreground">Alle onboardingstappen zijn bevestigd.</p></div>:<form action={completeEventOnboardingStep} className="space-y-2"><input type="hidden" name="event_id" value={selected.id}/><input type="hidden" name="step" value="confirmed"/><p className="text-sm text-muted-foreground">Na alle stappen bevestig je de volledige onboarding.</p><button className="w-full rounded-xl bg-emerald-700 p-3 font-black text-white">ONBOARDING AFRONDEN</button></form>}</section>
  </main>
}
