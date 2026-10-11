"use client"

import {useEffect,useMemo,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {getTrainingOperations} from "@/lib/training-exercise-catalog"
import type {TourRole} from "@/lib/tour-training"

type Evidence={audit:string[];category:string;urgency:string;description:string;gpsReviewed:boolean;sent:boolean;status:"draft"|"open"|"escalated"|"closed";assignee:string;response:string;escalation:string;updates:string[]}
const empty=():Evidence=>({audit:[],category:"",urgency:"",description:"",gpsReviewed:false,sent:false,status:"draft",assignee:"",response:"",escalation:"",updates:[]})
const localeCopy=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
const evidenceKey=(role:TourRole)=>"uptilldawn-incident-training-v1:"+role
const read=(role:TourRole)=>{try{const state=JSON.parse(sessionStorage.getItem(evidenceKey(role))||"null") as Evidence|null;if(state&&Array.isArray(state.audit)&&Array.isArray(state.updates))return state}catch{}return empty()}
export function SandboxIncidentTraining({role}:{role:string}){
 const trainingRole:TourRole=role==="admin"?"admin":role==="responsible_lead"?"responsible_lead":"employee"
 const [l,setL]=useState<SupportedUiLocale>("nl")
 const [currentId,setCurrentId]=useState("")
 const [state,setState]=useState<Evidence>(empty)
 const [selected,setSelected]=useState("")
 const [message,setMessage]=useState("")
 const [err,setErr]=useState("")
 const [ready,setReady]=useState(false)
 const actions=useMemo(()=>getTrainingOperations(trainingRole,"incidents"),[trainingRole])
 const current=actions.find(a=>a.id===currentId)
 const group=current?.id.split(":")[1]
 const index=current?Number(current.id.split(":").at(-1)):-1
 useEffect(()=>{const update=()=>setL(activeUiLocale());update();addEventListener(LANGUAGE_APPLIED_EVENT,update);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,update)},[])
 useEffect(()=>{const f=requestAnimationFrame(()=>{setState(read(trainingRole));setReady(true)});return()=>cancelAnimationFrame(f)},[trainingRole])
 useEffect(()=>{
  const sync=()=>{const value=document.querySelector('[data-training-lab] [data-training-operation]')?.getAttribute("data-training-operation")||"";setCurrentId(old=>old===value?old:value)}
  sync();const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["data-training-operation"]});return()=>observer.disconnect()
 },[])
 const fail=()=>setErr(localeCopy(l,"Vul eerst de vereiste gegevens in en volg de juiste volgorde.","Complete the required fields in the correct order.","Complétez les champs obligatoires dans le bon ordre.","Fülle zuerst die Pflichtfelder in der richtigen Reihenfolge aus."))
 const record=()=>{
  if(!ready||!current)return
  const next:Evidence={...state,audit:[...state.audit],updates:[...state.updates]}
  let value="reviewed"
  if(current.kind==="select"){
   if(!selected)return fail()
   value=selected
   if(group==="shared"&&index===1)next.category=selected
   if(group==="shared"&&index===3)next.urgency=selected
   if(group==="admin"&&index===1)next.assignee=selected
   if(group==="responsible_lead"&&index===2){next.escalation=selected;next.status="escalated"}
  }else if(current.kind==="message"){
   if(message.trim().length<8)return fail()
   value=message.trim()
   if(group==="shared"&&index===2)next.description=value
   if(group!=="shared"){next.response=value;next.updates.push(value)}
  }else if(current.kind==="toggle"){
   value="confirmed"
   if(group==="shared"&&index===5){
    if(!next.category||!next.urgency||!next.description||!next.gpsReviewed)return fail()
    next.sent=true;next.status="open"
   }
   if(group==="admin"&&index===3){
    if(!next.sent||!next.assignee||!next.response)return fail()
    next.status="closed"
   }
   if(group==="responsible_lead"&&index===3){
    if(!next.sent||!next.response||!next.escalation)return fail()
    next.status="closed"
   }
  }else if(current.kind==="inspect"){
   if(group==="shared"&&index===4)next.gpsReviewed=true
   if(group==="shared"&&index>=6&&!next.sent)return fail()
   if(group!=="shared"&&!next.sent)return fail()
  }else return
  next.audit.push(current.id+" · "+value)
  sessionStorage.setItem(evidenceKey(trainingRole),JSON.stringify(next));setState(next);setSelected("");setMessage("");setErr("")
  dispatchEvent(new CustomEvent("uptilldawn-training-practical-action",{detail:{role:trainingRole,chapter:"incidents",id:current.id,kind:current.kind,value}}))
 }
 const opts=():{id:string;name:string}[]=>{
  if(group==="shared"&&index===1)return [{id:"technical",name:localeCopy(l,"Technisch defect","Technical failure","Défaut technique","Technischer Defekt")},{id:"safety",name:localeCopy(l,"Veiligheidsincident","Safety incident","Incident de sécurité","Sicherheitsvorfall")}]
  if(group==="shared"&&index===3)return [{id:"urgent",name:localeCopy(l,"Urgent","Urgent","Urgent","Dringend")},{id:"normal",name:localeCopy(l,"Normaal","Normal","Normal","Normal")}]
  if(group==="admin"&&index===1)return [{id:"lina",name:"Lina Peeters"},{id:"noah",name:"Noah Jacobs"}]
  if(group==="responsible_lead"&&index===2)return [{id:"admin",name:"Admin"}]
  return []
 }
 if(!current)return null
 return <main data-tour-demo="training-screen" data-training-incident="true" className="mx-auto max-w-6xl space-y-5 p-4 pb-28 md:p-8">
  <header className="space-y-1"><p className="text-xs font-black uppercase text-violet-500">{localeCopy(l,"HELP · FICTIEVE INCIDENTTRAINING","HELP · FICTIONAL INCIDENT TRAINING","AIDE · FORMATION INCIDENTS FICTIFS","HILFE · FIKTIVES VORFALLTRAINING")}</p><h1 className="text-2xl font-black">{localeCopy(l,"Meldingen en incidentopvolging","Reports and incident management","Signalements et gestion des incidents","Meldungen und Vorfallverwaltung")}</h1><p className="text-sm text-muted-foreground">{localeCopy(l,"Meldingen gaan enkel naar het trainingslog en niet naar echte verantwoordelijken.","Reports only enter the training ledger, never real staff inboxes.","Les signalements restent uniquement dans le journal démo.","Meldungen gehen nur ins Trainingsprotokoll, nie an echtes Personal.")}</p></header>
  <div className="grid gap-3 sm:grid-cols-2">
   <article className="space-y-1 rounded-xl border p-4"><h2 className="font-bold">{localeCopy(l,"Fictieve melding","Fictional report","Signalement fictif","Fiktive Meldung")}</h2><p>{localeCopy(l,"Kassaterminal reageert niet · Main Bar","Till terminal unresponsive · Main Bar","Terminal de caisse en panne · Main Bar","Kassenterminal reagiert nicht · Main Bar")}</p><p className="text-sm">{localeCopy(l,"Categorie","Category","Catégorie","Kategorie")}: {state.category||"—"} · {localeCopy(l,"Urgentie","Urgency","Urgence","Dringlichkeit")}: {state.urgency||"—"}</p><p className="text-sm">{localeCopy(l,"Status","Status","Statut","Status")}: <strong data-demo-incident-status>{state.status}</strong></p></article>
   <article className="space-y-1 rounded-xl border p-4"><h2 className="font-bold">{localeCopy(l,"Veiligheid en locatie","Safety and location","Sécurité et localisation","Sicherheit und Standort")}</h2><p className="text-sm">{localeCopy(l,"Fictieve locatie: Leuven · GPS 50.879, 4.701 · radius 100 m","Fictional location: Leuven · GPS 50.879, 4.701 · 100 m radius","Lieu fictif : Louvain · GPS 50.879, 4.701 · rayon de 100 m","Fiktiver Standort: Leuven · GPS 50.879, 4.701 · 100-m-Radius")}</p><p>{state.gpsReviewed?localeCopy(l,"GPS gecontroleerd","GPS reviewed","GPS vérifié","GPS geprüft"):localeCopy(l,"GPS nog niet gecontroleerd","GPS not yet reviewed","GPS non vérifié","GPS noch nicht geprüft")}</p><p className="text-sm">{localeCopy(l,"Toegewezen aan","Assigned to","Attribué à","Zugewiesen an")}: {state.assignee||"—"}</p></article>
  </div>
  {state.sent&&<section className="rounded-xl border p-4"><h2 className="font-bold">{localeCopy(l,"Training-inbox en statusgeschiedenis","Training inbox and status history","Boîte et historique démo","Demo-Posteingang und Statusverlauf")}</h2><p className="text-sm">{state.description}</p><p className="text-sm">{localeCopy(l,"Admin ziet urgente meldingen; een verantwoordelijke ziet enkel de eigen post.","Admin sees urgent reports; a lead sees only their workplace.","L’admin voit les urgences ; le responsable ne voit que son poste.","Admin sieht dringende Meldungen; Verantwortliche nur den eigenen Arbeitsplatz.")}</p>{state.updates.map((x,i)=><p key={i} className="border-t pt-2 text-sm">{x}</p>)}</section>}
  {current&&<section data-demo-incident-operation={current.id} className="space-y-3 rounded-xl border border-violet-500/50 p-4"><h2 className="font-black">{current.title[l]}</h2><p className="text-sm">{current.help[l]}</p>
   {current.kind==="select"&&<label className="grid gap-2 text-sm font-bold">{localeCopy(l,"Kies","Choose","Choisir","Wählen")}<select data-demo-incident-select value={selected} onChange={e=>setSelected(e.target.value)} className="rounded-lg border bg-background p-3"><option value="">{localeCopy(l,"Maak een keuze","Choose an option","Choisir une option","Option wählen")}</option>{opts().map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select></label>}
   {current.kind==="message"&&<label className="grid gap-2 text-sm font-bold">{localeCopy(l,"Beschrijving of antwoord","Description or reply","Description ou réponse","Beschreibung oder Antwort")}<textarea data-demo-incident-message value={message} onChange={e=>setMessage(e.target.value)} rows={3} className="rounded-lg border bg-background p-3" placeholder={localeCopy(l,"Kassaterminal gecontroleerd. Back-upkassa geopend.","Till terminal checked. Backup till activated.","Terminal contrôlé. Caisse de secours activée.","Terminal geprüft. Ersatzkasse aktiviert.")}/></label>}
   <button type="button" data-training-practical-op={current.id} disabled={!ready} onClick={record} className="w-full rounded-xl bg-violet-600 p-3 font-black text-white disabled:opacity-40">{current.title[l]}</button>{err&&<p role="alert" className="text-sm text-red-500">{err}</p>}
  </section>}
  <details className="rounded-xl border p-3"><summary className="cursor-pointer font-bold">{localeCopy(l,"Controlelog","Audit trail","Journal d’audit","Prüfprotokoll")} · {state.audit.length}</summary><ol data-demo-incident-audit-count={state.audit.length} className="mt-2 space-y-1 text-sm">{state.audit.map((x,i)=><li key={i}>{x}</li>)}</ol></details>
 </main>
}
