import Link from 'next/link'
import {redirect} from 'next/navigation'
import {getCurrentUser} from '@/lib/actions/auth'
import {createClient} from '@/lib/supabase/crew-server'
import {archiveEvent,closeEvent} from '@/lib/actions/events'
import {PlatformAiAssistant} from '@/components/admin/platform-ai-assistant'

export const dynamic='force-dynamic'

type Snapshot={
 event:{id:string;name:string;status:string;startAt:string;endAt:string;registrationDeadline:string|null;maxJoiners:number|null}
 staffing:{workplaces:number;responsibles:number;targetStaff:number;scheduledCrew:number;confirmedMembers:number;waitlist:number}
 briefing:{required:number;acknowledged:number}
 checklists:{openingTotal:number;openingCompleted:number;closingTotal:number;closingCompleted:number}
 inventory:{items:number;lowStock:number;missing:number;damaged:number;assets:number;consumables:number}
 operations:{openIncidents:number;activeSessions:number;guestlistEntries:number;guestSpots:number;guestCheckedIn:number}
 sales:{netCents:number;merchCents:number;tokenCents:number}
 readiness:{responsiblesReady:boolean;staffingReady:boolean;briefingReady:boolean;openingReady:boolean;inventoryReady:boolean;noOpenIncidents:boolean}
}

const money=(cents:number)=>new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(Number(cents||0)/100)

function Requirement({label,ok,detail,href}:{label:string;ok:boolean;detail:string;href:string}){
 return <Link href={href} className="flex items-center justify-between gap-3 rounded-xl border p-3">
  <div><p className="font-bold">{label}</p><p className="text-xs text-muted-foreground">{detail}</p></div>
  <span className={`rounded-full border px-3 py-1 text-xs font-black ${ok?'border-emerald-500/50 text-emerald-500':'border-amber-500/50 text-amber-500'}`}>{ok?'KLAAR':'ACTIE NODIG'}</span>
 </Link>
}

export default async function EventCommandPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params
 const current=await getCurrentUser()
 if(!current)redirect('/login')
 const s=await createClient()
 const {data,error}=await s.rpc('upt_event_command_snapshot',{p_event:id})
 if(error||!data)redirect('/events')
 const snapshot=data as unknown as Snapshot
 const r=snapshot.readiness
 const readiness=[r.responsiblesReady,r.staffingReady,r.briefingReady,r.openingReady,r.inventoryReady,r.noOpenIncidents]
 const readyCount=readiness.filter(Boolean).length
 const percent=Math.round(readyCount/readiness.length*100)
 const isAdmin=current.isAdmin===true
 const ended=Date.now()>Date.parse(snapshot.event.endAt)

 return <main className="mx-auto max-w-7xl space-y-6 p-4 pb-28 md:p-8">
  <header className="flex flex-wrap items-end justify-between gap-3">
   <div>
    <p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">EVENT COMMAND CENTER</p>
    <h1 className="text-3xl font-black">{snapshot.event.name}</h1>
    <p className="text-sm text-muted-foreground">{new Date(snapshot.event.startAt).toLocaleString('nl-BE')} → {new Date(snapshot.event.endAt).toLocaleString('nl-BE')}</p>
   </div>
   <div className="flex flex-wrap gap-2">
    <Link href="/events" className="rounded-xl border px-4 py-3 font-bold">TERUG NAAR EVENTS</Link>
    <Link href={'/briefings?event='+id} className="rounded-xl border px-4 py-3 font-bold">BRIEFING</Link>
    <Link href={'/inventory?event='+id} className="rounded-xl border px-4 py-3 font-bold">INVENTORY</Link>
    <Link href={'/guestlist?event='+id} className="rounded-xl border px-4 py-3 font-bold">GUESTLIST</Link>
    <Link href={'/sales?event='+id} className="rounded-xl border px-4 py-3 font-bold">SALES</Link>
   </div>
  </header>

  <section className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
   <article className="rounded-2xl border p-5">
    <div className="flex items-end justify-between gap-3">
     <div><h2 className="text-xl font-black">Event readiness</h2><p className="text-sm text-muted-foreground">Concrete vereisten, geen subjectieve score.</p></div>
     <p className="text-4xl font-black">{readyCount}/{readiness.length}</p>
    </div>
    <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full bg-violet-600" style={{width:percent+'%'}}/></div>
    <p className="mt-2 text-xs text-muted-foreground">{percent}% van de operationele vereisten klaar.</p>
   </article>
   <article className="rounded-2xl border p-5">
    <h2 className="text-xl font-black">Bezetting</h2>
    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
     <div className="rounded-xl border p-3"><b>{snapshot.staffing.scheduledCrew}</b><p className="text-xs text-muted-foreground">ingepland</p></div>
     <div className="rounded-xl border p-3"><b>{snapshot.staffing.targetStaff}</b><p className="text-xs text-muted-foreground">doel</p></div>
     <div className="rounded-xl border p-3"><b>{snapshot.staffing.confirmedMembers}</b><p className="text-xs text-muted-foreground">bevestigd</p></div>
     <div className="rounded-xl border p-3"><b>{snapshot.staffing.waitlist}</b><p className="text-xs text-muted-foreground">wachtlijst</p></div>
    </div>
   </article>
  </section>

  <section className="grid gap-3 lg:grid-cols-2">
   <Requirement label="Verantwoordelijken" ok={r.responsiblesReady} detail={snapshot.staffing.responsibles+' van '+snapshot.staffing.workplaces+' werkplekken hebben een verantwoordelijke'} href="/workplaces"/>
   <Requirement label="Bezetting" ok={r.staffingReady} detail={snapshot.staffing.scheduledCrew+' personeelsleden ingepland'} href="/shifts"/>
   <Requirement label="Briefing" ok={r.briefingReady} detail={snapshot.briefing.required+' verplichte briefing(s)'} href={'/briefings?event='+id}/>
   <Requirement label="Openingschecklists" ok={r.openingReady} detail={snapshot.checklists.openingCompleted+'/'+snapshot.checklists.openingTotal+' afgerond'} href={'/briefings?event='+id}/>
   <Requirement label="Inventory" ok={r.inventoryReady} detail={snapshot.inventory.lowStock+' lage voorraad · '+snapshot.inventory.missing+' ontbreekt · '+snapshot.inventory.damaged+' kapot'} href={'/inventory?event='+id}/>
   <Requirement label="Incidenten" ok={r.noOpenIncidents} detail={snapshot.operations.openIncidents+' open incident(en)'} href="/incidents"/>
  </section>

  <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
   <article className="rounded-2xl border p-4"><p className="text-xs font-black uppercase text-muted-foreground">Guestlist</p><p className="mt-2 text-2xl font-black">{snapshot.operations.guestCheckedIn}/{snapshot.operations.guestSpots}</p><p className="text-xs text-muted-foreground">{snapshot.operations.guestlistEntries} entries</p></article>
   <article className="rounded-2xl border p-4"><p className="text-xs font-black uppercase text-muted-foreground">Revenue</p><p className="mt-2 text-2xl font-black">{money(snapshot.sales.netCents)}</p><p className="text-xs text-muted-foreground">Merch {money(snapshot.sales.merchCents)} · Tokens {money(snapshot.sales.tokenCents)}</p></article>
   <article className="rounded-2xl border p-4"><p className="text-xs font-black uppercase text-muted-foreground">Inventory</p><p className="mt-2 text-2xl font-black">{snapshot.inventory.items}</p><p className="text-xs text-muted-foreground">{snapshot.inventory.assets} assets · {snapshot.inventory.consumables} verbruik</p></article>
   <article className="rounded-2xl border p-4"><p className="text-xs font-black uppercase text-muted-foreground">Actief</p><p className="mt-2 text-2xl font-black">{snapshot.operations.activeSessions}</p><p className="text-xs text-muted-foreground">lopende werksessies</p></article>
  </section>

  {isAdmin&&<PlatformAiAssistant eventId={id} contextLabel={snapshot.event.name}/>}

  {isAdmin&&ended&&<section className="space-y-3 rounded-2xl border border-amber-500/30 p-5">
   <div><h2 className="text-xl font-black">Post-event afsluiting</h2><p className="text-sm text-muted-foreground">Sluit pas af wanneer werkuren, sluitchecklists, incidenten en inventory-afwijkingen verwerkt zijn.</p></div>
   <form action={closeEvent} className="grid gap-2 md:grid-cols-[auto_1fr_auto]">
    <input type="hidden" name="event_id" value={id}/>
    <label className="flex items-center gap-2 rounded-xl border px-3"><input type="checkbox" name="force"/> Geforceerd afsluiten</label>
    <input name="reason" maxLength={1000} placeholder="Reden alleen nodig bij geforceerd afsluiten" className="rounded-xl border bg-background p-3"/>
    <button className="rounded-xl bg-violet-600 px-4 py-3 font-bold text-white">EVENT AFSLUITEN</button>
   </form>
   {snapshot.event.status==='closed'&&<form action={archiveEvent}>
    <input type="hidden" name="event_id" value={id}/>
    <button className="rounded-xl border px-4 py-3 font-bold">EVENT ARCHIVEREN</button>
   </form>}
  </section>}
 </main>
}
