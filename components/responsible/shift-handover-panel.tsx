"use client"

import Link from "next/link"
import { acceptShiftHandover, saveShiftHandover } from "@/lib/actions/uptilldawn"
import { handoverCanBeAccepted, type HandoverStatus } from "@/lib/shift-handover"

export type HandoverScope={
  eventId:string
  eventName:string
  workplaceId:string
  workplaceName:string
}

export type HandoverCandidate={
  eventId:string
  workplaceId:string
  userId:string
  fullName:string
}

export type HandoverView={
  id:string
  eventId:string
  workplaceId:string
  outgoingResponsibleId:string
  outgoingName:string
  incomingResponsibleId:string|null
  incomingName:string|null
  status:HandoverStatus
  openTaskIds:string[]
  openIncidentIds:string[]
  equipmentNotes:string|null
  notes:string|null
  createdAt:string
  updatedAt:string
  readyAt:string|null
  acceptedAt:string|null
}

function canAccept(row:HandoverView){
  return handoverCanBeAccepted({
    id:row.id,
    eventId:row.eventId,
    workplaceId:row.workplaceId,
    outgoingResponsibleId:row.outgoingResponsibleId,
    incomingResponsibleId:row.incomingResponsibleId,
    status:row.status,
    openTaskIds:row.openTaskIds,
    openIncidentIds:row.openIncidentIds,
    equipmentNotes:row.equipmentNotes,
    notes:row.notes,
    createdAt:Date.parse(row.createdAt),
    acceptedAt:row.acceptedAt?Date.parse(row.acceptedAt):null,
  })
}

export function ShiftHandoverPanel({
  userId,
  scopes,
  candidates,
  handovers,
}:{
  userId:string
  scopes:HandoverScope[]
  candidates:HandoverCandidate[]
  handovers:HandoverView[]
}){
  const incomingReady=handovers.filter(row=>row.incomingResponsibleId===userId&&row.status==="ready")
  const accepted=handovers.filter(row=>row.status==="accepted").slice(0,3)

  return <section className="space-y-4 rounded-2xl border p-4">
    <div>
      <h2 className="text-xl font-bold">Shift overdracht</h2>
      <p className="text-sm text-muted-foreground">Leg open werk en aandachtspunten vast voor de volgende verantwoordelijke.</p>
    </div>

    {incomingReady.length>0&&<div className="space-y-3">
      <h3 className="text-sm font-black uppercase tracking-wide text-violet-300">Te accepteren</h3>
      {incomingReady.map(row=>{
        const scope=scopes.find(item=>item.eventId===row.eventId&&item.workplaceId===row.workplaceId)
        return <article key={row.id} className="space-y-3 rounded-xl border border-violet-500/40 bg-violet-500/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-bold">{scope?.eventName||"Evenement"} · {scope?.workplaceName||"Werkplek"}</p>
              <p className="text-sm text-muted-foreground">Van {row.outgoingName||"Verantwoordelijke"} · {row.openTaskIds.length} open taken · {row.openIncidentIds.length} open incidenten</p>
            </div>
            <span className="rounded-full border px-3 py-1 text-xs font-bold">KLAAR</span>
          </div>
          {row.equipmentNotes&&<div><p className="text-xs font-bold uppercase text-muted-foreground">Materiaal</p><p className="whitespace-pre-wrap text-sm">{row.equipmentNotes}</p></div>}
          {row.notes&&<div><p className="text-xs font-bold uppercase text-muted-foreground">Notities</p><p className="whitespace-pre-wrap text-sm">{row.notes}</p></div>}
          <div className="flex flex-wrap gap-2 text-sm">
            {row.openTaskIds.length>0&&<Link href="/tasks" className="rounded-lg border px-3 py-2">OPEN TAKEN BEKIJKEN</Link>}
            {row.openIncidentIds.length>0&&<Link href="/incidents" className="rounded-lg border px-3 py-2">OPEN INCIDENTEN BEKIJKEN</Link>}
          </div>
          {canAccept(row)&&<form action={acceptShiftHandover}>
            <input type="hidden" name="handover_id" value={row.id}/>
            <button className="w-full rounded-lg bg-violet-600 p-3 font-bold text-white">OVERDRACHT ACCEPTEREN</button>
          </form>}
        </article>
      })}
    </div>}

    {scopes.map(scope=>{
      const current=handovers.find(row=>
        row.eventId===scope.eventId
        &&row.workplaceId===scope.workplaceId
        &&row.outgoingResponsibleId===userId
        &&row.status!=="accepted"
      )
      const options=candidates.filter(item=>item.eventId===scope.eventId&&item.workplaceId===scope.workplaceId)
      return <details key={scope.eventId+":"+scope.workplaceId} className="rounded-xl border p-3" open={Boolean(current)}>
        <summary className="cursor-pointer font-semibold">{scope.eventName} · {scope.workplaceName}{current?" · "+(current.status==="ready"?"klaar":"concept"):""}</summary>
        <form action={saveShiftHandover} className="mt-3 grid gap-3">
          <input type="hidden" name="event_id" value={scope.eventId}/>
          <input type="hidden" name="workplace_id" value={scope.workplaceId}/>
          <label className="grid gap-1 text-sm">
            Inkomende verantwoordelijke
            <select name="incoming_user_id" defaultValue={current?.incomingResponsibleId||""} className="rounded-lg border bg-background p-3">
              <option value="">Nog niet gekozen</option>
              {options.map(option=><option key={option.userId} value={option.userId}>{option.fullName}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Materiaal / apparatuur
            <textarea name="equipment_notes" maxLength={2000} defaultValue={current?.equipmentNotes||""} placeholder="Status, tekorten, defecten, sleutels…" className="min-h-20 rounded-lg border bg-background p-3"/>
          </label>
          <label className="grid gap-1 text-sm">
            Overige overdrachtsnotities
            <textarea name="notes" maxLength={4000} defaultValue={current?.notes||""} placeholder="Belangrijke context voor de volgende verantwoordelijke…" className="min-h-24 rounded-lg border bg-background p-3"/>
          </label>
          {current?.status==="ready"&&<p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">Snapshot: {current.openTaskIds.length} open taken · {current.openIncidentIds.length} open incidenten. Opnieuw klaarzetten vernieuwt de snapshot.</p>}
          {!options.length&&<p className="text-sm text-muted-foreground">Er is momenteel geen andere verantwoordelijke aan deze werkplek gekoppeld. Een concept kan wel worden opgeslagen.</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            <button name="mark_ready" value="false" className="rounded-lg border p-3 font-bold">CONCEPT OPSLAAN</button>
            <button name="mark_ready" value="true" disabled={!options.length} className="rounded-lg bg-violet-600 p-3 font-bold text-white disabled:opacity-50">KLAAR VOOR OVERDRACHT</button>
          </div>
        </form>
      </details>
    })}

    {accepted.length>0&&<details className="rounded-xl border p-3">
      <summary className="cursor-pointer font-semibold">Recent geaccepteerd</summary>
      <div className="mt-3 space-y-2">
        {accepted.map(row=><div key={row.id} className="rounded-lg border p-3 text-sm">
          <p className="font-semibold">{row.outgoingName||"Verantwoordelijke"} → {row.incomingName||"Verantwoordelijke"}</p>
          <p className="text-muted-foreground">{row.openTaskIds.length} taken · {row.openIncidentIds.length} incidenten · geaccepteerd {row.acceptedAt?new Date(row.acceptedAt).toLocaleString("nl-BE"):""}</p>
        </div>)}
      </div>
    </details>}
  </section>
}
