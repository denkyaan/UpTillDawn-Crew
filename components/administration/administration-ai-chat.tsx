"use client"
import {useId,useState} from "react"
import type {SupportedUiLocale} from "@/lib/locale-preferences"
const copy={
 nl:{title:"Administratieve AI-assistent",description:"Stel vragen over administratie en opvolging. De assistent voert geen wijzigingen of betalingen uit.",placeholder:"Wat vraagt vandaag mijn aandacht?",send:"Vraag stellen",busy:"Bezig…",error:"De AI-assistent is momenteel niet beschikbaar.",empty:"Geen antwoord ontvangen."},
 fr:{title:"Assistant IA administratif",description:"Posez vos questions administratives. L'assistant ne modifie rien et n'effectue aucun paiement.",placeholder:"Que dois-je traiter aujourd'hui ?",send:"Envoyer",busy:"En cours…",error:"L'assistant IA est indisponible.",empty:"Aucune réponse reçue."},
 en:{title:"Administration AI assistant",description:"Ask about administration and follow-ups. The assistant cannot change records or make payments.",placeholder:"What needs my attention today?",send:"Ask AI",busy:"Working…",error:"The AI assistant is unavailable.",empty:"No answer received."},
 de:{title:"Verwaltungs-KI-Assistent",description:"Stelle Fragen zur Verwaltung. Der Assistent ändert keine Daten und führt keine Zahlungen aus.",placeholder:"Was braucht heute meine Aufmerksamkeit?",send:"KI fragen",busy:"Wird bearbeitet…",error:"Der KI-Assistent ist nicht verfügbar.",empty:"Keine Antwort erhalten."}
} as const
export function AdministrationAiChat({locale}:{locale:SupportedUiLocale}){
 const t=copy[locale]
 const [message,setMessage]=useState("")
 const [history,setHistory]=useState<Array<{role:"user"|"assistant";content:string}>>([])
 const inputId=useId()
 const [busy,setBusy]=useState(false)
 async function submit(){
  const value=message.trim()
  if(!value||busy)return
  setBusy(true)
  try{
   const response=await fetch("/api/administration/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:value,locale,history:history.slice(-8)})})
   const payload=await response.json() as {answer?:string;error?:string}
   if(response.ok&&payload.answer){setHistory(previous=>[...previous,{role:"user",content:value},{role:"assistant",content:payload.answer!}].slice(-20));setMessage("")}
   else setHistory(previous=>[...previous,{role:"assistant",content:t.error}].slice(-20))
  }catch{setHistory(previous=>[...previous,{role:"assistant",content:t.error}].slice(-20))}finally{setBusy(false)}
 }
 return <section className="space-y-4 rounded-2xl border bg-card p-5">
  <header><h1 className="text-2xl font-bold">{t.title}</h1><p className="mt-2 text-sm text-muted-foreground">{t.description}</p></header>
  <form onSubmit={e=>{e.preventDefault();void submit()}} className="space-y-3">
   <label htmlFor={inputId} className="sr-only">{t.title}</label>
   <textarea id={inputId} value={message} onChange={e=>setMessage(e.target.value)} maxLength={4000} rows={5} placeholder={t.placeholder} className="w-full rounded-xl border bg-background p-3"/>
   <button type="submit" disabled={busy||!message.trim()} className="rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy?t.busy:t.send}</button>
  </form>
  {history.length>0&&<div role="log" aria-live="polite" aria-relevant="additions" className="max-h-96 space-y-3 overflow-y-auto rounded-xl border p-3">{history.map((entry,index)=><div key={index} className={entry.role==="user"?"ml-6 whitespace-pre-wrap rounded-xl bg-violet-500/10 p-3 text-sm":"mr-6 whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm"}>{entry.content}</div>)}</div>}
 </section>
}
