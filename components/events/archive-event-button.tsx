"use client"

import { useActionState, useRef } from "react"
import { archiveEventWithState, type EventLifecycleActionState } from "@/lib/actions/events"

const INITIAL:EventLifecycleActionState={error:null}

export function ArchiveEventButton({eventId,eventName,eventStatus}:{eventId:string;eventName:string;eventStatus:string}){
  const dialog=useRef<HTMLDialogElement>(null)
  const [state,formAction,pending]=useActionState(archiveEventWithState,INITIAL)
  const forced=eventStatus!=="closed"
  return <>
    <button type="button" onClick={()=>dialog.current?.showModal()} className="rounded-lg border border-red-500/50 px-3 py-2 font-bold text-red-300">Archiveren</button>
    <dialog ref={dialog} className="w-[min(92vw,34rem)] rounded-2xl border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/70">
      <form action={formAction} className="space-y-4 p-5">
        <input type="hidden" name="event_id" value={eventId}/>
        {forced&&<input type="hidden" name="force" value="on"/>}
        <div className="space-y-2">
          <h2 className="text-xl font-black">Evenement archiveren?</h2>
          <p className="text-sm text-muted-foreground">Historische gegevens blijven bewaard en het evenement verdwijnt uit actieve overzichten.</p>
          <p className="rounded-xl border p-3 font-semibold">{eventName}</p>
        </div>
        {forced&&<div className="space-y-2 rounded-xl border border-amber-500/40 p-3">
          <p className="text-sm font-bold text-amber-500">Dit evenement is nog niet afgesloten.</p>
          <p className="text-xs text-muted-foreground">Geforceerd archiveren vereist een reden. Actieve werkuren moeten eerst gestopt zijn.</p>
          <textarea name="reason" required minLength={5} maxLength={1000} placeholder="Reden voor geforceerd archiveren" className="min-h-24 w-full rounded-xl border bg-background p-3"/>
        </div>}
        {state.error&&<p role="alert" className="rounded-xl border border-red-500/40 p-3 text-sm text-red-400">{state.error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={pending} onClick={()=>dialog.current?.close()} className="rounded-xl border px-4 py-3 font-bold">Annuleren</button>
          <button disabled={pending} className="rounded-xl bg-red-700 px-4 py-3 font-black text-white disabled:opacity-50">{pending?'ARCHIVEREN…':'ARCHIVEREN'}</button>
        </div>
      </form>
    </dialog>
  </>
}
