"use client"
import {useEffect,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {loadOwnedTrainingScenario,loadParticipantTrainingScenario} from "@/lib/training/scenario-sync"
const KEY="uptilldawn-training-workflow-v3"
type Item={title:string;description:string;workplace:string;start?:string;end?:string;phone?:string;address?:string}
type State={adminEventDraft?:{name:string;venue:string};admin_workplaces?:Item[];admin_briefings?:Item[];admin_tasks?:Item[];admin_inventory?:Item[];admin_guestlist?:Item[];admin_drivers?:Item[];trainingTaskDone?:string[];trainingBriefingDone?:string[]}
const tr=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
export function SandboxSharedRecords({kind}:{kind:"workplaces"|"briefings"|"tasks"|"inventory"|"guestlist"|"drivers"}){
 const [locale,setLocale]=useState<SupportedUiLocale>("nl")
 const [state,setState]=useState<State>({})
 const [opened,setOpened]=useState<string[]>([])
 useEffect(()=>{const apply=()=>setLocale(activeUiLocale());apply();addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 useEffect(()=>{const frame=requestAnimationFrame(()=>{try{const saved=JSON.parse(sessionStorage.getItem(KEY)||"{}") as State;setState(saved)}catch{}});return()=>cancelAnimationFrame(frame)},[])
 useEffect(()=>{let active=true;Promise.all([loadOwnedTrainingScenario(),loadParticipantTrainingScenario()]).then(([owned,shared])=>{const payload=owned||shared;if(!active||!payload)return;const local=JSON.parse(sessionStorage.getItem(KEY)||"{}");const merged={...payload,...local};sessionStorage.setItem(KEY,JSON.stringify(merged));setState(merged as State)}).catch(()=>{});return()=>{active=false}},[])
 const records=state[("admin_"+kind) as "admin_workplaces"|"admin_briefings"|"admin_tasks"|"admin_inventory"|"admin_guestlist"|"admin_drivers"]||[]
 const doneKey=kind==="briefings"?"trainingBriefingDone":"trainingTaskDone"
 const done=state[doneKey]||[]
 const mark=(title:string)=>{const next={...state,[doneKey]:[...done,title]};setState(next);sessionStorage.setItem(KEY,JSON.stringify(next))}
 return <main data-tour-demo="training-screen" className="space-y-4 p-4 pb-24">
  <p className="text-xs font-bold text-violet-500">{tr(locale,"TRAINING IN DEZE BROWSERSESSIE","TRAINING IN THIS BROWSER SESSION","FORMATION DANS CETTE SESSION","TRAINING IN DIESER BROWSER-SITZUNG")}</p>
  <h1 className="text-2xl font-black">{kind==="workplaces"?tr(locale,"Mijn werkplekken en shifts","My workplaces and shifts","Mes postes et shifts","Meine Arbeitsplätze und Schichten"):kind==="briefings"?tr(locale,"Briefings lezen","Read briefings","Lire les briefings","Briefings lesen"):kind==="inventory"?tr(locale,"Inventaris","Inventory","Inventaire","Inventar"):kind==="guestlist"?tr(locale,"Gastenlijst","Guest list","Liste des invités","Gästeliste"):kind==="drivers"?tr(locale,"Driver-opdrachten","Driver assignments","Missions chauffeur","Fahreraufträge"):tr(locale,"Mijn taken","My tasks","Mes tâches","Meine Aufgaben")}</h1>
  <p className="text-sm">{state.adminEventDraft?.name||tr(locale,"Nog geen demo-evenement aangemaakt","No demo event created yet","Aucun événement démo créé","Noch kein Demo-Event erstellt")}</p>
  {records.length===0?<p className="rounded-xl border p-4 text-sm">{tr(locale,"De Admin moet deze gegevens eerst zelf aanmaken in de demo.","The Admin must create these records in the demo first.","L’Admin doit d’abord créer ces données dans la démo.","Der Admin muss diese Daten zuerst in der Demo erstellen.")}</p>:records.map((item,i)=><article key={i} className="space-y-2 rounded-xl border p-4"><h2 className="font-bold">{item.title}</h2><p className="text-xs text-muted-foreground">{item.address||item.workplace} {item.phone||""} {item.start&&item.end?`· ${item.start}–${item.end}`:""}</p>
   {kind==="briefings"&&!opened.includes(item.title)?<button data-tour-demo="primary-action" type="button" onClick={()=>setOpened(old=>[...old,item.title])} className="rounded-lg border border-violet-500 px-3 py-2 font-bold">{tr(locale,"OPEN BRIEFING","OPEN BRIEFING","OUVRIR LE BRIEFING","BRIEFING ÖFFNEN")}</button>:<p className="whitespace-pre-wrap text-sm">{item.description}</p>}
   {(kind==="tasks"||kind==="briefings")&&(kind!=="briefings"||opened.includes(item.title))&&<button data-tour-demo="primary-action" type="button" disabled={done.includes(item.title)} onClick={()=>mark(item.title)} className="rounded-lg bg-violet-600 px-3 py-2 font-bold text-white disabled:opacity-50">{done.includes(item.title)?tr(locale,"VOLTOOID","COMPLETED","TERMINÉ","ABGESCHLOSSEN"):kind==="briefings"?tr(locale,"BRIEFING BEVESTIGEN","ACKNOWLEDGE BRIEFING","CONFIRMER LE BRIEFING","BRIEFING BESTÄTIGEN"):tr(locale,"TAAK VOLTOOIEN","COMPLETE TASK","TERMINER LA TÂCHE","AUFGABE ABSCHLIESSEN")}</button>}
  </article>)}
 </main>
}
