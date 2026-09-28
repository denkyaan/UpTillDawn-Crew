'use client'

import { useState } from 'react'
import { showSaveSuccess } from '@/lib/client-save-success'

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
      showSaveSuccess()
      window.location.reload()
    }catch{
      setMessage('Guestlist kon niet worden geïmporteerd.')
    }finally{
      setBusy(false)
    }
  }

  return <form action={submit} className="grid gap-2">
    <input
      type="file"
      name="file"
      required
      accept=".pdf,.docx,.xlsx,.xls,.xlsm,.xlsb,.ods,.odt,.numbers,.csv,.txt,.jpg,.jpeg,.png,.webp,application/pdf,text/csv,text/plain,image/jpeg,image/png,image/webp"
      className="rounded-lg border bg-background p-3"
    />
    <p className="text-xs text-muted-foreground">Upload PDF, Word, Excel, OpenDocument, Numbers, CSV, TXT of een foto. Naam, artiest/guest, spots, drank en hospitality worden automatisch herkend. PDF/Word/foto wordt veilig naar tekst omgezet en door de AI uitgelezen.</p>
    <button disabled={busy} className="rounded-xl border px-4 py-3 font-bold">{busy?'IMPORTEREN…':'DOCUMENT IMPORTEREN'}</button>
    {message&&<p className="rounded-lg border p-2 text-sm">{message}</p>}
  </form>
}
