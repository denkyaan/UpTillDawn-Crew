"use client"
import {useEffect,useMemo,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {getTrainingOperations,type PracticeOperation} from "@/lib/training-exercise-catalog"
import type {TourRole} from "@/lib/tour-training"

type Chapter="driver"|"timesheet"
type Evidence={chapter:Chapter;completed:string[];phase:string;eventMinutes:number;driveMinutes:number;kilometers:number;backstage:boolean;checkin:boolean;reviewed:boolean;reason:string;approved:boolean;rejected:boolean;locked:boolean;submitted:boolean;selection:string;audit:string[]}
const T=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
const initial=(chapter:Chapter):Evidence=>({chapter,completed:[],phase:"planned",eventMinutes:0,driveMinutes:0,kilometers:0,backstage:false,checkin:false,reviewed:false,reason:"",approved:false,rejected:false,locked:false,submitted:false,selection:"",audit:[]})
const store=(role:TourRole,chapter:Chapter)=>"uptilldawn-lifecycle-training-v1:"+role+":"+chapter
const load=(role:TourRole,chapter:Chapter):Evidence=>{
 try{const value=JSON.parse(sessionStorage.getItem(store(role,chapter))||"null") as Evidence|null
  if(value?.chapter===chapter&&Array.isArray(value.completed)&&Array.isArray(value.audit))return value
 }catch{}
 return initial(chapter)
}
export function SandboxLifecycleTraining({role}:{role:string}){
 const trainingRole:TourRole=role==="admin"?"admin":role==="responsible_lead"?"responsible_lead":"employee"
 const [locale,setLocale]=useState<SupportedUiLocale>("nl")
 const [currentId,setCurrentId]=useState("")
 const [data,setData]=useState<Evidence>(initial("timesheet"))
 const [reason,setReason]=useState("")
 const [selection,setSelection]=useState("")
 const [error,setError]=useState("")
 const [hydrated,setHydrated]=useState(false)
 const chapter=currentId.startsWith("driver:")?"driver":currentId.startsWith("timesheet:")?"timesheet":null
 const operations=useMemo(()=>chapter?getTrainingOperations(trainingRole,chapter):[],[trainingRole,chapter])
 const current:PracticeOperation|undefined=operations.find(x=>x.id===currentId)
 const group=current?.id.split(":")[1]
 const idx=current?Number(current.id.split(":").at(-1)):-1
 useEffect(()=>{const apply=()=>setLocale(activeUiLocale());apply();addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 useEffect(()=>{
  const sync=()=>{const id=document.querySelector('[data-training-lab] [data-training-operation]')?.getAttribute("data-training-operation")||"";setCurrentId(old=>old===id?old:id)}
  sync()
  const observer=new MutationObserver(sync)
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["data-training-operation"]})
  return()=>observer.disconnect()
 },[])
 useEffect(()=>{if(!chapter)return;const frame=requestAnimationFrame(()=>{setData(load(trainingRole,chapter));setReason("");setSelection("");setError("");setHydrated(true)});return()=>cancelAnimationFrame(frame)},[chapter,trainingRole])
 const commit=()=>{
  if(!hydrated||!current||!chapter)return
  const next:Evidence={...data,completed:[...data.completed],audit:[...data.audit]}
  let value=current.kind==="inspect"?"reviewed":"confirmed"
  if(current.kind==="select"){
   if(!selection){setError(T(locale,"Kies eerst de urenstaat.","Select a timesheet first.","Sélectionnez d’abord une feuille d’heures.","Wähle zuerst einen Stundenzettel."));return}
   value=selection;next.selection=selection
  }
  if(current.kind==="message"){
   if(reason.trim().length<5){setError(T(locale,"Een concrete reden van minstens vijf tekens is verplicht.","A concrete reason of at least five characters is required.","Un motif concret de cinq caractères minimum est obligatoire.","Ein konkreter Grund mit mindestens fünf Zeichen ist erforderlich."));return}
   value=reason.trim();next.reason=value
  }
  if(chapter==="driver"&&group==="shared"){
   if(idx===4){next.checkin=true;next.phase="checked-in"}
   if(idx===5){
    if(!next.checkin)return
    next.eventMinutes=60;next.phase="event-time"
   }
   if(idx===6){
    if(next.phase!=="event-time")return
    next.phase="driving";next.driveMinutes=20
   }
   if(idx===7){if(next.phase!=="driving")return;next.phase="at-pickup"}
   if(idx===8){if(next.phase!=="at-pickup")return;next.phase="return-driving";next.driveMinutes=40}
   if(idx===9){
    if(next.phase!=="return-driving")return
    next.phase="event-time-resumed";next.kilometers=22.4;next.eventMinutes=90;next.backstage=true
   }
   if(idx===10&&next.kilometers===0)return
   if(idx===11&&!next.backstage)return
  }
  if(chapter==="timesheet"){
   if(group==="shared"&&idx===1)next.reviewed=true
   if(group===trainingRole){
    if(trainingRole==="admin"){
     if(idx===2){next.approved=true;next.selection="lina"}
     if(idx===4){if(next.reason.length<5)return;next.rejected=true}
     if(idx===5){if(!next.approved||!next.rejected)return;next.locked=true}
    }else{
     if(idx===0)next.phase="stopped"
     if(idx===1){if(next.phase!=="stopped")return;next.reviewed=true}
     if(idx===3){if(next.phase!=="stopped"||!next.reviewed||next.reason.length<5)return;next.submitted=true}
    }
   }
  }
  next.completed=[...new Set([...next.completed,current.id])]
  next.audit.push(current.id+" · "+value)
  sessionStorage.setItem(store(trainingRole,chapter),JSON.stringify(next))
  setData(next);setReason("");setSelection("");setError("")
  dispatchEvent(new CustomEvent("uptilldawn-training-practical-action",{detail:{role:trainingRole,chapter,id:current.id,kind:current.kind,value}}))
 }
 if(!chapter||!current)return null
 const selected=chapter==="timesheet"&&trainingRole==="admin"
 const title=chapter==="driver"
   ?T(locale,"Driver · artiestenvervoer","Driver · artist transfer","Chauffeur · transport d’artiste","Fahrer · Künstlertransfer")
   :T(locale,"Werkuren & urenstaat","Work hours & timesheet","Heures & feuille de temps","Arbeitszeit & Stundenzettel")
 return <section data-training-lifecycle={chapter} className="mx-auto my-5 max-w-6xl space-y-4 rounded-2xl border border-violet-500/50 p-4">
  <header><p className="text-xs font-bold uppercase text-violet-500">{T(locale,"PRAKTIJKDEMO · FICTIEVE GEGEVENS","PRACTICAL DEMO · FICTIONAL RECORDS","DÉMO PRATIQUE · DONNÉES FICTIVES","PRAXISDEMO · FIKTIVE DATEN")}</p>
   <h2 className="text-xl font-black">{title}</h2>
   <p className="text-sm text-muted-foreground">{T(locale,"Elke stap wijzigt uitsluitend het demonstratieregister in je browsersessie.","Every step changes only the demo ledger in your browser session.","Chaque étape modifie uniquement le registre de démonstration de cette session.","Jeder Schritt ändert nur das Demoprotokoll dieser Browsersitzung.")}</p>
  </header>
  {chapter==="driver"&&<div className="grid gap-3 sm:grid-cols-2">
   <article className="rounded-xl border p-3"><h3 className="font-bold">{T(locale,"Toegewezen rit","Assigned trip","Trajet attribué","Zugewiesene Fahrt")}</h3>
    <p>{T(locale,"DJ Nova · Station Leuven → UpTillDawn Training Night","DJ Nova · Leuven Station → UpTillDawn Training Night","DJ Nova · Gare de Louvain → Soirée UpTillDawn","DJ Nova · Bahnhof Leuven → UpTillDawn Trainingsabend")}</p>
    <p className="text-sm">{T(locale,"Ophalen 21:35 · herinnering 21:20 · fictief telefoonnummer +32 000 000 000","Pickup 21:35 · reminder 21:20 · fictional phone +32 000 000 000","Enlèvement 21:35 · rappel 21:20 · téléphone fictif +32 000 000 000","Abholung 21:35 · Erinnerung 21:20 · fiktive Nummer +32 000 000 000")}</p></article>
   <article className="rounded-xl border p-3"><h3 className="font-bold">{T(locale,"Gesimuleerde klokken","Simulated clocks","Chronomètres simulés","Simulierte Uhren")}</h3>
    <p>{T(locale,"Eventuren","Event time","Temps événement","Eventzeit")}: {data.eventMinutes} {T(locale,"min","min","min","Min.")} · {T(locale,"Rijtijd","Driving time","Temps de conduite","Fahrzeit")}: {data.driveMinutes} {T(locale,"min","min","min","Min.")}</p>
    <p>{T(locale,"Kilometers heen en terug (fictief)","Round-trip kilometres (fictional)","Kilomètres aller-retour (fictifs)","Hin- und Rückfahrtkilometer (fiktiv)")}: {data.kilometers} {T(locale,"km","km","km","km")}</p>
    <p>{data.phase==="driving"||data.phase==="return-driving"?T(locale,"Eventtimer gepauzeerd","Event timer paused","Chronomètre événement suspendu","Eventzeit pausiert"):T(locale,"Eventtimer niet gepauzeerd","Event timer not paused","Chronomètre événement non suspendu","Eventzeit nicht pausiert")}</p></article>
   {data.backstage&&<p data-demo-driver-backstage className="rounded-xl border p-3 text-sm sm:col-span-2">{T(locale,"Backstage Management: DJ Nova aangekomen op het evenement (simulatie).","Backstage Management: DJ Nova has arrived at the event (simulation).","Backstage Management : DJ Nova est arrivé à l’événement (simulation).","Backstage Management: DJ Nova ist beim Event angekommen (Simulation).")}</p>}
  </div>}
  {chapter==="timesheet"&&<div className="space-y-2 rounded-xl border p-3" data-demo-timesheet>
   <h3 className="font-bold">{T(locale,"Fictieve urenstaten","Fictional timesheets","Feuilles d’heures fictives","Fiktive Stundenzettel")}</h3>
   <div className="grid gap-2 sm:grid-cols-2">
    <article className="rounded-lg border p-3"><p className="font-bold">{T(locale,"Lina Peeters · Bar / Toog","Lina Peeters · Bar / Counter","Lina Peeters · Bar / Comptoir","Lina Peeters · Bar / Theke")}</p><p>20:00 → 04:00 · {T(locale,"pauze","break","pause","Pause")} 01:00 · {T(locale,"netto","net","net","Netto")} 07:00</p><p>{data.approved?T(locale,"Goedgekeurd","Approved","Approuvé","Genehmigt"):T(locale,"Ingediend","Submitted","Soumis","Eingereicht")} · {data.locked?T(locale,"Vergrendeld","Locked","Verrouillé","Gesperrt"):T(locale,"Open","Open","Ouvert","Offen")}</p></article>
    <article className="rounded-lg border p-3"><p className="font-bold">{T(locale,"Mila Vermeulen · Merch","Mila Vermeulen · Merch","Mila Vermeulen · Merch","Mila Vermeulen · Merch")}</p><p>19:00 → 03:00 · {T(locale,"pauze","break","pause","Pause")} 01:00 · {T(locale,"netto","net","net","Netto")} 07:00</p><p>{data.rejected?T(locale,"Afgewezen met reden","Rejected with reason","Refusé avec motif","Mit Begründung abgelehnt"):T(locale,"Ingediend","Submitted","Soumis","Eingereicht")}</p></article>
   </div>
   <p className="text-sm">{T(locale,"Overuren zijn exclusief pauzes; correcties en goedkeuringen worden gelogd.","Overtime excludes breaks; corrections and approvals are logged.","Les heures supplémentaires excluent les pauses ; les corrections et validations sont tracées.","Überstunden schließen Pausen aus; Korrekturen und Genehmigungen werden protokolliert.")}</p>
   {data.submitted&&<p data-demo-timesheet-submitted className="font-bold">{T(locale,"Urenstaat ingediend","Timesheet submitted","Feuille soumise","Stundenzettel eingereicht")}</p>}
  </div>}
  <article className="space-y-3 rounded-xl border border-violet-500 p-3" data-demo-lifecycle-operation={current.id}>
   <h3 className="font-bold">{current.title[locale]}</h3>
   {current.kind==="message"&&<label className="grid gap-2 text-sm font-semibold">{T(locale,"Motivering of correctieverzoek","Reason or correction request","Motif ou demande de correction","Grund oder Korrekturanfrage")}
     <textarea data-demo-lifecycle-reason value={reason} onChange={event=>setReason(event.target.value)} rows={3} className="rounded-lg border bg-background p-3" placeholder={T(locale,"Beschrijf waarom deze correctie nodig is.","Explain why this correction is needed.","Expliquez pourquoi cette correction est nécessaire.","Erkläre warum diese Korrektur nötig ist.")}/></label>}
   {current.kind==="select"&&<label className="grid gap-2 text-sm font-semibold">{T(locale,"Kies fictieve urenstaat","Choose fictional timesheet","Choisissez la feuille fictive","Fiktiven Stundenzettel wählen")}
     <select data-demo-lifecycle-select value={selection} onChange={event=>setSelection(event.target.value)} className="rounded-lg border bg-background p-3">
      <option value="">{T(locale,"Kies","Choose","Choisir","Wählen")}</option>
      <option value="lina">{T(locale,"Lina Peeters · Bar / Toog","Lina Peeters · Bar / Counter","Lina Peeters · Bar / Comptoir","Lina Peeters · Bar / Theke")}</option><option value="mila">{T(locale,"Mila Vermeulen · Merch","Mila Vermeulen · Merch","Mila Vermeulen · Merch","Mila Vermeulen · Merch")}</option>
     </select></label>}
   {selected&&data.rejected&&<p className="text-sm">{T(locale,"Afkeurreden","Rejection reason","Motif du refus","Ablehnungsgrund")}: {data.reason}</p>}
   <button type="button" data-training-practical-op={current.id} disabled={!hydrated||data.chapter!==chapter} onClick={commit} className="w-full rounded-xl bg-violet-600 px-4 py-3 font-black text-white disabled:opacity-40">{current.title[locale]}</button>
   {error&&<p role="alert" className="text-sm text-rose-500">{error}</p>}
  </article>
  <details className="rounded-xl border p-3"><summary className="cursor-pointer font-bold">{T(locale,"Controlelog","Audit trail","Journal d’audit","Prüfprotokoll")} · {data.audit.length}</summary>
   <ol data-demo-lifecycle-audit-count={data.audit.length} className="mt-2 space-y-2 text-sm">{data.audit.map((entry,i)=><li key={i}>{entry}</li>)}</ol></details>
 </section>
}
