"use client"
import {useEffect,useMemo,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {getTrainingOperations} from "@/lib/training-exercise-catalog"
import type {TourRole} from "@/lib/tour-training"

type State={read:string[];timesheet:string;reason:string;hours:number;policy:string;daily:number;weekly:number;breakPhase:"working"|"break"|"resumed";reminder:boolean;audit:string[]}
const start=():State=>({read:[],timesheet:"",reason:"",hours:0,policy:"",daily:0,weekly:0,breakPhase:"working",reminder:false,audit:[]})
const key=(role:TourRole)=>"uptilldawn-worktime-drill-v1:"+role
const t=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
const delegated=new Set(["operations:admin:6","operations:admin:7","operations:employee:0","operations:employee:2","operations:responsible_lead:0","operations:responsible_lead:1"])
const get=(role:TourRole)=>{try{const v=JSON.parse(sessionStorage.getItem(key(role))||"null") as State|null;if(v&&Array.isArray(v.audit)&&Array.isArray(v.read))return {...start(),...v}}catch{}return start()}
const adminState=()=>{try{return JSON.parse(sessionStorage.getItem("uptilldawn-admin-training-operations:v1")||"{}") as {locked?:boolean;approved?:boolean;rejected?:boolean;reason?:string}}catch{return {}}}
export function SandboxOperationalDrill({role}:{role:string}){
 const trainingRole:TourRole=role==="admin"?"admin":role==="responsible_lead"?"responsible_lead":"employee"
 const [locale,setLocale]=useState<SupportedUiLocale>("nl"),[id,setId]=useState(""),[state,setState]=useState<State>(start)
 const [opened,setOpened]=useState(false),[value,setValue]=useState(""),[error,setError]=useState(""),[ready,setReady]=useState(false)
 const operations=useMemo(()=>getTrainingOperations(trainingRole,"operations"),[trainingRole])
 const step=operations.find(x=>x.id===id)
 const group=step?.id.split(":")[1],index=step?Number(step.id.split(":").at(-1)):-1
 const beginBreak=(group==="employee"&&index===3)||(group==="responsible_lead"&&index===2)
 const endBreak=(group==="employee"&&index===5)||(group==="responsible_lead"&&index===3)
 useEffect(()=>{const update=()=>setLocale(activeUiLocale());update();addEventListener(LANGUAGE_APPLIED_EVENT,update);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,update)},[])
 useEffect(()=>{const raf=requestAnimationFrame(()=>{setState(get(trainingRole));setReady(true)});return()=>cancelAnimationFrame(raf)},[trainingRole])
 useEffect(()=>{const sync=()=>{const next=document.querySelector('[data-training-lab] [data-training-operation]')?.getAttribute("data-training-operation")||"";setId(previous=>previous===next?previous:next)};sync();const o=new MutationObserver(sync);o.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["data-training-operation"]});return()=>o.disconnect()},[])
 useEffect(()=>{const raf=requestAnimationFrame(()=>{setOpened(false);setValue("");setError("")});return()=>cancelAnimationFrame(raf)},[id])
 const options=()=>id==="operations:admin:3"?[["lina","Lina Peeters"],["noah","Noah Jacobs"]]:id==="operations:admin:10"?[["daily",t(locale,"Dagelijks","Daily","Journalier","Täglich")],["weekly",t(locale,"Wekelijks","Weekly","Hebdomadaire","Wöchentlich")]]:[]
 const info=()=>{
  if(group==="shared"){
   const rows=[
    t(locale,"Main Bar, 20:00–04:00, verantwoordelijke Lina.","Main Bar, 20:00–04:00, lead Lina.","Bar principal, 20h–04h, responsable Lina.","Hauptbar, 20–04 Uhr, verantwortlich Lina."),
    t(locale,"Eerst aanwijzing door de verantwoordelijke, dan werken.","Lead check-in precedes work.","Pointage par le responsable avant le travail.","Check-in vor Arbeitsbeginn."),
    t(locale,"GPS-zone: 100 meter; buiten de zone is controle nodig.","100-metre GPS zone; check-in outside requires verification.","Zone GPS de 100 mètres ; contrôle hors zone.","100-Meter-GPS-Zone; außerhalb ist Prüfung nötig."),
    t(locale,"Werk-, pauze- en rijtijd hebben aparte klokken.","Work, breaks and driving have separate clocks.","Travail, pause et conduite ont des chronomètres séparés.","Arbeits-, Pausen- und Fahrzeit haben separate Uhren."),
    t(locale,"Pauze van 60 minuten telt niet mee als werk.","The mandatory 60-minute break is not work.","La pause obligatoire de 60 minutes ne compte pas comme travail.","60 Minuten Pflichtpause sind keine Arbeitszeit."),
    t(locale,"Remote-aanwijzing vereist selfiecontrole door verantwoordelijke.","Remote check-in requires lead selfie verification.","Pointage distant : contrôle du selfie par le responsable.","Remote-Check-in erfordert Selfieprüfung."),
    t(locale,"Melding 5 minuten vóór en 10 minuten na pauzeeinde.","Reminders 5 minutes before and 10 after break end.","Rappels 5 minutes avant et 10 après la fin de pause.","Erinnerungen 5 Minuten vor und 10 nach Pausenende.")
   ];return rows[index]||""
  }
  if(id==="operations:admin:9")return t(locale,"Goedgekeurde en gelockte urenstaat: wijzigingen zijn geblokkeerd.","Approved locked timesheet: changes prohibited.","Feuille approuvée verrouillée : modifications interdites.","Genehmigter gesperrter Stundenzettel: Änderungen gesperrt.")
  if(id==="operations:employee:6"||id==="operations:responsible_lead:7")return t(locale,"Stop Work is vergrendeld tot het laatste hoofdstuk.","Stop Work stays locked until the last chapter.","Arrêter le travail reste bloqué jusqu’au dernier chapitre.","Arbeit beenden bleibt bis zum letzten Kapitel gesperrt.")
  return t(locale,"Controleer Lina en Noah, hun shiften, actieve klok en pauzestatus.","Review Lina and Noah, their shifts, clocks and breaks.","Vérifiez Lina et Noah, shifts, chronomètres et pauses.","Prüfe Lina und Noah, Schichten, Uhren und Pausen.")
 }
 const submit=()=>{
  if(!step||!ready||delegated.has(id))return
  const next:State={...state,read:[...state.read],audit:[...state.audit]}
  const fail=(nl:string,en:string,fr:string,de:string)=>setError(t(locale,nl,en,fr,de))
  let saved=step.kind==="inspect"?"reviewed":"confirmed"
  if(step.kind==="inspect"){
   if(!opened)return
   if(id==="operations:admin:9"&&(!adminState().locked||!adminState().approved))return fail("Vergrendel eerst de goedgekeurde urenstaat.","Lock the approved timesheet first.","Verrouillez la feuille approuvée.","Genehmigten Stundenzettel zuerst sperren.")
   next.read.push(id)
   if((group==="employee"&&index===4)||(group==="responsible_lead"&&index===4))next.reminder=true
  }else if(step.kind==="select"){
   if(!options().some(o=>o[0]===value))return fail("Kies een geldige optie.","Select a valid option.","Choisissez une option valide.","Wähle eine gültige Option.")
   saved=value
   if(index===3)next.timesheet=value
   else if(index===10)next.policy=value
  }else if(step.kind==="message"){
   if(id==="operations:admin:8"){
    const x=adminState()
    if(!x.locked||x.rejected||!x.reason||x.reason.length<5)return fail("Lees eerst de eerdere afkeurrede en controleer de lock.","Review earlier rejection and final lock first.","Vérifiez le motif du refus précédent et le verrouillage.","Früheren Ablehnungsgrund und Sperre prüfen.")
    saved=x.reason
   }else{
    if(value.trim().length<10)return fail("Voer een concrete reden in van minstens 10 tekens.","Enter a specific reason with at least 10 characters.","Saisissez un motif de 10 caractères minimum.","Mindestens 10 Zeichen als Grund eingeben.")
    saved=value.trim();next.reason=saved
   }
  }else if(step.kind==="number"){
   const hours=Number(value),max=index===12?168:24
   if(!Number.isFinite(hours)||hours<=0||hours>max)return fail("Voer een geldig aantal uren in.","Enter valid hours.","Saisissez des heures valides.","Gültige Stundenzahl eingeben.")
   if(index===5&&!next.reason)return fail("Eerst een correctiereden opgeven.","Provide a correction reason first.","Indiquez d’abord le motif.","Zuerst Korrekturgrund eingeben.")
   if(index===12&&hours<=next.daily)return fail("Weekdrempel moet boven dagdrempel liggen.","Weekly threshold must exceed daily.","Seuil hebdomadaire supérieur au journalier.","Wochenschwelle muss höher sein.")
   saved=String(hours)
   if(index===5)next.hours=hours
   if(index===11)next.daily=hours
   if(index===12)next.weekly=hours
  }else if(step.kind==="toggle"){
   if(beginBreak){
    const flow=JSON.parse(sessionStorage.getItem("uptilldawn-training-workflow-v3")||"{}")
    if(next.breakPhase!=="working"||flow.operationPhase!=="working")return fail("Start je werk vóór de pauze.","Start work before your break.","Commencez le travail avant la pause.","Arbeit vor Pause starten.")
    next.breakPhase="break"
   }else if(endBreak){
    if(next.breakPhase!=="break")return fail("Start eerst je pauze.","Start the break first.","Commencez la pause d'abord.","Starte zuerst die Pause.")
    next.breakPhase="resumed"
   }else return
  }else return
  next.audit.push(id+" · "+saved)
  sessionStorage.setItem(key(trainingRole),JSON.stringify(next));setState(next);setError("")
  if(beginBreak||endBreak)dispatchEvent(new CustomEvent("uptilldawn-training-demo-phase-change",{detail:{phase:beginBreak?"break":"resumed"}}))
  dispatchEvent(new CustomEvent("uptilldawn-training-practical-action",{detail:{role:trainingRole,chapter:"operations",id,kind:step.kind,value:saved}}))
 }
 if(!step||delegated.has(id))return null
 return <section data-training-operational-drill={trainingRole} className="mx-auto my-4 max-w-6xl space-y-3 rounded-2xl border border-violet-500/50 p-4">
  <p className="text-xs font-bold text-violet-500">{t(locale,"INTERACTIEVE WERKUREN · FICTIEVE GEGEVENS","PRACTICAL WORKTIME · FICTIONAL DATA","HEURES PRATIQUES · DONNÉES FICTIVES","PRAKTISCHE ARBEITSZEIT · FIKTIVE DATEN")}</p>
  <article data-demo-worktime-state className="rounded-xl border p-3 text-sm">
   <b>Main Bar · Lina Peeters / Noah Jacobs</b>
   <p>{t(locale,"Pauze","Break","Pause","Pause")}: {state.breakPhase} · {t(locale,"Urenstaat","Timesheet","Feuille","Stundenzettel")}: {state.timesheet||"—"} · {t(locale,"Uurcorrectie","Hours correction","Correction horaire","Stundenkorrektur")}: {state.hours||"—"}</p>
   <p>{t(locale,"Overuren","Overtime","Heures supp.","Überstunden")}: {state.policy||"—"} · {state.daily||"—"}h / {state.weekly||"—"}h</p>
  </article>
  <div data-demo-operations-operation={id} className="space-y-3 rounded-xl border p-3">
   <h3 className="font-black">{step.title[locale]}</h3>
   {step.kind==="inspect"?<>
    <button type="button" data-training-preview-op={id} onClick={()=>setOpened(true)} className="w-full rounded-xl bg-violet-600 p-3 font-bold text-white">{t(locale,"OPEN DETAILS","OPEN DETAILS","OUVRIR LES DÉTAILS","DETAILS ÖFFNEN")}</button>
    {opened&&<p data-demo-operations-detail={id} className="rounded-xl border p-3 text-sm">{info()}</p>}
   </>:step.kind==="select"?<select data-demo-operations-select value={value} onChange={e=>setValue(e.target.value)} className="w-full rounded-xl border bg-background p-3"><option value="">{t(locale,"Kies","Choose","Choisir","Wählen")}</option>{options().map(([v,name])=><option key={v} value={v}>{name}</option>)}</select>
   :step.kind==="number"?<input data-demo-operations-number type="number" min="1" max={index===12?168:24} value={value} onChange={e=>setValue(e.target.value)} className="w-full rounded-xl border bg-background p-3"/>
   :step.kind==="message"&&id!=="operations:admin:8"?<textarea data-demo-operations-message rows={3} value={value} onChange={e=>setValue(e.target.value)} className="w-full rounded-xl border bg-background p-3"/>
   :<p className="text-sm">{step.help[locale]}</p>}
   <button type="button" data-training-practical-op={id} disabled={!ready||(step.kind==="inspect"&&!opened)} onClick={submit} className="w-full rounded-xl bg-violet-600 p-3 font-bold text-white disabled:opacity-40">{step.title[locale]}</button>
   {error&&<p role="alert" className="text-sm text-rose-600">{error}</p>}
  </div>
  <details className="rounded-xl border p-3 text-sm"><summary className="cursor-pointer font-bold">{t(locale,"Controlelog","Audit log","Journal","Prüfprotokoll")}: {state.audit.length}</summary><ol data-demo-operations-audit={state.audit.length} className="mt-2">{state.audit.map((entry,i)=><li key={i}>{entry}</li>)}</ol></details>
 </section>
}
