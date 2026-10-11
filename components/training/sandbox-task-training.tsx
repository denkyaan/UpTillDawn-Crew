"use client"
import {useEffect,useMemo,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {getTrainingOperations,type PracticeOperation} from "@/lib/training-exercise-catalog"
import type {TourRole} from "@/lib/tour-training"

type TaskRecord={title:string;description:string;workplace:string;assignees:string[];deadline:string;priority:string;status:string;comments:string[];secondaryStatus:string}
type Ledger={completed:string[];task:TaskRecord;audit:string[]}
const initial=():Ledger=>({completed:[],task:{title:"Bar aanvullen",description:"Vul water, frisdrank en bekers aan en meld tekorten.",workplace:"bar",assignees:["lina"],deadline:"2026-10-11T01:30",priority:"normal",status:"assigned",comments:[],secondaryStatus:"assigned"},audit:[]})
const T=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
const storage=(role:TourRole)=>"uptilldawn-task-training-v1:"+role
const retrieve=(role:TourRole)=>{try{const x=JSON.parse(sessionStorage.getItem(storage(role))||"null") as Ledger|null;if(x&&Array.isArray(x.audit)&&Array.isArray(x.completed)&&x.task?.title)return x}catch{}return initial()}
export function SandboxTaskTraining({role}:{role:string}){
 const trainingRole:TourRole=role==="admin"?"admin":role==="responsible_lead"?"responsible_lead":"employee"
 const [l,setL]=useState<SupportedUiLocale>("nl")
 const [currentId,setCurrentId]=useState("")
 const [data,setData]=useState<Ledger>(initial)
 const [opened,setOpened]=useState(false)
 const [input,setInput]=useState("")
 const [selected,setSelected]=useState("")
 const [date,setDate]=useState("")
 const [error,setError]=useState("")
 const [ready,setReady]=useState(false)
 const steps=useMemo(()=>getTrainingOperations(trainingRole,"tasks"),[trainingRole])
 const current:PracticeOperation|undefined=steps.find(step=>step.id===currentId)
 const group=current?.id.split(":")[1]
 const index=current?Number(current.id.split(":").at(-1)):-1
 useEffect(()=>{const apply=()=>setL(activeUiLocale());apply();addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 useEffect(()=>{const raf=requestAnimationFrame(()=>{setData(retrieve(trainingRole));setReady(true)});return()=>cancelAnimationFrame(raf)},[trainingRole])
 useEffect(()=>{
  const sync=()=>{const id=document.querySelector('[data-training-lab] [data-training-operation]')?.getAttribute("data-training-operation")||"";setCurrentId(v=>v===id?v:id)}
  sync();const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["data-training-operation"]});return()=>observer.disconnect()
 },[])
 useEffect(()=>{const raf=requestAnimationFrame(()=>{setOpened(false);setInput("");setSelected("");setDate("");setError("")});return()=>cancelAnimationFrame(raf)},[currentId])
 const options=()=>{
  if(group==="admin"&&index===2)return [["bar","Bar / Toog","Bar / Counter","Bar / Comptoir","Bar / Theke"],["tokens","Tokens","Tokens","Jetons","Tokens"],["merch","Merch","Merch","Merch","Merch"]]
  if((group==="admin"&&index===3)||(group==="responsible_lead"&&index===2))return [["lina","Lina Peeters","Lina Peeters","Lina Peeters","Lina Peeters"],["noah","Noah Jacobs","Noah Jacobs","Noah Jacobs","Noah Jacobs"],["mila","Mila Vermeulen","Mila Vermeulen","Mila Vermeulen","Mila Vermeulen"]]
  if(group==="responsible_lead"&&index===3)return [["low","Laag","Low","Faible","Niedrig"],["normal","Normaal","Normal","Normal","Normal"],["urgent","Dringend","Urgent","Urgent","Dringend"]]
  return [["assigned","Toegewezen","Assigned","Attribué","Zugewiesen"],["in_progress","Bezig","In progress","En cours","In Arbeit"],["completed","Voltooid","Completed","Terminé","Erledigt"]]
 }
 const details=()=>{
  if(group==="shared"){
   if(index===0||index===1)return <><p>{data.task.description}</p><p>{T(l,"Deadline","Deadline","Échéance","Frist")}: {data.task.deadline}</p></>
   if(index===2)return <p>{T(l,"Toegewezen medewerkers","Assigned staff","Personnel affecté","Zugewiesenes Personal")}: {data.task.assignees.join(", ")}</p>
   if(index===5)return <p>{T(l,"Vóór de toegewezen shift is de taak alleen zichtbaar; wijzigen en bevestigen vereisen actieve dienst.","Before the assigned shift, the task is read-only; changing and confirming require an active shift.","Avant le shift attribué, la tâche est en lecture seule ; modifier nécessite un shift actif.","Vor der zugewiesenen Schicht ist die Aufgabe schreibgeschützt; Änderungen erfordern eine aktive Schicht.")}</p>
   return <p>{T(l,"Na afmelding wordt de taak aan de verantwoordelijke toegewezen voor vervanging.","After an absence, the task is escalated to the lead for reassignment.","Après une absence, la tâche est transférée au responsable pour réaffectation.","Nach einer Abmeldung wird die Aufgabe dem Verantwortlichen zur Neuzuweisung gemeldet.")}</p>
  }
  return <p>{T(l,"Controleer alle opgeslagen taakvelden en de actuele status.","Review saved task fields and current status.","Vérifiez les champs enregistrés et le statut actuel.","Prüfe die gespeicherten Aufgabenfelder und den aktuellen Status.")}</p>
 }
 const submit=()=>{
  if(!current||!ready)return
  const task:TaskRecord={...data.task,assignees:[...data.task.assignees],comments:[...data.task.comments]}
  let value=current.kind==="inspect"?"reviewed":"confirmed"
  const fail=(msg:string)=>setError(msg)
  if(current.kind==="inspect"&&!opened)return
  if(current.kind==="form"){
   if(input.trim().length<5)return fail(T(l,"Vul minimaal vijf tekens in.","Enter at least five characters.","Saisissez au moins cinq caractères.","Mindestens fünf Zeichen eingeben."))
   task.title=input.trim();value=task.title+" · "+task.workplace
  }else if(current.kind==="write"){
   if(input.trim().length<10)return fail(T(l,"Beschrijf de taak in minstens tien tekens.","Describe the task in at least ten characters.","Décrivez la tâche en dix caractères minimum.","Beschreibe die Aufgabe mit mindestens zehn Zeichen."))
   task.description=input.trim();value=task.description
  }else if(current.kind==="message"){
   if(input.trim().length<5)return fail(T(l,"Schrijf een concrete opmerking of probleemmelding.","Enter a specific comment or issue.","Saisissez un commentaire ou un problème concret.","Schreibe einen konkreten Kommentar oder ein Problem."))
   task.comments.push(input.trim());value=input.trim()
  }else if(current.kind==="select"){
   if(!selected)return fail(T(l,"Maak een geldige keuze.","Select an option.","Choisissez une option.","Wähle eine Option."))
   value=selected
   if(group==="admin"&&index===2)task.workplace=selected
   else if((group==="admin"&&index===3)||(group==="responsible_lead"&&index===2))task.assignees=[...new Set([...task.assignees,selected])]
   else if(group==="responsible_lead"&&index===3)task.priority=selected
   else task.status=selected
  }else if(current.kind==="schedule"){
   if(!date)return fail(T(l,"Selecteer een deadline.","Select a deadline.","Choisissez une échéance.","Wähle eine Frist."))
   task.deadline=date;value=date
  }else if(current.kind==="toggle"){
   if(group==="shared"&&index===4)task.status="completed"
   if(group==="employee"&&index===0)task.secondaryStatus="in_progress"
  }
  const next:Ledger={task,completed:[...new Set([...data.completed,currentId])],audit:[...data.audit,currentId+" · "+value]}
  sessionStorage.setItem(storage(trainingRole),JSON.stringify(next));setData(next);setError("")
  dispatchEvent(new CustomEvent("uptilldawn-training-practical-action",{detail:{role:trainingRole,chapter:"tasks",id:currentId,kind:current.kind,value}}))
 }
 if(!current)return <main data-tour-demo="training-screen" className="p-6">{T(l,"Taken","Tasks","Tâches","Aufgaben")}</main>
 return <main data-tour-demo="training-screen" data-training-task={trainingRole} className="mx-auto max-w-6xl space-y-4 p-4 pb-28 md:p-8">
  <header><p className="text-xs font-black text-violet-500">{T(l,"GEÏSOLEERDE TRAINING · TAKEN","ISOLATED TRAINING · TASKS","FORMATION ISOLÉE · TÂCHES","ISOLIERTES TRAINING · AUFGABEN")}</p><h1 className="text-2xl font-black">{T(l,"Takenbeheer","Task management","Gestion des tâches","Aufgabenverwaltung")}</h1></header>
  <article className="space-y-2 rounded-xl border p-4" data-demo-task-state={data.task.status}><h2 className="font-bold">{data.task.title}</h2><p>{data.task.description}</p><p className="text-sm">{T(l,"Werkplek","Workplace","Poste","Arbeitsplatz")}: {data.task.workplace} · {T(l,"Deadline","Deadline","Échéance","Frist")}: {data.task.deadline}</p><p className="text-sm">{T(l,"Toegewezen","Assigned","Attribué","Zugewiesen")}: {data.task.assignees.join(", ")} · {T(l,"Prioriteit","Priority","Priorité","Priorität")}: {data.task.priority} · {T(l,"Status","Status","Statut","Status")}: {data.task.status}</p><p>{T(l,"Opmerkingen","Comments","Commentaires","Kommentare")}: {data.task.comments.length}</p></article>
  <section data-demo-task-operation={currentId} className="space-y-3 rounded-xl border border-violet-500/50 p-4">
   <h2 className="font-bold">{current.title[l]}</h2>
   {current.kind==="inspect"?<><button type="button" data-training-preview-op={currentId} onClick={()=>setOpened(true)} className="w-full rounded-xl bg-violet-600 p-3 font-bold text-white">{T(l,"OPEN TAAKDETAILS","OPEN TASK DETAILS","OUVRIR LES DÉTAILS","AUFGABENDETAILS ÖFFNEN")}</button>{opened&&<div data-demo-task-detail={currentId} className="rounded-lg border p-3 text-sm">{details()}</div>}</>
    :current.kind==="form"||current.kind==="write"||current.kind==="message"?<label className="grid gap-2 text-sm font-semibold">{current.title[l]}<textarea data-demo-task-input rows={3} value={input} onChange={e=>setInput(e.target.value)} className="rounded-lg border bg-background p-3" placeholder={T(l,"Fictieve taakinhoud","Fictional task content","Contenu fictif","Fiktiver Aufgabeninhalt")}/></label>
    :current.kind==="select"?<label className="grid gap-2 text-sm font-semibold">{current.title[l]}<select data-demo-task-select value={selected} onChange={e=>setSelected(e.target.value)} className="rounded-lg border bg-background p-3"><option value="">{T(l,"Maak een keuze","Choose an option","Choisir","Wählen")}</option>{options().map(([value,nl,en,fr,de])=><option value={value} key={value}>{l==="nl"?nl:l==="en"?en:l==="fr"?fr:de}</option>)}</select></label>
    :current.kind==="schedule"?<label className="grid gap-2 text-sm font-semibold">{current.title[l]}<input data-demo-task-date type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} className="rounded-lg border bg-background p-3"/></label>
    :<p className="text-sm">{current.help[l]}</p>}
   <button type="button" data-training-practical-op={currentId} disabled={!ready||(current.kind==="inspect"&&!opened)} onClick={submit} className="w-full rounded-xl bg-violet-600 p-3 font-bold text-white disabled:opacity-40">{current.title[l]}</button>
   {error&&<p role="alert" className="text-sm text-rose-500">{error}</p>}
  </section>
  <details className="rounded-xl border p-3"><summary className="cursor-pointer font-bold">{T(l,"Controlelog","Audit trail","Journal d’audit","Prüfprotokoll")} · {data.audit.length}</summary><ol data-demo-task-audit-count={data.audit.length} className="mt-2 space-y-1 text-sm">{data.audit.map((row,i)=><li key={i}>{row}</li>)}</ol></details>
 </main>
}
