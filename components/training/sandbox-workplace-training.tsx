"use client"
import {useEffect,useMemo,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {getTrainingOperations,type PracticeOperation} from "@/lib/training-exercise-catalog"
import type {TourRole} from "@/lib/tour-training"
type State={type:string;responsible:string;staff:string[];shiftStart:string;shiftEnd:string;overlap:boolean;replacement:string;notice:string;checkedIn:boolean;favorite:string;artist:string;contact:string;pickup:string;files:string[];priceItems:string[];audit:string[]}
const init=():State=>({type:"bar",responsible:"lina",staff:["lina"],shiftStart:"2026-10-10T20:00",shiftEnd:"2026-10-11T04:00",overlap:false,replacement:"",notice:"",checkedIn:false,favorite:"",artist:"",contact:"",pickup:"",files:[],priceItems:[],audit:[]})
const T=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
const key=(role:TourRole)=>"uptilldawn-workplace-training-v1:"+role
const read=(role:TourRole)=>{try{const v=JSON.parse(sessionStorage.getItem(key(role))||"null") as State|null;if(v&&Array.isArray(v.audit)&&Array.isArray(v.staff))return v}catch{}return init()}
const existing=new Set(["workplaces:admin:0","workplaces:admin:17","workplaces:shared:0"])
export function SandboxWorkplaceTraining({role}:{role:string}){
 const trainingRole:TourRole=role==="admin"?"admin":role==="responsible_lead"?"responsible_lead":"employee"
 const [l,setL]=useState<SupportedUiLocale>("nl")
 const [id,setId]=useState("")
 const [state,setState]=useState<State>(init)
 const [opened,setOpened]=useState(false)
 const [input,setInput]=useState("")
 const [selection,setSelection]=useState("")
 const [begin,setBegin]=useState("")
 const [end,setEnd]=useState("")
 const [file,setFile]=useState("")
 const [error,setError]=useState("")
 const [ready,setReady]=useState(false)
 const ops=useMemo(()=>getTrainingOperations(trainingRole,"workplaces"),[trainingRole])
 const current:PracticeOperation|undefined=ops.find(x=>x.id===id)
 const group=current?.id.split(":")[1]
 const index=current?Number(id.split(":").at(-1)):-1
 const delegate=existing.has(id)&&!(trainingRole==="admin"&&id==="workplaces:shared:0")
 useEffect(()=>{const apply=()=>setL(activeUiLocale());apply();addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 useEffect(()=>{const raf=requestAnimationFrame(()=>{setState(read(trainingRole));setReady(true)});return()=>cancelAnimationFrame(raf)},[trainingRole])
 useEffect(()=>{const sync=()=>{const id=document.querySelector('[data-training-lab] [data-training-operation]')?.getAttribute("data-training-operation")||"";setId(x=>x===id?x:id)};sync();const o=new MutationObserver(sync);o.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["data-training-operation"]});return()=>o.disconnect()},[])
 useEffect(()=>{const raf=requestAnimationFrame(()=>{setOpened(false);setInput("");setSelection("");setBegin("");setEnd("");setFile("");setError("")});return()=>cancelAnimationFrame(raf)},[id])
 const choices=()=>{
  if(group==="admin"&&index===1||group==="employee"&&index===1)return [["bar","Bar / Toog","Bar / Counter","Bar / Comptoir","Bar / Theke"],["tokens","Tokens","Tokens","Jetons","Tokens"],["merch","Merch","Merch","Merch","Merch"],["driver","Driver","Driver","Chauffeur","Fahrer"]]
  if(group==="admin"&&(index===2||index===4||index===5||index===8)||group==="responsible_lead"&&index===1)return [["lina","Lina Peeters","Lina Peeters","Lina Peeters","Lina Peeters"],["noah","Noah Jacobs","Noah Jacobs","Noah Jacobs","Noah Jacobs"],["mila","Mila Vermeulen","Mila Vermeulen","Mila Vermeulen","Mila Vermeulen"]]
  return [["bar","Bar / Toog","Bar / Counter","Bar / Comptoir","Bar / Theke"]]
 }
 const details=()=>{
  if(group==="shared"){
   const summary=[
    T(l,"Main Bar · shift 20:00–04:00 · verantwoordelijke Lina Peeters.","Main Bar · shift 20:00–04:00 · lead Lina Peeters.","Bar principal · shift 20h–04h · responsable Lina Peeters.","Hauptbar · Schicht 20–04 Uhr · Verantwortliche Lina Peeters."),
    T(l,"De shift loopt van 20:00 tot 04:00; een verplichte pauze telt niet mee.","The shift runs 20:00–04:00; mandatory breaks are excluded.","Le shift dure de 20h à 04h ; pause obligatoire déduite.","Die Schicht dauert 20–04 Uhr; Pflichtpausen zählen nicht."),
    T(l,"Main Bar: Lina verantwoordelijke, Noah aan de Toog, Mila op Bar.","Main Bar: Lina lead, Noah at counter, Mila at bar.","Bar principal : Lina responsable, Noah au comptoir, Mila au bar.","Hauptbar: Lina verantwortlich, Noah an Theke, Mila an Bar."),
    T(l,"Voor opening: koelingen, wisselgeld en EHBO controleren.","Before opening: check coolers, change and first aid.","Avant ouverture : réfrigération, monnaie et secours.","Vor Öffnung: Kühlung, Wechselgeld, Erste Hilfe prüfen."),
    T(l,"Prijslijst demo: Water €2,50 · Frisdrank €3,00.","Demo price list: Water €2.50 · Soft drink €3.00.","Tarifs démo : Eau 2,50 € · Soda 3,00 €.","Demo-Preisliste: Wasser 2,50 € · Softdrink 3,00 €."),
    T(l,"Tokens: verkoop en validatie zijn een zelfstandige standaardwerkplek.","Tokens: sales and validation are a separate default workplace.","Jetons : vente et validation constituent un poste standard distinct.","Tokens: Verkauf und Prüfung sind ein eigener Standardarbeitsplatz."),
    T(l,"Bar/Toog is één werkplek met subtoewijzingen Bar en Toog.","Bar/Counter is one workplace with Bar and Counter subassignments.","Bar/Comptoir est un poste avec deux sous-affectations.","Bar/Theke ist ein Arbeitsplatz mit Bar- und Thekenzuweisung."),
    T(l,"Per werkplek zijn taken, inventaris en een opstartchecklist gekoppeld.","Tasks, inventory and the opening checklist are linked to each workplace.","Chaque poste possède tâches, inventaire et liste d’ouverture.","Jeder Arbeitsplatz hat Aufgaben, Inventar und Startcheckliste.")
   ]
   return summary[index]||""
  }
  return T(l,"Fictieve shift, bezetting en toegangsgrenzen zijn hieronder zichtbaar.","Fictional shift, crew coverage and access limits appear below.","Le shift fictif, les effectifs et les droits figurent ci-dessous.","Fiktive Schicht, Personalabdeckung und Zugriffsrechte sind unten sichtbar.")
 }
 const submit=()=>{
  if(!current||!ready||delegate)return
  const next:State={...state,staff:[...state.staff],files:[...state.files],priceItems:[...state.priceItems],audit:[...state.audit]}
  let value=current.kind==="inspect"?"reviewed":"confirmed"
  const fail=(nl:string,en:string,fr:string,de:string)=>setError(T(l,nl,en,fr,de))
  if(current.kind==="inspect"){if(!opened)return}
  else if(current.kind==="select"){
   if(!selection)return fail("Maak een keuze.","Choose an option.","Choisissez une option.","Wähle eine Option.")
   value=selection
   if(group==="admin"&&index===1)next.type=selection
   if(group==="admin"&&index===2)next.responsible=selection
   if(group==="admin"&&(index===4||index===5))next.staff=[...new Set([...next.staff,selection])]
   if(group==="admin"&&index===8)next.replacement=selection
   if(group==="responsible_lead"&&index===1)next.staff=[...new Set([...next.staff,selection])]
   if(group==="employee"&&index===1){next.favorite=selection;sessionStorage.setItem("uptilldawn-training-preferred-workplace",selection)}
  }else if(current.kind==="form"||current.kind==="write"||current.kind==="message"){
   if(input.trim().length<5)return fail("Vul minstens vijf tekens in.","Enter at least five characters.","Saisissez au moins cinq caractères.","Mindestens fünf Zeichen eingeben.")
   value=input.trim()
   if(group==="admin"&&index===10){next.artist=value;value+=" · driver"}
   if(group==="admin"&&index===12)next.contact=value
   if(group==="admin"&&index===9||group==="responsible_lead"&&index===4)next.notice=value
  }else if(current.kind==="schedule"){
   if(!begin||!end||begin>=end)return fail("Voer een geldig tijdsvenster in.","Enter a valid time window.","Saisissez un créneau valide.","Gib ein gültiges Zeitfenster ein.")
   value=begin+" → "+end
   if(group==="admin"&&index===3){next.shiftStart=begin;next.shiftEnd=end}
   if(group==="admin"&&index===11)next.pickup=begin
  }else if(current.kind==="toggle"){
   if(group==="admin"&&index===6)next.overlap=!next.overlap
   if(group==="responsible_lead"&&index===3)next.checkedIn=true
  }else if(current.kind==="upload"){
   if(!file)return fail("Kies een fictief prijslijstbestand.","Choose a fictional price list file.","Choisissez un fichier de prix fictif.","Wähle eine fiktive Preislistendatei.")
   value=file;next.files.push(file)
  }else return
  next.audit.push(id+" · "+value)
  sessionStorage.setItem(key(trainingRole),JSON.stringify(next));setState(next);setError("")
  dispatchEvent(new CustomEvent("uptilldawn-training-practical-action",{detail:{role:trainingRole,chapter:"workplaces",id,kind:current.kind,value}}))
 }
 if(!current||delegate)return null
 return <section data-training-workplace={trainingRole} className="mx-auto my-4 max-w-6xl space-y-4 rounded-2xl border border-violet-500/50 p-4">
  <header><p className="text-xs font-black text-violet-500">{T(l,"FICTIEVE WERKPLEKBEHEER","FICTIONAL WORKPLACE MANAGEMENT","GESTION FICTIVE DES POSTES","FIKTIVE ARBEITSPLATZVERWALTUNG")}</p><h2 className="text-xl font-black">{T(l,"Main Bar · shifts en personeel","Main Bar · shifts and crew","Bar principal · shifts et personnel","Hauptbar · Schichten und Personal")}</h2></header>
  <article className="space-y-2 rounded-xl border p-3"><p>{T(l,"Werkplektype","Workplace type","Type de poste","Arbeitsplatztyp")}: {state.type} · {T(l,"Verantwoordelijke","Lead","Responsable","Verantwortlich")}: {state.responsible}</p><p>{T(l,"Shift","Shift","Shift","Schicht")}: {state.shiftStart} → {state.shiftEnd}</p><p>{T(l,"Personeel","Staff","Personnel","Personal")}: {state.staff.join(", ")} · {T(l,"Vervanger","Replacement","Remplaçant","Ersatz")}: {state.replacement||"—"}</p><p>{T(l,"Overlapping toegestaan","Overlapping allowed","Chevauchement autorisé","Überlappung erlaubt")}: {state.overlap?T(l,"Ja","Yes","Oui","Ja"):T(l,"Nee","No","Non","Nein")} · {T(l,"Aanwijzing bevestigd","Check-in confirmed","Pointage confirmé","Check-in bestätigt")}: {state.checkedIn?T(l,"Ja","Yes","Oui","Ja"):T(l,"Nee","No","Non","Nein")}</p>
   <p>{T(l,"Driver-opdracht","Driver assignment","Mission chauffeur","Fahrerauftrag")}: {state.artist||"—"} · {state.pickup||"—"}</p><p>{T(l,"Prijslijsten","Price lists","Listes de prix","Preislisten")}: {state.files.length}</p>
  </article>
  <div data-demo-workplace-operation={id} className="space-y-3 rounded-xl border border-violet-500/40 p-3"><h3 className="font-bold">{current.title[l]}</h3>
   {current.kind==="inspect"?<><button type="button" data-training-preview-op={id} onClick={()=>setOpened(true)} className="w-full rounded-xl bg-violet-600 p-3 font-bold text-white">{T(l,"OPEN WERKPLEKGEGEVENS","OPEN WORKPLACE DATA","OUVRIR LES DONNÉES DU POSTE","ARBEITSPLATZDATEN ÖFFNEN")}</button>{opened&&<p data-demo-workplace-detail={id} className="rounded-lg border p-3 text-sm">{details()}</p>}</>
    :current.kind==="form"||current.kind==="write"||current.kind==="message"?<label className="grid gap-2 text-sm font-semibold">{current.title[l]}<input data-demo-workplace-input value={input} onChange={e=>setInput(e.target.value)} className="rounded-xl border bg-background p-3"/></label>
    :current.kind==="select"?<label className="grid gap-2 text-sm font-semibold">{current.title[l]}<select data-demo-workplace-select value={selection} onChange={e=>setSelection(e.target.value)} className="rounded-xl border bg-background p-3"><option value="">{T(l,"Maak een keuze","Choose an option","Choisir","Wählen")}</option>{choices().map(([value,nl,en,fr,de])=><option value={value} key={value}>{l==="nl"?nl:l==="en"?en:l==="fr"?fr:de}</option>)}</select></label>
    :current.kind==="schedule"?<div className="grid gap-2 sm:grid-cols-2"><input data-demo-workplace-start type="datetime-local" value={begin} onChange={e=>setBegin(e.target.value)} className="rounded-lg border bg-background p-3"/><input data-demo-workplace-end type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} className="rounded-lg border bg-background p-3"/></div>
    :current.kind==="upload"?<label className="grid gap-2 text-sm font-semibold">{current.title[l]}<select data-demo-workplace-upload value={file} onChange={e=>setFile(e.target.value)} className="rounded-xl border bg-background p-3"><option value="">{T(l,"Kies voorbeeldbestand","Choose sample file","Choisir fichier démo","Demodatei wählen")}</option><option value="training-prices.csv">training-prices.csv</option><option value="training-prices.png">training-prices.png</option></select></label>
    :<p className="text-sm">{current.help[l]}</p>}
   <button type="button" data-training-practical-op={id} disabled={!ready||(current.kind==="inspect"&&!opened)} onClick={submit} className="w-full rounded-xl bg-violet-600 p-3 font-bold text-white disabled:opacity-40">{current.title[l]}</button>
   {error&&<p role="alert" className="text-sm text-rose-500">{error}</p>}
  </div>
  <details className="rounded-xl border p-3"><summary className="cursor-pointer font-bold">{T(l,"Controlelog","Audit trail","Journal d’audit","Prüfprotokoll")} · {state.audit.length}</summary><ol data-demo-workplace-audit-count={state.audit.length} className="mt-2 space-y-1 text-sm">{state.audit.map((entry,i)=><li key={i}>{entry}</li>)}</ol></details>
 </section>
}
