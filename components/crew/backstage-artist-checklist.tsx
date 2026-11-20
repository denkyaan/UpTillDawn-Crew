'use client'

import { useEffect,useState,useTransition } from 'react'
import { createClient } from '@/lib/supabase/crew-client'
import { setArtistHospitality } from '@/lib/actions/guestlist'

export type ArtistChecklistRow={
  guestlist_entry_id:string
  event_id:string
  drinks:string|null
  hospitality_notes:string|null
  drinks_ready:boolean
  artist_received:boolean
  drinks_ready_at:string|null
  artist_received_at:string|null
}

export function BackstageArtistChecklist({
  eventId,
  artists,
  initialRows,
  canManageHospitality,
}:{
  eventId:string
  artists:Array<{id:string;name:string;spots_checked_in:number}>
  initialRows:ArtistChecklistRow[]
  canManageHospitality:boolean
}){
  const [rows,setRows]=useState(initialRows)
  const [message,setMessage]=useState('')
  const [pending,startTransition]=useTransition()

  useEffect(()=>{
    const s=createClient()
    const channel=s.channel('backstage-artists:'+eventId)
      .on('postgres_changes',{
        event:'*',
        schema:'public',
        table:'artist_backstage_checklists',
        filter:'event_id=eq.'+eventId,
      },payload=>{
        if(payload.eventType==='DELETE'){
          const old=payload.old as {guestlist_entry_id?:string}
          if(old.guestlist_entry_id)setRows(current=>current.filter(row=>row.guestlist_entry_id!==old.guestlist_entry_id))
          return
        }
        const next=payload.new as ArtistChecklistRow
        setRows(current=>{
          const index=current.findIndex(row=>row.guestlist_entry_id===next.guestlist_entry_id)
          if(index<0)return [...current,next]
          const copy=[...current]
          copy[index]=next
          return copy
        })
      })
      .subscribe()
    return()=>{void s.removeChannel(channel)}
  },[eventId])

  async function toggle(row:ArtistChecklistRow,kind:'drinks'|'received',value:boolean){
    if(pending)return
    setMessage('')
    startTransition(async()=>{
      const s=createClient()
      const {error}=await s.rpc('upt_backstage_artist_checklist_update',{
        p_entry:row.guestlist_entry_id,
        p_drinks_ready:kind==='drinks'?value:row.drinks_ready,
        p_artist_received:kind==='received'?value:row.artist_received,
      })
      if(error){
        setMessage(error.message)
        return
      }
      setRows(current=>current.map(item=>item.guestlist_entry_id===row.guestlist_entry_id?{
        ...item,
        drinks_ready:kind==='drinks'?value:item.drinks_ready,
        artist_received:kind==='received'?value:item.artist_received,
      }:item))
    })
  }

  const byId=new Map(rows.map(row=>[row.guestlist_entry_id,row]))
  const sorted=[...artists].sort((a,b)=>{
    const ar=byId.get(a.id)
    const br=byId.get(b.id)
    const aDone=Boolean(ar?.artist_received&&ar?.drinks_ready)
    const bDone=Boolean(br?.artist_received&&br?.drinks_ready)
    if(aDone!==bDone)return aDone?1:-1
    if((a.spots_checked_in>0)!==(b.spots_checked_in>0))return a.spots_checked_in>0?-1:1
    return a.name.localeCompare(b.name,'nl')
  })

  return <section className="space-y-3 rounded-2xl border p-4">
    <div>
      <h2 className="text-xl font-black">Artiestenchecklist backstage</h2>
      <p className="text-sm text-muted-foreground">Aankomst, drank en ontvangst per artiest. De lijst wordt live bijgewerkt vanuit Inkom.</p>
    </div>

    {message&&<p className="rounded-xl border border-red-500/40 p-3 text-sm text-red-500">{message}</p>}
    {!sorted.length&&<p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nog geen artiesten op de guestlist.</p>}

    <div className="space-y-2">{sorted.map(artist=>{
      const row=byId.get(artist.id)
      if(!row)return null
      const arrived=artist.spots_checked_in>0
      return <article key={artist.id} className="space-y-3 rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-black">{artist.name}</h3>
            <p className="text-sm text-muted-foreground">{arrived?'Aangekomen bij inkom':'Nog niet aangekomen'}</p>
          </div>
          <span className={'rounded-full border px-2 py-1 text-xs font-black '+(arrived?'border-emerald-500/50 text-emerald-600':'')}>{arrived?'AANWEZIG':'VERWACHT'}</span>
        </div>

        <div className="rounded-lg border p-3">
          <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Drank / hospitality</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{row.drinks||'Geen drankinfo ingegeven.'}</p>
          {row.hospitality_notes&&<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{row.hospitality_notes}</p>}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-lg border p-3 font-semibold">
            <input type="checkbox" checked={row.drinks_ready} disabled={pending} onChange={e=>void toggle(row,'drinks',e.target.checked)}/>
            Drank klaar
          </label>
          <label className="flex items-center gap-3 rounded-lg border p-3 font-semibold">
            <input type="checkbox" checked={row.artist_received} disabled={pending} onChange={e=>void toggle(row,'received',e.target.checked)}/>
            Artiest ontvangen
          </label>
        </div>

        {canManageHospitality&&<details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-sm font-semibold">Hospitality aanpassen</summary>
          <form action={setArtistHospitality} className="mt-3 grid gap-2">
            <input type="hidden" name="entry_id" value={artist.id}/>
            <textarea name="drinks" maxLength={3000} defaultValue={row.drinks||''} placeholder="Drank voor artiest" className="min-h-20 rounded-lg border bg-background p-2"/>
            <textarea name="hospitality_notes" maxLength={3000} defaultValue={row.hospitality_notes||''} placeholder="Backstage / hospitality notitie" className="min-h-20 rounded-lg border bg-background p-2"/>
            <button className="rounded-lg border px-3 py-2 font-bold">HOSPITALITY OPSLAAN</button>
          </form>
        </details>}
      </article>
    })}</div>
  </section>
}
