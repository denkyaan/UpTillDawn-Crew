'use client'

import { useEffect,useMemo,useState } from 'react'
import { createClient } from '@/lib/supabase/crew-client'
import { humanizeAppError } from '@/lib/client-error-message'
import { removeGuestlistEntry,updateGuestlistEntry } from '@/lib/actions/guestlist'

export type GuestlistEntry={
  id:string
  event_id:string
  name:string
  entry_type:'artist'|'guest'
  spots_total:number
  spots_checked_in:number
  notes:string|null
  source:string
  source_document_name:string|null
  last_checked_in_at:string|null
  arrival_notified_at:string|null
}

export function GuestlistEntranceClient({
  eventId,
  initialEntries,
  canCheckIn,
  canManage,
}:{
  eventId:string
  initialEntries:GuestlistEntry[]
  canCheckIn:boolean
  canManage:boolean
}){
  const [entries,setEntries]=useState(initialEntries)
  const [query,setQuery]=useState('')
  const [filter,setFilter]=useState<'all'|'artist'|'guest'|'open'|'complete'>('all')
  const [message,setMessage]=useState('')
  const [pendingEntry,setPendingEntry]=useState<string|null>(null)

  useEffect(()=>{
    const s=createClient()
    const channel=s.channel('guestlist:'+eventId)
      .on('postgres_changes',{
        event:'*',
        schema:'public',
        table:'event_guestlist_entries',
        filter:'event_id=eq.'+eventId,
      },payload=>{
        if(payload.eventType==='DELETE'){
          const old=payload.old as {id?:string}
          if(old.id)setEntries(current=>current.filter(entry=>entry.id!==old.id))
          return
        }
        const next=payload.new as GuestlistEntry
        setEntries(current=>{
          const index=current.findIndex(entry=>entry.id===next.id)
          if(index<0)return [...current,next]
          const copy=[...current]
          copy[index]=next
          return copy
        })
      })
      .subscribe()
    return()=>{void s.removeChannel(channel)}
  },[eventId])

  const visible=useMemo(()=>{
    const needle=query.trim().toLocaleLowerCase()
    return entries
      .filter(entry=>{
        if(filter==='artist'&&entry.entry_type!=='artist')return false
        if(filter==='guest'&&entry.entry_type!=='guest')return false
        if(filter==='open'&&entry.spots_checked_in>=entry.spots_total)return false
        if(filter==='complete'&&entry.spots_checked_in<entry.spots_total)return false
        if(!needle)return true
        return [entry.name,entry.notes||'',entry.entry_type==='artist'?'artiest':'guest']
          .some(value=>value.toLocaleLowerCase().includes(needle))
      })
      .sort((a,b)=>{
        const aDone=a.spots_checked_in>=a.spots_total
        const bDone=b.spots_checked_in>=b.spots_total
        if(aDone!==bDone)return aDone?1:-1
        if(a.entry_type!==b.entry_type)return a.entry_type==='artist'?-1:1
        return a.name.localeCompare(b.name,'nl')
      })
  },[entries,filter,query])

  const totals=useMemo(()=>entries.reduce((acc,entry)=>{
    acc.total+=entry.spots_total
    acc.checked+=entry.spots_checked_in
    if(entry.entry_type==='artist'){
      acc.artists+=1
      if(entry.spots_checked_in>0)acc.artistsPresent+=1
    }else acc.guests+=1
    return acc
  },{total:0,checked:0,artists:0,artistsPresent:0,guests:0}),[entries])

  async function adjust(entry:GuestlistEntry,delta:-1|1){
    if(pendingEntry)return
    setMessage('')
    setPendingEntry(entry.id)
    try{
      const s=createClient()
      const {data,error}=await s.rpc('upt_guestlist_checkin',{p_entry:entry.id,p_delta:delta})
      if(error){
        setMessage(humanizeAppError(error))
        return
      }
      const payload=(data&&typeof data==='object'&&!Array.isArray(data)?data:{}) as {checkedIn?:unknown}
      const checked=typeof payload.checkedIn==='number'?payload.checkedIn:entry.spots_checked_in+delta
      setEntries(current=>current.map(item=>item.id===entry.id?{
        ...item,
        spots_checked_in:checked,
        last_checked_in_at:new Date().toISOString(),
      }:item))
    }catch(error){
      setMessage(humanizeAppError(error))
    }finally{
      setPendingEntry(null)
    }
  }

  return <section className="space-y-4">
    <div className="grid gap-2 sm:grid-cols-5">
      <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Spots</p><p className="text-2xl font-black">{totals.checked}/{totals.total}</p></div>
      <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Nog verwacht</p><p className="text-2xl font-black">{Math.max(0,totals.total-totals.checked)}</p></div>
      <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Artiesten aanwezig</p><p className="text-2xl font-black">{totals.artistsPresent}/{totals.artists}</p></div>
      <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Artiesten</p><p className="text-2xl font-black">{totals.artists}</p></div>
      <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Guests</p><p className="text-2xl font-black">{totals.guests}</p></div>
    </div>

    <div className="sticky top-0 z-10 space-y-2 rounded-2xl border bg-background/95 p-3 backdrop-blur">
      <input
        value={query}
        onChange={event=>setQuery(event.target.value)}
        placeholder="Zoek naam, artiest, guest of notitie…"
        autoComplete="off"
        className="w-full rounded-xl border bg-background p-3 text-lg"
      />
      <div className="flex flex-wrap gap-2">
        {([
          ['all','Alles'],
          ['artist','Artiesten'],
          ['guest','Guests'],
          ['open','Nog verwacht'],
          ['complete','Binnen'],
        ] as const).map(([key,label])=><button
          key={key}
          type="button"
          onClick={()=>setFilter(key)}
          className={'rounded-full border px-3 py-2 text-sm font-bold '+(filter===key?'bg-violet-600 text-white':'')}
        >{label}</button>)}
      </div>
    </div>

    {message&&<p className="rounded-xl border border-red-500/40 p-3 text-sm text-red-500">{message}</p>}
    {!canCheckIn&&<p className="rounded-xl border border-amber-500/40 p-3 text-sm text-muted-foreground">Je kunt de lijst opzoeken. Check-inregistratie is alleen beschikbaar voor toegewezen inkomcrew, verantwoordelijken en admin.</p>}

    {!visible.length
      ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Geen resultaten gevonden.</p>
      : <div className="space-y-2">{visible.map(entry=>{
          const complete=entry.spots_checked_in>=entry.spots_total
          const remaining=Math.max(0,entry.spots_total-entry.spots_checked_in)
          return <article id={'artist-'+entry.id} key={entry.id} className={'rounded-2xl border p-4 '+(complete?'opacity-60':'')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black">{entry.name}</h3>
                  <span className={'rounded-full border px-2 py-1 text-xs font-black '+(entry.entry_type==='artist'?'border-violet-500/50 text-violet-400':'')}>{entry.entry_type==='artist'?'ARTIEST':'GUEST'}</span>
                  {complete&&<span className="rounded-full border border-emerald-500/50 px-2 py-1 text-xs font-black text-emerald-600">BINNEN</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{entry.spots_checked_in} van {entry.spots_total} spots binnen · {remaining} resterend</p>
                {entry.notes&&<p className="mt-2 whitespace-pre-wrap text-sm">{entry.notes}</p>}
                {entry.source_document_name&&<p className="mt-1 text-xs text-muted-foreground">Import: {entry.source_document_name}</p>}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canCheckIn||pendingEntry!==null||entry.spots_checked_in<=0}
                  onClick={()=>void adjust(entry,-1)}
                  className="h-11 w-11 rounded-xl border text-xl font-black disabled:opacity-30"
                  aria-label="Eén spot terugdraaien"
                >−</button>
                <span className="min-w-12 text-center text-xl font-black">{entry.spots_checked_in}/{entry.spots_total}</span>
                <button
                  type="button"
                  disabled={!canCheckIn||pendingEntry!==null||complete}
                  onClick={()=>void adjust(entry,1)}
                  className="h-11 w-11 rounded-xl bg-emerald-700 text-xl font-black text-white disabled:opacity-30"
                  aria-label="Eén spot inchecken"
                  data-action="guestlist-check-in"
                >+</button>
              </div>
            </div>

            {canManage&&<details className="mt-3 rounded-xl border p-3">
              <summary className="cursor-pointer text-sm font-semibold">Beheren</summary>
              <form action={updateGuestlistEntry} className="mt-3 grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="entry_id" value={entry.id}/>
                <input name="name" required maxLength={240} defaultValue={entry.name} className="rounded-lg border bg-background p-2"/>
                <select name="entry_type" defaultValue={entry.entry_type} className="rounded-lg border bg-background p-2">
                  <option value="guest">Guest</option>
                  <option value="artist">Artiest</option>
                </select>
                <input name="spots" type="number" min={Math.max(1,entry.spots_checked_in)} max="100" defaultValue={entry.spots_total} className="rounded-lg border bg-background p-2"/>
                <input name="notes" maxLength={2000} defaultValue={entry.notes||''} placeholder="Notitie" className="rounded-lg border bg-background p-2"/>
                <button className="rounded-lg border px-3 py-2 font-bold sm:col-span-2">WIJZIGINGEN OPSLAAN</button>
              </form>
              <form action={removeGuestlistEntry} className="mt-2">
                <input type="hidden" name="entry_id" value={entry.id}/>
                <button className="rounded-lg border border-red-500/50 px-3 py-2 text-sm font-bold text-red-500">VERWIJDEREN VAN LIJST</button>
              </form>
            </details>}
          </article>
        })}</div>}
  </section>
}
