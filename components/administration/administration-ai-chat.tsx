"use client"
import {useId,useState} from "react"
import {AdministrationAiBookingNotes} from "@/components/administration/administration-ai-booking-notes"
import type {SupportedUiLocale} from "@/lib/locale-preferences"
const copy={
 nl:{title:"Administratieve AI-assistent",description:"Stel vragen over administratie en opvolging. De assistent voert geen wijzigingen of betalingen uit.",placeholder:"Wat vraagt vandaag mijn aandacht?",send:"Vraag stellen",busy:"Bezig…",error:"De AI-assistent is momenteel niet beschikbaar.",empty:"Geen antwoord ontvangen.",clear:"Gesprek wissen",invalid:"Controleer je vraag en probeer opnieuw."},
 fr:{title:"Assistant IA administratif",description:"Posez vos questions administratives. L'assistant ne modifie rien et n'effectue aucun paiement.",placeholder:"Que dois-je traiter aujourd'hui ?",send:"Envoyer",busy:"En cours…",error:"L'assistant IA est indisponible.",empty:"Aucune réponse reçue.",clear:"Effacer la conversation",invalid:"Vérifiez votre question et réessayez."},
 en:{title:"Administration AI assistant",description:"Ask about administration and follow-ups. The assistant cannot change records or make payments.",placeholder:"What needs my attention today?",send:"Ask AI",busy:"Working…",error:"The AI assistant is unavailable.",empty:"No answer received.",clear:"Clear conversation",invalid:"Check your question and try again."},
 de:{title:"Verwaltungs-KI-Assistent",description:"Stelle Fragen zur Verwaltung. Der Assistent ändert keine Daten und führt keine Zahlungen aus.",placeholder:"Was braucht heute meine Aufmerksamkeit?",send:"KI fragen",busy:"Wird bearbeitet…",error:"Der KI-Assistent ist nicht verfügbar.",empty:"Keine Antwort erhalten.",clear:"Gespräch löschen",invalid:"Überprüfe deine Frage und versuche es erneut."}
} as const
const suggestions:Record<SupportedUiLocale,string[]>={
 nl:["Welke administratie vraagt aandacht?","Welke artiesten hebben opvolging nodig?","Zijn er openstaande werkuren?"],
 fr:["Quels dossiers demandent une attention ?","Quels artistes nécessitent un suivi ?","Y a-t-il des heures en attente ?"],
 en:["Which admin items need attention?","Which artists need follow-up?","Are there submitted timesheets?"],
 de:["Welche Verwaltungsvorgänge brauchen Aufmerksamkeit?","Welche Künstler benötigen Nachverfolgung?","Gibt es eingereichte Arbeitszeiten?"]
}
export function AdministrationAiChat({locale,initialBookingId}:{locale:SupportedUiLocale;initialBookingId?:string}){
 const t=copy[locale]
 const [message,setMessage]=useState("")
 const [history,setHistory]=useState<Array<{role:"user"|"assistant";content:string}>>([])
 const inputId=useId()
 const [error,setError]=useState("")
 const [busy,setBusy]=useState(false)
 async function submit(){
  const value=message.trim()
  if(!value||busy)return
  setBusy(true);setError("")
  try{
   const response=await fetch("/api/administration/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:value,locale,history:history.slice(-8)})})
   const payload=await response.json() as {answer?:string;error?:string}
   if(response.ok&&payload.answer){setHistory(previous=>[...previous,{role:"user" as const,content:value},{role:"assistant" as const,content:payload.answer!}].slice(-20));setMessage("")}
   else setError(response.status===400?t.invalid:t.error)
  }catch{setError(t.error)}finally{setBusy(false)}
 }
 return <section className="space-y-4 rounded-2xl border bg-card p-5">
  <header><h1 className="text-2xl font-bold">{t.title}</h1><p className="mt-2 text-sm text-muted-foreground">{t.description}</p></header>
  <div className="flex flex-wrap gap-2" aria-label={t.title}>{suggestions[locale].map(prompt=><button key={prompt} type="button" disabled={busy} onClick={()=>setMessage(prompt)} className="rounded-full border px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50">{prompt}</button>)}</div>
  <form onSubmit={e=>{e.preventDefault();void submit()}} className="space-y-3">
   <label htmlFor={inputId} className="sr-only">{t.title}</label>
   <textarea id={inputId} value={message} onChange={e=>setMessage(e.target.value)} maxLength={4000} rows={5} placeholder={t.placeholder} className="w-full rounded-xl border bg-background p-3"/>
   <button type="submit" disabled={busy||!message.trim()} className="rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy?t.busy:t.send}</button>
  </form>
  {history.length>0&&<button type="button" disabled={busy} onClick={()=>{setHistory([]);setMessage("");setError("")}} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{t.clear}</button>}
  {error&&<p role="alert" className="rounded-xl border p-3 text-sm">{error}</p>}
  <AdministrationAiBookingNotes locale={locale} initialBookingId={initialBookingId}/>
  {history.length>0&&<div role="log" aria-live="polite" aria-relevant="additions" className="max-h-96 space-y-3 overflow-y-auto rounded-xl border p-3">{history.map((entry,index)=><div key={index} className={entry.role==="user"?"ml-6 whitespace-pre-wrap rounded-xl bg-violet-500/10 p-3 text-sm":"mr-6 whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm"}>{entry.content}</div>)}</div>}
 </section>
}
