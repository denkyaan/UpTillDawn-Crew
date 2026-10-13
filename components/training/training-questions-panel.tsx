"use client"
import {useEffect,useState} from "react"
import {activeUiLocale,type SupportedUiLocale} from "@/lib/locale-preferences"
import type {TourRole} from "@/lib/tour-training"
import {answerTrainingQuestion,listTrainingQuestions,sendTrainingQuestion} from "@/lib/training/questions"
const t=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
type Question={id:string;participant_id:string;role:string;question:string;answer:string|null;status:string;created_at:string}
export function TrainingQuestionsPanel({scenarioId,role,isAdmin=false}:{scenarioId:string;role:TourRole;isAdmin?:boolean}){
 const [locale,setLocale]=useState<SupportedUiLocale>("nl")
 const [questions,setQuestions]=useState<Question[]>([])
 const [message,setMessage]=useState("")
 const [answers,setAnswers]=useState<Record<string,string>>({})
 const [error,setError]=useState("")
 const [busy,setBusy]=useState(false)
 const refresh=async()=>{const data=await listTrainingQuestions(scenarioId);setQuestions((data??[]) as Question[])}
 useEffect(()=>{setLocale(activeUiLocale());void refresh().catch(e=>setError(String(e)))},[scenarioId])
 const submit=async()=>{if(!message.trim()||busy)return;setBusy(true);setError("");try{await sendTrainingQuestion(scenarioId,role,message);setMessage("");await refresh()}catch(e){setError(String(e))}finally{setBusy(false)}}
 const reply=async(id:string)=>{if(!answers[id]?.trim()||busy)return;setBusy(true);setError("");try{await answerTrainingQuestion(id,answers[id]);setAnswers(v=>({...v,[id]:""}));await refresh()}catch(e){setError(String(e))}finally{setBusy(false)}}
 return <section className="space-y-4 rounded-2xl border p-4" aria-label="Training questions">
  <h2 className="font-bold">{t(locale,"Vragen over de opleiding","Training questions","Questions sur la formation","Fragen zur Schulung")}</h2>
  <p className="text-sm text-muted-foreground">{t(locale,"Stel gerust meerdere vragen. Vragen zijn niet verplicht om af te ronden.","Ask as many questions as you need. Questions are optional.","Posez plusieurs questions si nécessaire. Elles sont facultatives.","Stelle bei Bedarf mehrere Fragen. Fragen sind freiwillig.")}</p>
  {!isAdmin&&<div className="space-y-2"><textarea aria-label={t(locale,"Jouw vraag","Your question","Votre question","Deine Frage")} className="w-full rounded-lg border bg-background p-3" maxLength={4000} value={message} onChange={e=>setMessage(e.target.value)}/><button type="button" disabled={busy||!message.trim()} onClick={submit} className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{t(locale,"Vraag verzenden","Send question","Envoyer la question","Frage senden")}</button></div>}
  {error&&<p role="alert" className="text-sm text-red-500">{error}</p>}
  <div className="space-y-3">{questions.map(q=><article key={q.id} className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{isAdmin?q.participant_id+" · "+q.role:q.status}</p><p className="mt-2 whitespace-pre-wrap text-sm">{q.question}</p>{q.answer&&<p className="mt-2 rounded-lg bg-muted p-3 text-sm">{q.answer}</p>}{isAdmin&&q.status==="open"&&<div className="mt-3 space-y-2"><textarea aria-label={t(locale,"Antwoord","Answer","Réponse","Antwort")} className="w-full rounded-lg border bg-background p-2" value={answers[q.id]??""} onChange={e=>setAnswers(v=>({...v,[q.id]:e.target.value}))}/><button type="button" disabled={busy||!answers[q.id]?.trim()} onClick={()=>void reply(q.id)} className="rounded-lg border px-3 py-2 text-sm">{t(locale,"Antwoorden","Reply","Répondre","Antworten")}</button></div>}</article>)}</div>
 </section>
}
