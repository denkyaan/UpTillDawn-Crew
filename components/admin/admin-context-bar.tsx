"use client"

import { useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"
import { useAdminSelection } from "@/lib/admin-selection-context"
import { createClient } from "@/lib/supabase/crew-client"
import { ContextLink } from "@/components/admin/context-link"
import { featureHelp } from "@/lib/ui-field-help"

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

  return <div className="border-b bg-card/70 px-3 py-2 text-xs backdrop-blur">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
      <span className="font-black uppercase tracking-wider text-violet-400">Context</span>
      {selection.eventId&&<span className="rounded-full border px-2 py-1">Event: {names.event||"geselecteerd"}</span>}
      {selection.workplaceId&&<span className="rounded-full border px-2 py-1">Werkplek: {names.workplace||"geselecteerd"}</span>}
      {selection.userId&&<span className="rounded-full border px-2 py-1">Persoon: {names.user||"geselecteerd"}</span>}
      <div className="ml-auto flex flex-wrap gap-1">
        <ContextLink href="/events" title={featureHelp("events","Event").description} className="rounded-lg px-2 py-1 hover:bg-muted">Event</ContextLink>
        <ContextLink href="/workplaces" title={featureHelp("workplaces","Planning").description} className="rounded-lg px-2 py-1 hover:bg-muted">Planning</ContextLink>
        <ContextLink href="/operations" title={featureHelp("operations","Werkuren").description} className="rounded-lg px-2 py-1 hover:bg-muted">Werkuren</ContextLink>
        <ContextLink href="/tasks" title={featureHelp("tasks","Taken").description} className="rounded-lg px-2 py-1 hover:bg-muted">Taken</ContextLink>
        <ContextLink href="/sales" title={featureHelp("sales","Sales").description} className="rounded-lg px-2 py-1 hover:bg-muted">Sales</ContextLink>
        {selection.eventId&&<ContextLink href="/briefings" title={featureHelp("briefings","Briefing").description} className="rounded-lg px-2 py-1 hover:bg-muted">Briefing</ContextLink>}
        {selection.workplaceId&&<ContextLink href="/inventory" title={featureHelp("inventory","Inventaris").description} className="rounded-lg px-2 py-1 hover:bg-muted">Inventaris</ContextLink>}
        {selection.workplaceId&&<ContextLink href="/guestlist" title={featureHelp("guestlist","Inkom & Guestlist").description} className="rounded-lg px-2 py-1 hover:bg-muted">Inkom & Guestlist</ContextLink>}
        <button type="button" onClick={clearSelection} className="rounded-lg p-1.5 hover:bg-muted" aria-label="Context wissen" title="Wis de actieve event- en werkplekcontext"><X className="h-4 w-4"/></button>
      </div>
    </div>
  </div>
}
