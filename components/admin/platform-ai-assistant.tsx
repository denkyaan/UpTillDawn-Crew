'use client'

import { useState } from 'react'
import { humanizeAppError } from '@/lib/client-error-message'
import { activeUiLocale, LANGUAGE_APPLIED_EVENT, type SupportedUiLocale } from '@/lib/locale-preferences'
import { useEffect } from 'react'

export function PlatformAiAssistant({eventId,contextLabel,contextKey,compact=false}:{eventId?:string;contextLabel?:string;contextKey?:string;compact?:boolean}={}){
  const [locale,setLocale]=useState<SupportedUiLocale>('nl')
  useEffect(()=>{const apply=()=>setLocale(activeUiLocale());apply();window.addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>window.removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
  const t=({nl:{title:'Admin AI-assistent',description:'Analyseert de huidige operationele context. Voert geen wijzigingen uit.',placeholder:'Welke operationele problemen vragen aandacht?',submit:'VRAAG AI',busy:'ANALYSEREN…',empty:'Geen antwoord ontvangen.',unavailable:'AI-assistent is tijdelijk niet beschikbaar.'},fr:{title:'Assistant IA Admin',description:'Analyse le contexte opérationnel actuel sans effectuer de modifications.',placeholder:'Quels problèmes opérationnels demandent une attention ?',submit:'DEMANDER',busy:'ANALYSE…',empty:'Aucune réponse reçue.',unavailable:'L’assistant IA est indisponible.'},en:{title:'Admin AI assistant',description:'Analyzes current operational context without making changes.',placeholder:'Which operational issues need attention?',submit:'ASK AI',busy:'ANALYZING…',empty:'No response received.',unavailable:'AI assistant is temporarily unavailable.'},de:{title:'Admin-KI-Assistent',description:'Analysiert den aktuellen Betriebsstatus, ohne Änderungen vorzunehmen.',placeholder:'Welche betrieblichen Probleme brauchen Aufmerksamkeit?',submit:'KI FRAGEN',busy:'ANALYSE…',empty:'Keine Antwort erhalten.',unavailable:'KI-Assistent ist vorübergehend nicht verfügbar.'}} as const)[locale]
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
        body:JSON.stringify({message:value,eventId,contextKey}),
      })
      const payload=await response.json() as {answer?:string;error?:string}
      setAnswer(payload.answer||(response.ok?t.empty:humanizeAppError(payload.error)))
    }catch{
      setAnswer(t.unavailable)
    }finally{setBusy(false)}
  }

  return <section className={compact?'space-y-3':'space-y-3 rounded-2xl border p-4'}>
    <div>
      <h2 className="text-xl font-black">{t.title}{contextLabel?' · '+contextLabel:''}</h2>
      <p className="text-sm text-muted-foreground">{t.description}</p>
    </div>
    <textarea
      value={message}
      onChange={e=>setMessage(e.target.value)}
      onKeyDown={e=>{
        if(e.key==='Enter'&&!e.shiftKey){
          e.preventDefault()
          void submit()
        }
      }}
      maxLength={4000}
      rows={compact?3:5}
      autoComplete="off"
      placeholder={t.placeholder}
      className={compact?'min-h-24 w-full resize-y rounded-xl border bg-background p-3':'min-h-32 w-full resize-y rounded-xl border bg-background p-3'}
    />
    <button type="button" onClick={submit} disabled={busy||!message.trim()} className="rounded-xl bg-violet-600 px-4 py-3 font-bold text-white">{busy?t.busy:t.submit}</button>
    {answer&&<p className="whitespace-pre-wrap rounded-xl bg-muted/40 p-3 text-sm">{answer}</p>}
  </section>
}
