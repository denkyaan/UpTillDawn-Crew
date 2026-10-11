"use client"
import {useEffect,useMemo,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {getTrainingOperations,type PracticeOperation} from "@/lib/training-exercise-catalog"
import type {TourRole} from "@/lib/tour-training"

type EventState={
 name:string;venue:string;start:string;end:string;deadline:string;capacity:number;status:string;
 response:string;setup:string;breakdown:string;waitlist:boolean;assigned:string;notification:string;crewMessage:string;
 published:boolean;archived:boolean;reviewed:string[];audit:string[]
}
const initial=():EventState=>({name:"UpTillDawn Trainingsavond",venue:"Leuven",start:"2026-10-10T20:00",end:"2026-10-11T04:00",deadline:"2026-10-10T18:00",capacity:20,status:"scheduled",response:"",setup:"",breakdown:"",waitlist:false,assigned:"",notification:"",crewMessage:"",published:false,archived:false,reviewed:[],audit:[]})
const T=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
const store=(role:TourRole)=>"uptilldawn-event-training-v1:"+role
function restore(role:TourRole){try{const v=JSON.parse(sessionStorage.getItem(store(role))||"null") as EventState|null;if(v&&Array.isArray(v.reviewed)&&Array.isArray(v.audit))return v}catch{}return initial()}
const dedicated=new Set(["events:admin:6","events:admin:12","events:admin:14","events:shared:0"])
export function SandboxEventTraining({role}:{role:string}){
 const trainingRole:TourRole=role==="admin"?"admin":role==="responsible_lead"?"responsible_lead":"employee"
 const [l,setL]=useState<SupportedUiLocale>("nl")
 const [id,setId]=useState("")
 const [state,setState]=useState<EventState>(initial)
 const [opened,setOpened]=useState(false)
 const [value,setValue]=useState("")
 const [selection,setSelection]=useState("")
 const [start,setStart]=useState("")
 const [end,setEnd]=useState("")
 const [error,setError]=useState("")
 const [hydrated,setHydrated]=useState(false)
 const operations=useMemo(()=>getTrainingOperations(trainingRole,"events"),[trainingRole])
 const current:PracticeOperation|undefined=operations.find(x=>x.id===id)
 const group=current?.id.split(":")[1]
 const index=current?Number(id.split(":").at(-1)):-1
 const preserveExisting=dedicated.has(id)&&!(trainingRole==="admin"&&id==="events:shared:0")
 useEffect(()=>{const apply=()=>setL(activeUiLocale());apply();addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 useEffect(()=>{const raf=requestAnimationFrame(()=>{setState(restore(trainingRole));setHydrated(true)});return()=>cancelAnimationFrame(raf)},[trainingRole])
 useEffect(()=>{const sync=()=>{const x=document.querySelector('[data-training-lab] [data-training-operation]')?.getAttribute("data-training-operation")||"";setId(y=>y===x?y:x)};sync();const obs=new MutationObserver(sync);obs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["data-training-operation"]});return()=>obs.disconnect()},[])
 useEffect(()=>{const raf=requestAnimationFrame(()=>{setOpened(false);setValue("");setSelection("");setStart("");setEnd("");setError("")});return()=>cancelAnimationFrame(raf)},[id])
 const notes=()=>{
  if(group==="shared"){
   if(index===1)return T(l,"Registratie sluit 18:00, twee uur vóór evenementstart.","Registration closes at 18:00, two hours before event start.","Inscription jusqu’à 18h, deux heures avant le début.","Anmeldung bis 18 Uhr, zwei Stunden vor Beginn.")
   if(index===2)return T(l,"20 plaatsen: 18 bevestigd, 2 vrij, wachtlijst met voorrang bij afmelding.","20 places: 18 confirmed, 2 free, priority waitlist on cancellation.","20 places : 18 confirmées, 2 libres, attente prioritaire en cas de désistement.","20 Plätze: 18 bestätigt, 2 frei, Wartelistenpriorität bei Absage.")
   if(index===6)return T(l,"Jouw evenementbeschikbaarheid: ","Your availability: ","Votre disponibilité : ","Deine Verfügbarkeit: ")+(state.response||"—")
   if(index===7)return T(l,"Na de aanmelddeadline blijft het evenement zichtbaar, maar aanmelden is geblokkeerd.","After the deadline the event remains visible, but joining is blocked.","Après la date limite, l’événement reste visible mais l’inscription est fermée.","Nach Anmeldeschluss bleibt das Event sichtbar, neue Anmeldung ist gesperrt.")
   if(index===8)return T(l,"Bij uitval krijgt de eerstvolgende beschikbare persoon een plaats en melding.","On cancellation the first available waitlisted person receives a place and notification.","Après désistement, la prochaine personne disponible reçoit une place et notification.","Bei Ausfall erhält die nächste verfügbare Person einen Platz und eine Meldung.")
  }
  if(group==="admin"){
   if(index===7)return T(l,"Crew: Lina beschikbaar, Noah beschikbaar, Mila op wachtlijst.","Crew: Lina available, Noah available, Mila on waitlist.","Équipe : Lina disponible, Noah disponible, Mila en attente.","Crew: Lina verfügbar, Noah verfügbar, Mila auf Warteliste.")
   if(index===8)return T(l,"Mila is eerste vervanger omdat zij het vroegst op de wachtlijst staat.","Mila is first replacement because she joined the waitlist earliest.","Mila est la première remplaçante, car elle est en tête de la liste d’attente.","Mila steht als erste Ersatzkraft auf der Warteliste.")
   if(index===11)return T(l,"Evenementdocumenten: briefing.pdf, veiligheidsplan.pdf.","Event documents: briefing.pdf, safety-plan.pdf.","Documents : briefing.pdf, plan-securite.pdf.","Eventdokumente: briefing.pdf, sicherheitsplan.pdf.")
   if(index===13)return T(l,"Een gearchiveerd evenement blijft met uren en briefing leesbaar, maar is niet meer actief.","Archived events remain readable with hours and briefings but cannot be edited as active.","Événement archivé : heures et briefing restent consultables, sans statut actif.","Archivierte Events bleiben mit Zeiten und Briefing lesbar, sind aber nicht mehr aktiv.")
  }
  if(group==="responsible_lead")return index===0?T(l,"Main Bar: Lina kan, Noah kan, Mila wacht op bevestiging.","Main Bar: Lina available, Noah available, Mila pending.","Bar principal : Lina disponible, Noah disponible, Mila en attente.","Hauptbar: Lina verfügbar, Noah verfügbar, Mila wartet."):T(l,"Na afmelding van Noah wordt Mila op de lijst als vervanger voorgesteld.","When Noah cancels, Mila is next in line as replacement.","Après le désistement de Noah, Mila est proposée comme remplaçante.","Wenn Noah absagt, wird Mila als Ersatz vorgeschlagen.")
  if(group==="employee")return T(l,"Spot-openmelding: er is één plaats vrij voor Main Bar; bevestig vóór de deadline.","Open-spot notification: one Main Bar place is available; confirm before the deadline.","Notification : une place libre au Bar principal, à confirmer avant la date limite.","Freier Platz: Ein Hauptbar-Platz ist frei; vor Fristablauf bestätigen.")
  return T(l,"Trainingsevenement in Leuven, 20:00–04:00.","Training event in Leuven, 20:00–04:00.","Événement démo à Louvain, 20h–04h.","Trainingsevent in Leuven, 20–04 Uhr.")
 }
 const choices=()=>{
  if(group==="shared"&&index===3||group==="employee"&&index===0)return [["can","IK KAN","I CAN","JE PEUX","ICH KANN"],["cannot","IK KAN NIET","I CANNOT","JE NE PEUX PAS","ICH KANN NICHT"]]
  if(group==="shared"&&(index===4||index===5))return [["yes","Ja","Yes","Oui","Ja"],["no","Nee","No","Non","Nein"]]
  if(group==="admin"&&index===5)return [["scheduled","Gepland","Scheduled","Planifié","Geplant"],["active","Actief","Active","Actif","Aktiv"]]
  return [["mila","Mila Vermeulen","Mila Vermeulen","Mila Vermeulen","Mila Vermeulen"],["noah","Noah Jacobs","Noah Jacobs","Noah Jacobs","Noah Jacobs"]]
 }
 const submit=()=>{
  if(!hydrated||!current||preserveExisting)return
  const next:EventState={...state,reviewed:[...state.reviewed],audit:[...state.audit]}
  let result=current.kind==="inspect"?"reviewed":"confirmed"
  const fail=(nl:string,en:string,fr:string,de:string)=>setError(T(l,nl,en,fr,de))
  if(current.kind==="inspect"){
   if(!opened)return
   next.reviewed=[...new Set([...next.reviewed,id])]
  }else if(current.kind==="form"||current.kind==="write"||current.kind==="message"){
   if(value.trim().length<5)return fail("Vul minstens vijf tekens in.","Enter at least five characters.","Saisissez au moins cinq caractères.","Mindestens fünf Zeichen eingeben.")
   result=value.trim()
   if(group==="admin"&&index===0)next.name=result
   if(group==="admin"&&index===2)next.venue=result
   if(group==="admin"&&index===10)next.notification=result
   if(group==="responsible_lead"&&index===2)next.crewMessage=result
  }else if(current.kind==="number"){
   const n=Number(value)
   if(!Number.isSafeInteger(n)||n<1||n>500)return fail("Vul een geldig aantal van 1 tot 500 in.","Enter a capacity from 1 to 500.","Saisissez une capacité entre 1 et 500.","Gib eine Kapazität von 1 bis 500 ein.")
   next.capacity=n;result=String(n)
  }else if(current.kind==="schedule"){
   if(!start||!end||start>=end)return fail("Kies geldige begin- en eindtijden.","Choose valid start and end times.","Choisissez des heures de début et fin valides.","Wähle gültige Anfangs- und Endzeiten.")
   result=start+" → "+end
   if(group==="admin"&&index===1){next.start=start;next.end=end}
   if(group==="admin"&&index===4)next.deadline=start
  }else if(current.kind==="select"){
   if(!selection)return fail("Maak een keuze.","Choose an option.","Choisissez une option.","Wähle eine Option.")
   result=selection
   if(group==="shared"&&index===3||group==="employee"&&index===0)next.response=selection
   if(group==="shared"&&index===4)next.setup=selection
   if(group==="shared"&&index===5)next.breakdown=selection
   if(group==="admin"&&index===5)next.status=selection
   if(group==="admin"&&index===9)next.assigned=selection
  }else if(current.kind==="toggle"){
   if(group==="employee"&&index===1)next.waitlist=true
  }else return
  next.audit.push(id+" · "+result)
  sessionStorage.setItem(store(trainingRole),JSON.stringify(next));setState(next);setError("")
  dispatchEvent(new CustomEvent("uptilldawn-training-practical-action",{detail:{role:trainingRole,chapter:"events",id,kind:current.kind,value:result}}))
 }
 if(!current||preserveExisting)return null
 return <section data-training-event={trainingRole} className="mx-auto my-4 max-w-6xl space-y-4 rounded-2xl border border-violet-500/50 p-4">
  <p className="text-xs font-black text-violet-500">{T(l,"FICTIEVE EVENTACTIES","FICTIONAL EVENT OPERATIONS","OPÉRATIONS ÉVÉNEMENT FICTIVES","FIKTIVE EVENTAKTIONEN")}</p>
  <article className="rounded-xl border p-3"><h3 className="font-bold">{state.name}</h3><p>{state.venue} · {state.start} → {state.end}</p><p className="text-sm">{T(l,"Maximaal personeel","Crew capacity","Capacité équipe","Crew-Kapazität")}: {state.capacity} · {T(l,"Deadline","Deadline","Échéance","Frist")}: {state.deadline}</p>
  <p>{T(l,"Beschikbaarheid","Availability","Disponibilité","Verfügbarkeit")}: {state.response||"—"} · {T(l,"Opbouw","Setup","Montage","Aufbau")}: {state.setup||"—"} · {T(l,"Afbouw","Teardown","Démontage","Abbau")}: {state.breakdown||"—"}</p>
  {state.assigned&&<p>{T(l,"Vervanger toegewezen","Replacement assigned","Remplaçant attribué","Ersatz zugewiesen")}: {state.assigned}</p>}{state.waitlist&&<p>{T(l,"Je staat op de wachtlijst","You are on the waiting list","Vous êtes sur liste d’attente","Du stehst auf der Warteliste")}</p>}{state.notification&&<p>{T(l,"Melding","Notification","Notification","Meldung")}: {state.notification}</p>}
  </article>
  <div data-demo-event-operation={id} className="space-y-3 rounded-xl border border-violet-500/40 p-3"><h3 className="font-bold">{current.title[l]}</h3>
  {current.kind==="inspect"?<><button type="button" data-training-preview-op={id} onClick={()=>setOpened(true)} className="w-full rounded-lg bg-violet-600 p-3 font-bold text-white">{T(l,"OPEN EVENTDETAILS","OPEN EVENT DETAILS","OUVRIR LES DÉTAILS","EVENTDETAILS ÖFFNEN")}</button>{opened&&<p data-demo-event-detail={id} className="rounded-lg border p-3 text-sm">{notes()}</p>}</>
   :current.kind==="form"||current.kind==="write"||current.kind==="message"||current.kind==="number"?<label className="grid gap-2 text-sm font-semibold">{current.title[l]}<input data-demo-event-value type={current.kind==="number"?"number":"text"} value={value} onChange={e=>setValue(e.target.value)} className="rounded-lg border bg-background p-3"/></label>
   :current.kind==="select"?<label className="grid gap-2 text-sm font-semibold">{current.title[l]}<select data-demo-event-select value={selection} onChange={e=>setSelection(e.target.value)} className="rounded-lg border bg-background p-3"><option value="">{T(l,"Kies een optie","Select an option","Choisir","Wählen")}</option>{choices().map(([id,nl,en,fr,de])=><option key={id} value={id}>{l==="nl"?nl:l==="en"?en:l==="fr"?fr:de}</option>)}</select></label>
   :current.kind==="schedule"?<div className="grid gap-2 sm:grid-cols-2"><input data-demo-event-start type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} className="rounded-lg border bg-background p-3"/><input data-demo-event-end type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} className="rounded-lg border bg-background p-3"/></div>
   :<p className="text-sm">{current.help[l]}</p>}
   <button type="button" data-training-practical-op={id} disabled={!hydrated||(current.kind==="inspect"&&!opened)} onClick={submit} className="w-full rounded-lg bg-violet-600 p-3 font-bold text-white disabled:opacity-40">{current.title[l]}</button>
   {error&&<p role="alert" className="text-sm text-rose-500">{error}</p>}
  </div>
  <details className="rounded-xl border p-3"><summary className="cursor-pointer font-bold">{T(l,"Eventcontrolelog","Event audit trail","Journal événement","Event-Prüfprotokoll")} · {state.audit.length}</summary><ol data-demo-event-audit-count={state.audit.length} className="mt-2 text-sm">{state.audit.map((entry,i)=><li key={i}>{entry}</li>)}</ol></details>
 </section>
}
