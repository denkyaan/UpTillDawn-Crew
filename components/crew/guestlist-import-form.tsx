'use client'

import { useState } from 'react'

export function GuestlistImportForm({eventId}:{eventId:string}){
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')

  async function submit(formData:FormData){
    if(busy)return
    setBusy(true);setMessage('')
    try{
      formData.set('event_id',eventId)
      const response=await fetch('/api/guestlist/import',{method:'POST',body:formData})
      const payload=await response.json().catch(()=>null) as {inserted?:number;duplicates?:number;supplemented?:number;error?:string}|null
      if(!response.ok){
        setMessage(payload?.error||'Guestlist kon niet worden geïmporteerd.')
        return
      }
      setMessage(`Import klaar · ${payload?.inserted||0} nieuw · ${payload?.duplicates||0} bestaand · ${payload?.supplemented||0} aangevuld`)
      window.location.reload()
    }catch{
      setMessage('Guestlist kon niet worden geïmporteerd.')
    }finally{
      setBusy(false)
    }
  }

  return <form action={submit} className="grid gap-2">
    <input type="file" name="file" required accept=".xlsx,.csv,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="rounded-lg border bg-background p-3"/>
    <p className="text-xs text-muted-foreground">Ondersteund: XLSX, CSV en TXT. Kolommen zoals naam, type, spots, drank en hospitality worden automatisch herkend.</p>
    <button disabled={busy} className="rounded-xl border px-4 py-3 font-bold">{busy?'IMPORTEREN…':'BESTAND IMPORTEREN'}</button>
    {message&&<p className="rounded-lg border p-2 text-sm">{message}</p>}
  </form>
}
