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

  const quick=[
    'Welke artiesten zijn al aanwezig en wat moet backstage nog voorbereiden?',
    'Geef me het huidige salesoverzicht met cash, kaart, merch en tokens.',
    'Welke guestlist- of inkomproblemen moet ik nu oplossen?',
    'Welke voorraad- en verkooprisico’s moet ik nu bekijken?',
  ]

  return <section className="space-y-3 rounded-2xl border p-4">
    <div>
      <h2 className="text-xl font-black">Admin AI-assistent</h2>
      <p className="text-sm text-muted-foreground">Vraag operationele uitleg of laat de assistent risico’s en volgende acties samenvatten. Kritieke wijzigingen worden nooit automatisch uitgevoerd.</p>
    </div>
    <div className="flex flex-wrap gap-2">{quick.map(prompt=><button key={prompt} type="button" onClick={()=>setMessage(prompt)} className="rounded-full border px-3 py-2 text-xs font-semibold">{prompt}</button>)}</div>
    <textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={4000} placeholder="Bijvoorbeeld: wie is al aanwezig, wat moet backstage voorbereiden en hoe staan de sales?" className="min-h-28 w-full rounded-xl border bg-background p-3"/>
    <button type="button" onClick={submit} disabled={busy||!message.trim()} className="rounded-xl bg-violet-600 px-4 py-3 font-bold text-white">{busy?'ANALYSEREN…':'VRAAG AI'}</button>
    {answer&&<p className="whitespace-pre-wrap rounded-xl bg-muted/40 p-3 text-sm">{answer}</p>}
  </section>
}
