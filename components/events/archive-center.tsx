"use client"

import Link from "next/link"
import { useActionState, useMemo, useRef, useState } from "react"
import { restoreEventWithState, type EventLifecycleActionState } from "@/lib/actions/events"

export type ArchivedEventSummary={
  id:string;name:string;venue:string|null;address:string|null;startAt:string;endAt:string;
  archivedAt:string|null;archivedByName:string|null;archiveReason:string|null;preArchiveStatus:string|null
}
const INITIAL:EventLifecycleActionState={error:null}

function RestoreButton({event}:{event:ArchivedEventSummary}){
  const dialog=useRef<HTMLDialogElement>(null)
  const [state,formAction,pending]=useActionState(restoreEventWithState,INITIAL)
  return <>
    <button type="button" onClick={()=>dialog.current?.showModal()} className="rounded-xl border px-3 py-2 text-sm font-bold">Herstellen</button>
    <dialog ref={dialog} className="w-[min(92vw,32rem)] rounded-2xl border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/70">
      <form action={formAction} className="space-y-4 p-5">
        <input type="hidden" name="event_id" value={event.id}/>
        <div className="space-y-2">
          <h2 className="text-xl font-black">Evenement herstellen?</h2>
          <p className="text-sm text-muted-foreground">Het evenement wordt teruggezet naar de status van vóór het archiveren en verschijnt opnieuw in de relevante actieve overzichten.</p>
          <p className="rounded-xl border p-3 font-semibold">{event.name}</p>
        </div>
        <textarea name="reason" maxLength={1000} placeholder="Notitie bij herstel (optioneel)" className="min-h-20 w-full rounded-xl border bg-background p-3"/>
        {state.error&&<p role="alert" className="rounded-xl border border-red-500/40 p-3 text-sm text-red-400">{state.error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={pending} onClick={()=>dialog.current?.close()} className="rounded-xl border px-4 py-3 font-bold">Annuleren</button>
          <button disabled={pending} className="rounded-xl bg-violet-600 px-4 py-3 font-black text-white disabled:opacity-50">{pending?'HERSTELLEN…':'HERSTELLEN'}</button>
        </div>
      </form>
    </dialog>
  </>
}

export function ArchiveCenter({events}:{events:ArchivedEventSummary[]}){
  const [query,setQuery]=useState("")
  const filtered=useMemo(()=>{
    const needle=query.trim().toLocaleLowerCase()
    if(!needle)return events
    return events.filter(event=>[event.name,event.venue||"",event.address||"",new Date(event.startAt).toLocaleDateString("nl-BE"),event.archivedAt?new Date(event.archivedAt).toLocaleDateString("nl-BE"):""].join(" ").toLocaleLowerCase().includes(needle))
  },[events,query])
  return <section className="space-y-4 rounded-2xl border p-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-[.2em] text-violet-400">ARCHIEF</p><h2 className="text-xl font-black">Evenementenarchief</h2><p className="text-sm text-muted-foreground">Historische evenementen blijven leesbaar en kunnen door een admin worden hersteld.</p></div>
      <span className="rounded-full border px-3 py-1 text-xs font-bold">{events.length} gearchiveerd</span>
    </div>
    <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Zoek op naam, locatie of datum…" className="w-full rounded-xl border bg-background p-3"/>
    {!filtered.length?<p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Geen gearchiveerde evenementen gevonden.</p>:<div className="grid gap-3">
      {filtered.map(event=><article key={event.id} className="rounded-xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black">{event.name}</h3><p className="text-sm text-muted-foreground">{new Date(event.startAt).toLocaleString('nl-BE')} → {new Date(event.endAt).toLocaleString('nl-BE')}</p>{(event.venue||event.address)&&<p className="text-sm text-muted-foreground">{event.venue||event.address}</p>}</div><span className="rounded-full border px-3 py-1 text-xs font-black">Gearchiveerd</span></div>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2"><p><b>Gearchiveerd op:</b> {event.archivedAt?new Date(event.archivedAt).toLocaleString('nl-BE'):'Onbekend'}</p><p><b>Door:</b> {event.archivedByName||'Onbekend'}</p><p><b>Vorige status:</b> {event.preArchiveStatus||'Onbekend'}</p>{event.archiveReason&&<p><b>Reden:</b> {event.archiveReason}</p>}</div>
        <div className="mt-4 flex flex-wrap gap-2"><Link href={'/events/'+event.id+'/command'} className="rounded-xl border px-3 py-2 text-sm font-bold">Historische gegevens bekijken</Link><RestoreButton event={event}/></div>
      </article>)}
    </div>}
  </section>
}
