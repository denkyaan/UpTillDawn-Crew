"use client"
import {useEffect,useMemo,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {getTrainingOperations,type PracticeOperation} from "@/lib/training-exercise-catalog"
import type {TourRole} from "@/lib/tour-training"

type Module="exports"|"platform"|"settings"
type Row={name:string;workplace:string;gross:number;breakHours:number;approved:boolean;locked:boolean}
type State={
 event:string;format:string;from:string;to:string;approvedReviewed:boolean;lockedReviewed:boolean;ready:boolean;
 automation:string;category:string;trigger:string;template:string;templateType:string;rollout:boolean;
 profile:string;language:string;push:boolean;question:string;answer:string;audit:string[]
}
const rows:Row[]=[
 {name:"Lina Peeters",workplace:"Bar / Toog",gross:8,breakHours:1,approved:true,locked:true},
 {name:"Noah Jacobs",workplace:"Tokens",gross:7.5,breakHours:1,approved:true,locked:true},
 {name:"Mila Vermeulen",workplace:"Merch",gross:6,breakHours:1,approved:false,locked:false}
]
const initial=():State=>({
 event:"",format:"",from:"",to:"",approvedReviewed:false,lockedReviewed:false,ready:false,
 automation:"",category:"",trigger:"",template:"",templateType:"",rollout:false,
 profile:"",language:"",push:false,question:"",answer:"",audit:[]
})
const T=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
const keyFor=(module:Module,role:TourRole)=>"uptilldawn-system-training-v1:"+role+":"+module
const read=(key:string):State=>{
 try{const raw=JSON.parse(sessionStorage.getItem(key)||"null") as State|null
  if(raw&&Array.isArray(raw.audit)&&typeof raw.ready==="boolean")return raw
 }catch{}
 return initial()
}
export function SandboxSystemTraining({module,role}:{module:Module;role:string}){
 const trainingRole:TourRole=role==="admin"?"admin":role==="responsible_lead"?"responsible_lead":"employee"
 const [l,setL]=useState<SupportedUiLocale>("nl")
 const [currentId,setCurrentId]=useState("")
 const [state,setState]=useState<State>(initial)
 const [selection,setSelection]=useState("")
 const [name,setName]=useState("")
 const [category,setCategory]=useState("")
 const [from,setFrom]=useState("")
 const [to,setTo]=useState("")
 const [error,setError]=useState("")
 const [hydrated,setHydrated]=useState(false)
 const operations=useMemo(()=>getTrainingOperations(trainingRole,module),[trainingRole,module])
 const current:PracticeOperation|undefined=operations.find(step=>step.id===currentId)
 const group=current?.id.split(":")[1]
 const idx=current?Number(current.id.split(":").at(-1)):-1
 const key=keyFor(module,trainingRole)
 useEffect(()=>{const apply=()=>setL(activeUiLocale());apply();addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 useEffect(()=>{const frame=requestAnimationFrame(()=>{setState(read(key));setHydrated(true)});return()=>cancelAnimationFrame(frame)},[key])
 useEffect(()=>{
  const sync=()=>{const id=document.querySelector('[data-training-lab] [data-training-operation]')?.getAttribute("data-training-operation")||"";setCurrentId(old=>old===id?old:id)}
  sync();const observer=new MutationObserver(sync)
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["data-training-operation"]})
  return()=>observer.disconnect()
 },[])
 const fail=(nl:string,en:string,fr:string,de:string)=>setError(T(l,nl,en,fr,de))
 const submit=()=>{
  if(!hydrated||!current)return
  const next:State={...state,audit:[...state.audit]}
  let value=""
  if(current.kind==="inspect"){
   value="reviewed"
   if(module==="exports"&&idx===1)next.approvedReviewed=true
   if(module==="exports"&&idx===2)next.lockedReviewed=true
  }else if(current.kind==="select"){
   if(!selection)return fail("Maak een keuze.","Choose an option.","Choisissez une option.","Wähle eine Option.")
   value=selection
   if(module==="exports"&&idx===0)next.event=selection
   if(module==="exports"&&idx===3)next.format=selection
   if(module==="platform"&&idx===3)next.trigger=selection
   if(module==="settings"&&idx===2)next.language=selection
  }else if(current.kind==="form"){
   if(name.trim().length<5||!category)return fail("Vul een naam en categorie in.","Enter a name and category.","Indiquez un nom et une catégorie.","Gib Name und Kategorie ein.")
   value=name.trim()+" · "+category
   if(module==="platform"&&idx===2){next.automation=name.trim();next.category=category}
   if(module==="platform"&&idx===5){next.template=name.trim();next.templateType=category}
  }else if(current.kind==="schedule"){
   if(!from||!to||from>=to)return fail("Kies een geldig datumbereik.","Choose a valid date range.","Choisissez des dates valides.","Wähle einen gültigen Zeitraum.")
   next.from=from;next.to=to;value=from+" → "+to
  }else if(current.kind==="write"||current.kind==="message"){
   if(name.trim().length<5)return fail("Vul minstens vijf tekens in.","Enter at least five characters.","Saisissez au moins cinq caractères.","Mindestens fünf Zeichen eingeben.")
   value=name.trim()
   if(module==="settings"&&group==="shared"&&idx===1)next.profile=value
   if(module==="settings"&&group==="admin"&&idx===2){
    next.question=value
    next.answer=T(l,"Demo-AI: controleer de rolrechten en de gebeurtenislog.","Demo AI: review role permissions and event audit trail.","IA démo : vérifier les droits et le journal d’événements.","Demo-KI: Rollenrechte und Ereignisprotokoll prüfen.")
   }
  }else if(current.kind==="toggle"){
   if(module==="exports"&&idx===5){
    if(!next.event||!next.approvedReviewed||!next.lockedReviewed||!next.format||!next.from||!next.to)return fail("Controleer eerst evenement, goedkeuringen, vergrendeling en datums.","First review the event, approvals, locks and date range.","Vérifiez d’abord l’événement, les validations, les verrous et les dates.","Prüfe zuerst Event, Genehmigungen, Sperren und Zeitraum.")
    next.ready=true
   }
   if(module==="platform"&&idx===11){
    if(!next.automation||!next.template||!next.trigger)return fail("Maak eerst de automatisering en template aan en kies de trigger.","First create the automation and template and select a trigger.","Créez d’abord l’automatisation et le modèle, puis choisissez le déclencheur.","Erstelle zuerst Automatisierung und Vorlage und wähle einen Trigger.")
    next.rollout=true
   }
   if(module==="settings"&&idx===4&&group==="shared")next.push=!next.push
   value="confirmed"
  }else return
  next.audit.push(current.id+" · "+value)
  sessionStorage.setItem(key,JSON.stringify(next));setState(next)
  setSelection("");setName("");setCategory("");setFrom("");setTo("");setError("")
  dispatchEvent(new CustomEvent("uptilldawn-training-practical-action",{detail:{role:trainingRole,chapter:module,id:current.id,kind:current.kind,value}}))
 }
 const choices=():{value:string;label:string}[]=>{
  if(module==="exports"&&current?.id==="exports:admin:0")return [
   {value:"training-event",label:T(l,"UpTillDawn Trainingsavond","UpTillDawn Training Night","Soirée d’entraînement UpTillDawn","UpTillDawn Trainingsabend")}
  ]
  if(module==="exports"&&current?.id==="exports:admin:3")return [{value:"xlsx",label:T(l,"Excel (.xlsx)","Excel (.xlsx)","Excel (.xlsx)","Excel (.xlsx)")},{value:"csv",label:T(l,"CSV (.csv)","CSV (.csv)","CSV (.csv)","CSV (.csv)")}]
  if(module==="platform"&&current?.id==="platform:admin:3")return [
   {value:"shift-confirmed",label:T(l,"Shift bevestigd","Shift confirmed","Shift confirmé","Schicht bestätigt")},
   {value:"artist-arrived",label:T(l,"Artiest aangekomen","Artist arrived","Artiste arrivé","Künstler angekommen")}
  ]
  if(module==="settings"&&current?.id==="settings:shared:2")return [{value:"nl",label:"Nederlands"},{value:"fr",label:"Français"},{value:"en",label:"English"},{value:"de",label:"Deutsch"}]
  return []
 }
 const categories=()=>idx===2?[
  {value:"notification",label:T(l,"Personeelsmelding","Staff notification","Notification du personnel","Personalbenachrichtigung")},
  {value:"reminder",label:T(l,"Shiftherinnering","Shift reminder","Rappel de shift","Schichterinnerung")}
 ]:[
  {value:"briefing",label:T(l,"Briefingtemplate","Briefing template","Modèle de briefing","Briefingvorlage")},
  {value:"message",label:T(l,"Berichttemplate","Message template","Modèle de message","Nachrichtenvorlage")}
 ]
 const input=()=>{
  if(!current)return null
  if(current.kind==="select")return <label className="grid gap-2 text-sm font-bold">{current.title[l]}<select data-demo-system-select value={selection} onChange={e=>setSelection(e.target.value)} className="rounded-lg border bg-background p-3"><option value="">{T(l,"Maak een keuze","Choose an option","Choisir une option","Option wählen")}</option>{choices().map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
  if(current.kind==="form")return <div className="grid gap-3"><label className="grid gap-1 text-sm font-bold">{current.title[l]}<input data-demo-system-name value={name} onChange={e=>setName(e.target.value)} className="rounded-lg border bg-background p-3" placeholder={T(l,"Naam van demo-element","Demo item name","Nom de l’élément démo","Demo-Elementname")}/></label><label className="grid gap-1 text-sm font-bold">{T(l,"Type","Type","Type","Typ")}<select data-demo-system-category value={category} onChange={e=>setCategory(e.target.value)} className="rounded-lg border bg-background p-3"><option value="">{T(l,"Kies een type","Choose type","Choisissez le type","Typ wählen")}</option>{categories().map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label></div>
  if(current.kind==="schedule")return <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-sm font-bold">{T(l,"Van","From","Du","Von")}<input data-demo-system-from type="datetime-local" value={from} onChange={e=>setFrom(e.target.value)} className="rounded-lg border bg-background p-3"/></label><label className="grid gap-1 text-sm font-bold">{T(l,"Tot","Until","Au","Bis")}<input data-demo-system-to type="datetime-local" value={to} onChange={e=>setTo(e.target.value)} className="rounded-lg border bg-background p-3"/></label></div>
  if(current.kind==="write"||current.kind==="message")return <label className="grid gap-1 text-sm font-bold">{current.title[l]}<textarea data-demo-system-name rows={3} value={name} onChange={e=>setName(e.target.value)} className="rounded-lg border bg-background p-3" placeholder={T(l,"Voer een fictieve waarde in","Enter a fictional value","Saisissez une valeur fictive","Fiktiven Wert eingeben")}/></label>
  return <p className="text-sm text-muted-foreground">{current.help[l]}</p>
 }
 const total=rows.filter(row=>row.approved&&row.locked).reduce((sum,row)=>sum+row.gross-row.breakHours,0)
 const title=module==="exports"?T(l,"Excel en urenexport","Excel and time export","Excel et export des heures","Excel und Stundenexport"):module==="platform"?T(l,"Platformbeheer","Platform management","Gestion de la plateforme","Plattformverwaltung"):T(l,"Profiel en instellingen","Profile and settings","Profil et paramètres","Profil und Einstellungen")
 return <main data-tour-demo="training-screen" data-training-system={module} className="mx-auto max-w-6xl space-y-5 p-4 pb-28 md:p-8">
  <header className="space-y-2"><p className="text-xs font-black uppercase text-violet-500">{T(l,"FICTIEVE TRAININGSOMGEVING","FICTIONAL TRAINING ENVIRONMENT","ENVIRONNEMENT DE FORMATION FICTIF","FIKTIVE TRAININGSUMGEBUNG")}</p><h1 className="text-2xl font-black">{title}</h1><p className="text-sm text-muted-foreground">{T(l,"Handelingen worden alleen in deze browsersessie opgeslagen; er worden geen productiegegevens gewijzigd.","Actions are saved only in this browser session; no production records are changed.","Les actions restent dans cette session ; aucune donnée de production n’est modifiée.","Aktionen bleiben nur in dieser Browsersitzung; keine Produktionsdaten werden geändert.")}</p></header>
  {module==="exports"&&<section className="space-y-3 rounded-xl border p-4" data-demo-system-export>
   <h2 className="font-bold">{T(l,"Fictieve urenregistratie","Fictional timesheets","Feuilles d’heures fictives","Fiktive Stundenzettel")}</h2>
   <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>{T(l,"Personeel","Staff","Personnel","Personal")}</th><th>{T(l,"Werkplek","Workplace","Poste","Arbeitsplatz")}</th><th>{T(l,"Netto uren","Net hours","Heures nettes","Nettostunden")}</th><th>{T(l,"Status","Status","Statut","Status")}</th></tr></thead><tbody>{rows.map(row=><tr key={row.name} className="border-t"><td className="py-2">{row.name}</td><td>{row.workplace}</td><td>{row.gross-row.breakHours}</td><td>{row.approved&&row.locked?T(l,"Goedgekeurd en gelockt","Approved and locked","Approuvé et verrouillé","Genehmigt und gesperrt"):T(l,"Niet exporteerbaar","Not exportable","Non exportable","Nicht exportierbar")}</td></tr>)}</tbody></table></div>
   <p className="text-sm">{T(l,"Netto exporteerbare uren","Net exportable hours","Heures nettes exportables","Exportierbare Nettostunden")}: <strong>{total}</strong></p>
   {state.ready&&<p data-demo-system-ready className="rounded-lg border border-violet-500 p-3 text-sm">{T(l,"Demo-export gereed","Demo export prepared","Export démo prêt","Demo-Export bereit")} · {state.format.toUpperCase()} · {total} {T(l,"uur","hours","heures","Std.")} · {state.from} → {state.to}</p>}
  </section>}
  {module==="platform"&&<section className="grid gap-3 md:grid-cols-2" data-demo-system-platform>
   <article className="rounded-xl border p-4"><h2 className="font-bold">{T(l,"Automatisering","Automation","Automatisation","Automatisierung")}</h2><p className="text-sm">{state.automation||T(l,"Nog niet ingesteld","Not configured","Non configuré","Nicht konfiguriert")} · {state.trigger||"—"}</p></article>
   <article className="rounded-xl border p-4"><h2 className="font-bold">{T(l,"Bericht- en briefingtemplate","Message and briefing template","Modèle de message et briefing","Nachrichten- und Briefingvorlage")}</h2><p className="text-sm">{state.template||"—"} · {state.templateType||"—"}</p></article>
   <article className="rounded-xl border p-4"><h2 className="font-bold">{T(l,"Beveiliging, QR en toegangsrechten","Security, QR and permissions","Sécurité, QR et autorisations","Sicherheit, QR und Berechtigungen")}</h2><p className="text-sm">{T(l,"Alleen Admin. QR voor demo-event. Uploadscan: gesimuleerd veilig.","Admin only. Demo event QR. Upload scan: simulated safe.","Admin uniquement. QR de l’événement démo. Analyse simulée.","Nur Admin. QR für Demo-Event. Uploadprüfung simuliert sicher.")}</p></article>
   <article className="rounded-xl border p-4"><h2 className="font-bold">{T(l,"Releases en herstel","Releases and recovery","Versions et restauration","Releases und Wiederherstellung")}</h2><p className="text-sm">{state.rollout?T(l,"Fictieve rollout gesimuleerd","Fictional rollout simulated","Déploiement fictif simulé","Fiktiver Rollout simuliert"):T(l,"Geen productie-release","No production release","Aucune mise en production","Keine Produktionsfreigabe")} · {T(l,"Foutieve CI blokkeert productie","Failed CI blocks production","La CI échouée bloque la production","Fehlgeschlagene CI blockiert Produktion")}</p></article>
  </section>}
  {module==="settings"&&<section className="grid gap-3 md:grid-cols-2" data-demo-system-settings>
   <article className="rounded-xl border p-4"><h2 className="font-bold">{T(l,"Demoprofiel","Demo profile","Profil démo","Demoprofil")}</h2><p>{state.profile||"Lina Peeters"}</p><p className="text-sm text-muted-foreground">{T(l,"Taal","Language","Langue","Sprache")}: {state.language||l}</p></article>
   <article className="rounded-xl border p-4"><h2 className="font-bold">{T(l,"Meldingen en toegang","Notifications and permissions","Notifications et autorisations","Benachrichtigungen und Rechte")}</h2><p className="text-sm">{state.push?T(l,"Demo-push geactiveerd","Demo push enabled","Push démo activé","Demo-Push aktiviert"):T(l,"Demo-push niet geactiveerd","Demo push disabled","Push démo désactivé","Demo-Push deaktiviert")} · {T(l,"GPS en camera vereisen toestemming","GPS and camera require permission","GPS et caméra nécessitent une autorisation","GPS und Kamera benötigen Berechtigung")}</p></article>
   <article className="rounded-xl border p-4 md:col-span-2"><h2 className="font-bold">{T(l,"Installeren en offline gebruiken","Install and use offline","Installer et utiliser hors ligne","Installieren und offline nutzen")}</h2><p className="text-sm">{T(l,"Android: Toevoegen aan startscherm. iOS: Deel → Zet op beginscherm. Windows: Installeer app in de browser. Synchronisatie volgt bij opnieuw verbinden.","Android: Add to home screen. iOS: Share → Add to Home Screen. Windows: Install app in browser. Sync resumes after reconnect.","Android : ajouter à l’accueil. iOS : Partager → Sur l’écran d’accueil. Windows : installer dans le navigateur. Synchronisation après reconnexion.","Android: Zum Startbildschirm. iOS: Teilen → Zum Home-Bildschirm. Windows: App im Browser installieren. Sync nach Wiederverbindung.")}</p></article>
   {state.answer&&<p data-demo-system-ai-answer className="rounded-xl border p-3 text-sm md:col-span-2">{state.answer}</p>}
  </section>}
  {current&&<section data-demo-system-operation={current.id} className="space-y-3 rounded-xl border border-violet-500/50 p-4"><p className="text-xs font-bold uppercase text-violet-500">{T(l,"Voer de volgende functie echt uit in de demo","Perform the next function in the demo","Effectuez la fonction suivante dans la démo","Führe die nächste Funktion in der Demo aus")}</p><h2 className="font-bold">{current.title[l]}</h2>{input()}<button type="button" data-training-practical-op={current.id} disabled={!hydrated} onClick={submit} className="w-full rounded-xl bg-violet-600 px-4 py-3 font-bold text-white disabled:opacity-50">{current.title[l]}</button>{error&&<p role="alert" className="text-sm text-rose-500">{error}</p>}</section>}
  <details className="rounded-xl border p-3"><summary className="cursor-pointer font-bold">{T(l,"Controlelog van fictieve handelingen","Fictional action audit trail","Journal d’actions fictives","Protokoll fiktiver Aktionen")} · {state.audit.length}</summary><ol data-demo-system-audit-count={state.audit.length} className="mt-2 space-y-1 text-sm">{state.audit.map((entry,i)=><li key={i}>{entry}</li>)}</ol></details>
 </main>
}
