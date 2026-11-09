"use client"

import { useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"
import { useAdminSelection } from "@/lib/admin-selection-context"
import { createClient } from "@/lib/supabase/crew-client"

export function AdminContextBar(){
  const {selection,clearSelection}=useAdminSelection()
  const s=useMemo(()=>createClient(),[])
  const [names,setNames]=useState<{event?:string;workplace?:string;user?:string}>({})

  useEffect(()=>{
    let active=true
    const load=async()=>{
      const next:{event?:string;workplace?:string;user?:string}={}
      const requests:Promise<void>[]=[]
      if(selection.eventId)requests.push((async()=>{const {data}=await s.from("events").select("name").eq("id",selection.eventId!).maybeSingle();if(data?.name)next.event=data.name})())
      if(selection.workplaceId)requests.push((async()=>{const {data}=await s.from("workplaces").select("name").eq("id",selection.workplaceId!).maybeSingle();if(data?.name)next.workplace=data.name})())
      if(selection.userId)requests.push((async()=>{const {data}=await s.from("profiles").select("full_name").eq("id",selection.userId!).maybeSingle();if(data?.full_name)next.user=data.full_name})())
      await Promise.all(requests)
      if(active)setNames(next)
    }
    void load()
    return()=>{active=false}
  },[s,selection.eventId,selection.workplaceId,selection.userId])

  if(!selection.eventId&&!selection.workplaceId&&!selection.userId&&!selection.shiftId)return null

  return <div className="border-b bg-card/70 px-3 py-1.5 text-xs backdrop-blur">
    <div className="mx-auto flex max-w-7xl min-w-0 items-center gap-2">
      <span className="shrink-0 font-bold uppercase tracking-wider text-violet-400">Context</span>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap">
        {selection.eventId&&<span className="shrink-0 rounded-full border px-2 py-1">Event: {names.event||"geselecteerd"}</span>}
        {selection.workplaceId&&<span className="shrink-0 rounded-full border px-2 py-1">Werkplek: {names.workplace||"geselecteerd"}</span>}
        {selection.userId&&<span className="shrink-0 rounded-full border px-2 py-1">Persoon: {names.user||"geselecteerd"}</span>}
        {selection.shiftId&&!selection.eventId&&!selection.workplaceId&&<span className="shrink-0 rounded-full border px-2 py-1">Shift geselecteerd</span>}
      </div>
      <button type="button" onClick={clearSelection} className="shrink-0 rounded-lg p-1.5 hover:bg-muted" aria-label="Context wissen" title="Wis de geselecteerde context"><X className="h-4 w-4"/></button>
    </div>
  </div>
}
