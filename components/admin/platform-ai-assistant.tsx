'use client'

import { useState } from 'react'

export function PlatformAiAssistant(){
  const [message,setMessage]=useState('')
  const [answer,setAnswer]=useState('')
  const [busy,setBusy]=useState(false)

  async function submit(){
    const value=message.trim()
    if(!value||busy)return
    setBusy(true);setAnswer('')
    try{
      const response=await fetch('/api/admin-assistant',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:value}),
      })
      const payload=await response.json() as {answer?:string;error?:string}
      setAnswer(payload.answer||payload.error||'AI-assistent gaf geen antwoord.')
    }catch{
      setAnswer('AI-assistent is tijdelijk niet beschikbaar.')
    }finally{setBusy(false)}
  }

  return <section className="space-y-3 rounded-2xl border p-4">
    <div>
      <h2 className="text-xl font-black">Admin AI-assistent</h2>
      <p className="text-sm text-muted-foreground">Vraag operationele uitleg of laat de assistent risico’s en volgende acties samenvatten. Kritieke wijzigingen worden nooit automatisch uitgevoerd.</p>
    </div>
    <textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={4000} placeholder="Bijvoorbeeld: welke operationele risico’s moet ik eerst bekijken?" className="min-h-28 w-full rounded-xl border bg-background p-3"/>
    <button type="button" onClick={submit} disabled={busy||!message.trim()} className="rounded-xl bg-violet-600 px-4 py-3 font-bold text-white">{busy?'ANALYSEREN…':'VRAAG AI'}</button>
    {answer&&<p className="whitespace-pre-wrap rounded-xl bg-muted/40 p-3 text-sm">{answer}</p>}
  </section>
}
