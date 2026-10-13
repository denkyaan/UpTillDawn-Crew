"use client"
import {useEffect,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"

const KEY="uptilldawn-training-workflow-v3"
const t=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
type EventDraft={name:string;venue:string;start:string;end:string;deadline:string;capacity:string}
const empty:EventDraft={name:"",venue:"",start:"",end:"",deadline:"",capacity:""}
export function SandboxAdminEvent(){
 const [l,setL]=useState<SupportedUiLocale>("nl")
 const [draft,setDraft]=useState<EventDraft>(empty)
 const [created,setCreated]=useState(false)
 const [published,setPublished]=useState(false)
 const [error,setError]=useState("")
 useEffect(()=>{const apply=()=>setL(activeUiLocale());apply();addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 useEffect(()=>{try{const s=JSON.parse(sessionStorage.getItem(KEY)||"{}");if(s.adminEventDraft)setDraft(s.adminEventDraft);setCreated(Boolean(s.adminEventCreated));setPublished(Boolean(s.adminEventPublished))}catch{}},[])
 const persist=(patch:Record<string,unknown>)=>{let s={};try{s=JSON.parse(sessionStorage.getItem(KEY)||"{}")}catch{}sessionStorage.setItem(KEY,JSON.stringify({...s,...patch}))}
 const update=(field:keyof EventDraft,value:string)=>{setDraft(old=>({...old,[field]:value}));setError("")}
 const create=()=>{
  if(!draft.name.trim()||!draft.venue.trim()||!draft.start||!draft.end||!draft.deadline||!draft.capacity){setError(t(l,"Vul alle velden in.","Complete all fields.","Complétez tous les champs.","Fülle alle Felder aus."));return}
  if(new Date(draft.end)<=new Date(draft.start)||new Date(draft.deadline)>=new Date(draft.start)||Number(draft.capacity)<1||!Number.isInteger(Number(draft.capacity))){setError(t(l,"Controleer de uren, deadline en capaciteit.","Check the times, deadline and capacity.","Vérifiez les heures, la date limite et la capacité.","Prüfe Zeiten, Frist und Kapazität."));return}
  setCreated(true);persist({adminEventCreated:true,adminEventDraft:draft})
 }
 const publish=()=>{setPublished(true);persist({adminEventPublished:true,adminEventDraft:draft,navTarget:"workplaces"});dispatchEvent(new CustomEvent("uptilldawn-training-nav-target",{detail:{target:"workplaces"}}))}
 const fieldClass="w-full rounded-xl border bg-background px-3 py-2 text-sm"
 return <main className="mx-auto max-w-3xl space-y-5 p-4 pb-24 sm:p-6" data-tour-demo="training-screen">
  <header><p className="text-xs font-bold uppercase text-violet-400">{t(l,"TRAINING · FICTIEVE GEGEVENS","TRAINING · FICTIONAL DATA","FORMATION · DONNÉES FICTIVES","TRAINING · FIKTIVE DATEN")}</p><h1 className="mt-2 text-2xl font-black">{t(l,"Maak zelf een evenement","Create an event yourself","Créez vous-même un événement","Erstelle selbst ein Event")}</h1><p className="mt-2 text-sm text-muted-foreground">{t(l,"Vul alle gegevens zelf in. Dit oefenevenement wordt alleen in je browsersessie opgeslagen.","Enter all details yourself. This practice event is stored only in your browser session.","Saisissez vous-même toutes les données. Cet événement fictif reste dans votre session.","Gib alle Daten selbst ein. Dieses Übungsevent wird nur in deiner Browsersitzung gespeichert.")}</p></header>
  <form onSubmit={e=>{e.preventDefault();create()}} className="space-y-4 rounded-2xl border bg-card p-4">
   <label className="block space-y-1 text-sm font-semibold">{t(l,"Naam evenement","Event name","Nom de l’événement","Eventname")}<input data-tour-demo="primary-action" className={fieldClass} required value={draft.name} disabled={created} onChange={e=>update("name",e.target.value)} placeholder="Up Till Dawn — Demo Night"/></label>
   <label className="block space-y-1 text-sm font-semibold">{t(l,"Locatie","Venue","Lieu","Veranstaltungsort")}<input className={fieldClass} required value={draft.venue} disabled={created} onChange={e=>update("venue",e.target.value)} placeholder="Leuven"/></label>
   <div className="grid gap-4 sm:grid-cols-2">
    <label className="block space-y-1 text-sm font-semibold">{t(l,"Startdatum en uur","Start date and time","Début","Beginn")}<input className={fieldClass} type="datetime-local" required value={draft.start} disabled={created} onChange={e=>update("start",e.target.value)}/></label>
    <label className="block space-y-1 text-sm font-semibold">{t(l,"Einddatum en uur","End date and time","Fin","Ende")}<input className={fieldClass} type="datetime-local" required value={draft.end} disabled={created} onChange={e=>update("end",e.target.value)}/></label>
    <label className="block space-y-1 text-sm font-semibold">{t(l,"Inschrijvingsdeadline","Registration deadline","Date limite d’inscription","Anmeldefrist")}<input className={fieldClass} type="datetime-local" required value={draft.deadline} disabled={created} onChange={e=>update("deadline",e.target.value)}/></label>
    <label className="block space-y-1 text-sm font-semibold">{t(l,"Maximum aantal deelnemers","Maximum crew capacity","Capacité maximale","Maximale Teilnehmerzahl")}<input className={fieldClass} type="number" min="1" step="1" required value={draft.capacity} disabled={created} onChange={e=>update("capacity",e.target.value)}/></label>
   </div>
   {error&&<p role="alert" className="text-sm font-semibold text-red-500">{error}</p>}
   {!created&&<button type="submit" className="rounded-xl bg-violet-600 px-5 py-3 font-bold text-white">{t(l,"EVENEMENT AANMAKEN","CREATE EVENT","CRÉER L’ÉVÉNEMENT","EVENT ERSTELLEN")}</button>}
  </form>
  {created&&<section className="space-y-3 rounded-2xl border border-violet-500/50 p-4"><p className="font-bold text-emerald-500">{t(l,"Fictief evenement aangemaakt","Fictional event created","Événement fictif créé","Fiktives Event erstellt")}</p><h2 className="text-xl font-bold">{draft.name}</h2><p className="text-sm">{draft.venue} · {draft.start.replace("T"," ")} — {draft.end.replace("T"," ")}</p><p className="text-sm">{t(l,"Capaciteit","Capacity","Capacité","Kapazität")}: {draft.capacity}</p><p className="text-sm">{t(l,"Deadline","Deadline","Date limite","Frist")}: {draft.deadline.replace("T"," ")}</p>{!published?<button data-tour-demo="primary-action" type="button" onClick={publish} className="rounded-xl bg-violet-600 px-5 py-3 font-bold text-white">{t(l,"EVENEMENT PUBLICER EN VERDERGAAN","PUBLISH EVENT AND CONTINUE","PUBLIER ET CONTINUER","EVENT VERÖFFENTLICHEN UND WEITER")}</button>:<p role="status" className="font-semibold text-emerald-500">{t(l,"Gepubliceerd in de demo. Open zelf Werkplekken & Shifts om verder te gaan.","Published in the demo. Open Workplaces & Shifts yourself to continue.","Publié dans la démo. Ouvrez vous-même Postes & Shifts.","In der Demo veröffentlicht. Öffne Arbeitsplätze & Schichten selbst.")}</p>}</section>}
 </main>
}
