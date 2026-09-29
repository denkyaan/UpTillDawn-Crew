import { ContextLink } from '@/components/admin/context-link'
import type { AdminSelection } from '@/lib/admin-selection-context'

export type ActionPriority='critical'|'high'|'normal'|'info'

export type ActionQueueItem={
  key:string
  title:string
  detail:string
  href:string
  context?:Partial<AdminSelection>
  priority:ActionPriority
  createdAt?:string|null
}

const rank:Record<ActionPriority,number>={critical:0,high:1,normal:2,info:3}
const label:Record<ActionPriority,string>={critical:'KRITIEK',high:'HOOG',normal:'NORMAAL',info:'INFO'}
const classes:Record<ActionPriority,string>={
  critical:'border-red-500/60 bg-red-500/5',
  high:'border-amber-500/50 bg-amber-500/5',
  normal:'border-violet-500/30',
  info:'border-border',
}
const badge:Record<ActionPriority,string>={
  critical:'border-red-500/50 text-red-500',
  high:'border-amber-500/50 text-amber-500',
  normal:'border-violet-500/50 text-violet-500',
  info:'text-muted-foreground',
}

export function sortActionQueue(items:ActionQueueItem[]){
  return [...items].sort((a,b)=>{
    const priority=rank[a.priority]-rank[b.priority]
    if(priority)return priority
    const aTime=a.createdAt?Date.parse(a.createdAt):Number.MAX_SAFE_INTEGER
    const bTime=b.createdAt?Date.parse(b.createdAt):Number.MAX_SAFE_INTEGER
    return aTime-bTime
  })
}

export function AdminActionCenter({items}:{items:ActionQueueItem[]}){
  const sorted=sortActionQueue(items)
  const counts={
    critical:sorted.filter(item=>item.priority==='critical').length,
    high:sorted.filter(item=>item.priority==='high').length,
    normal:sorted.filter(item=>item.priority==='normal').length,
    info:sorted.filter(item=>item.priority==='info').length,
  }
  const urgent=counts.critical+counts.high

  return <section className="space-y-3 rounded-2xl border p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold">Actiecentrum</h2>
        <p className="text-xs text-muted-foreground">Automatisch verzamelde acties, gesorteerd op urgentie. Eén klik opent meteen de juiste context.</p>
      </div>
      <div className="flex items-center gap-2 text-xs font-black">
        {counts.critical>0&&<span className="rounded-full border border-red-500/50 px-2 py-1 text-red-500">{counts.critical} KRITIEK</span>}
        {counts.high>0&&<span className="rounded-full border border-amber-500/50 px-2 py-1 text-amber-500">{counts.high} HOOG</span>}
        <span className="rounded-full border px-2 py-1">{urgent} URGENT</span>
        <span className="rounded-full border px-2 py-1">{sorted.length} OPEN</span>
      </div>
    </div>

    {!sorted.length&&<p className="rounded-xl border border-dashed p-4 text-muted-foreground">Geen directe acties vereist.</p>}

    <div className="grid gap-2">
      {sorted.slice(0,12).map((item,index)=><ContextLink
        key={item.key}
        href={item.href}
        context={item.context}
        className={'block rounded-xl border p-3 transition hover:-translate-y-0.5 hover:shadow-sm '+classes[item.priority]}
      >
        {index===0&&urgent>0&&<p className="mb-2 text-[10px] font-black uppercase tracking-[.16em] text-red-500">Eerst behandelen</p>}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{item.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{item.detail}</p>
          </div>
          <span className={'shrink-0 rounded-full border px-2 py-1 text-[10px] font-black '+badge[item.priority]}>{label[item.priority]}</span>
        </div>
      </ContextLink>)}
    </div>

    {sorted.length>12&&<p className="text-xs text-muted-foreground">{sorted.length-12} extra actie(s) zijn beschikbaar via de gekoppelde modules.</p>}
    {sorted.length>0&&<p className="text-xs text-muted-foreground">Volgorde: kritiek → hoog → normaal → info; binnen dezelfde prioriteit staat de oudste actie eerst.</p>}
  </section>
}
