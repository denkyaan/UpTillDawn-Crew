"use client"
import {useEffect,useMemo,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {getTrainingOperations,type PracticeOperation} from "@/lib/training-exercise-catalog"
import type {TourRole} from "@/lib/tour-training"

type Mode="crew"|"personnel"
type Member={id:string;name:string;role:TourRole;workplace:string;blocked:boolean;verified:boolean;status:"pending"|"approved"|"rejected";available:boolean}
type Audit={action:string;person:string;result:string}
type Data={members:Member[];audit:Audit[];notice:string;verifiedResent:boolean;portalDenied:boolean}
const initial=():Data=>({members:[
 {id:"lina",name:"Lina Peeters",role:"employee",workplace:"Bar / Toog",blocked:false,verified:true,status:"pending",available:true},
 {id:"noah",name:"Noah Jacobs",role:"responsible_lead",workplace:"Bar / Toog",blocked:false,verified:true,status:"approved",available:true},
 {id:"mila",name:"Mila Vermeulen",role:"employee",workplace:"Tokens",blocked:false,verified:false,status:"pending",available:false}
 ],audit:[],notice:"",verifiedResent:false,portalDenied:false})
const text=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
const roleLabel=(l:SupportedUiLocale,role:TourRole)=>role==="admin"?"Admin":role==="responsible_lead"?text(l,"Verantwoordelijke","Responsible lead","Responsable","Verantwortlich"):text(l,"Personeel","Staff","Personnel","Personal")
const statusLabel=(l:SupportedUiLocale,status:Member["status"])=>status==="approved"?text(l,"Goedgekeurd","Approved","Approuvé","Genehmigt"):status==="rejected"?text(l,"Afgewezen","Rejected","Refusé","Abgelehnt"):text(l,"In behandeling","Pending","En attente","Ausstehend")
const keyFor=(role:TourRole,mode:Mode)=>"uptilldawn-people-training-v1:"+role+":"+mode
function read(key:string):Data{
 try{const v=JSON.parse(sessionStorage.getItem(key)||"null");if(v&&Array.isArray(v.members)&&Array.isArray(v.audit))return v}catch{}
 return initial()
}
export function SandboxPeopleTraining({role,module}:{role:string;module:Mode}){
 const trainingRole:TourRole=role==="admin"?"admin":role==="responsible_lead"?"responsible_lead":"employee"
 const [language,setLanguage]=useState<SupportedUiLocale>("nl")
 const [currentId,setCurrentId]=useState("")
 const [data,setData]=useState<Data>(initial)
 const [search,setSearch]=useState("")
 const [selection,setSelection]=useState("employee")
 const [message,setMessage]=useState("")
 const [confirm,setConfirm]=useState("")
 const [error,setError]=useState("")
 const [hydrated,setHydrated]=useState(false)
 const steps=useMemo(()=>getTrainingOperations(trainingRole,module),[module,trainingRole])
 const current:PracticeOperation|undefined=steps.find(x=>x.id===currentId)
 const idx=current?Number(current.id.split(":").at(-1)):-1
 const group=current?.id.split(":")[1]
 const key=keyFor(trainingRole,module)
 useEffect(()=>{
  const apply=()=>setLanguage(activeUiLocale())
  apply();addEventListener(LANGUAGE_APPLIED_EVENT,apply)
  return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)
 },[])
 useEffect(()=>{
  const frame=requestAnimationFrame(()=>{setData(read(key));setHydrated(true)})
  return()=>cancelAnimationFrame(frame)
 },[key])
 useEffect(()=>{
  const sync=()=>{
   const active=document.querySelector('[data-training-lab] [data-training-operation]')?.getAttribute("data-training-operation")||""
   setCurrentId(old=>old===active?old:active)
  }
  sync()
  const observer=new MutationObserver(sync)
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["data-training-operation"]})
  return()=>observer.disconnect()
 },[])
 const write=(next:Data,value:string)=>{
  if(!hydrated||!current||!value.trim())return
  if(current.kind==="message"&&value.trim().length<5)return
  sessionStorage.setItem(key,JSON.stringify(next));setData(next);setError("");setMessage("");setConfirm("")
  dispatchEvent(new CustomEvent("uptilldawn-training-practical-action",{
   detail:{role:trainingRole,chapter:module,id:current.id,kind:current.kind,value}
  }))
 }
 const submit=()=>{
  if(!current)return
  const next:Data={...data,members:data.members.map(p=>({...p})),audit:[...data.audit]}
  const audit=(person:string,result:string)=>{
   next.audit.push({action:current.title[language],person,result})
  }
  const lina=next.members.find(p=>p.id==="lina")
  const mila=next.members.find(p=>p.id==="mila")
  if(module==="personnel"){
   if(idx===2&&lina){lina.role=selection as TourRole;audit(lina.name,selection);write(next,selection);return}
   if(idx===3&&lina){lina.status="approved";next.notice=text(language,"Lina Peeters: account goedgekeurd","Lina Peeters: account approved","Lina Peeters : compte approuvé","Lina Peeters: Konto genehmigt");audit(lina.name,"approved");write(next,"confirmed");return}
   if(idx===5){
    if(message.trim().length<5){setError(text(language,"Beschrijf welke gegevens ontbreken.","Describe the missing details.","Décrivez les données manquantes.","Beschreibe die fehlenden Daten."));return}
    next.notice=message.trim();audit("Mila Vermeulen","Missing details requested");write(next,message.trim());return
   }
   if(idx===6&&mila){mila.status="rejected";audit(mila.name,"rejected with outstanding information request");write(next,"confirmed");return}
   if(idx===8){next.verifiedResent=true;audit("Mila Vermeulen","Verification resent (demo)");write(next,"confirmed");return}
   if(idx===9){next.portalDenied=true;audit("Mila Vermeulen","Wrong portal access denied");write(next,"reviewed");return}
   write(next,"reviewed");return
  }
  if(group==="shared"){
   if(idx===1){
    if(!next.members.some(p=>p.name.toLowerCase().includes(search.trim().toLowerCase()))||search.trim().length<2){setError(text(language,"Zoek een bestaande demomedewerker.","Find an existing demo employee.","Cherchez un membre démo existant.","Suche einen Demo-Mitarbeiter."));return}
    write(next,search.trim());return
   }
   write(next,"reviewed");return
  }
  if(group==="admin"){
   if(idx===0&&lina){lina.role=selection as TourRole;audit(lina.name,"Role: "+selection);write(next,selection);return}
   if(idx===1&&lina){lina.blocked=true;audit(lina.name,"blocked");write(next,"confirmed");return}
   if(idx===2&&lina){lina.blocked=false;audit(lina.name,"unblocked");write(next,"confirmed");return}
   if(idx===3&&lina){lina.workplace=selection;audit(lina.name,"Workplace: "+selection);write(next,selection);return}
   if(idx===5){
    if(message.trim().length<5){setError(text(language,"Schrijf een personeelsbericht.","Write a staff message.","Écrivez un message.","Schreibe eine Personalnachricht."));return}
    next.notice=message.trim();audit("Demo crew","Notification sent");write(next,message.trim());return
   }
   if(idx===6){
    if(confirm!=="DEMO"){setError(text(language,"Typ DEMO om alleen het fictieve account te verwijderen.","Type DEMO to delete only the fictional account.","Saisissez DEMO pour supprimer uniquement le compte fictif.","Tippe DEMO, um nur das fiktive Konto zu löschen."));return}
    next.members=next.members.filter(p=>p.id!=="mila")
    audit("Mila Vermeulen","Demo account deleted (no production mutation)")
    write(next,"DEMO");return
   }
   write(next,"reviewed");return
  }
  if(group==="responsible_lead"&&idx===1){
   if(message.trim().length<5){setError(text(language,"Schrijf je ploegbericht.","Write a team message.","Rédigez le message.","Schreibe eine Teamnachricht."));return}
   next.notice=message.trim();audit("Own workplace","Lead message");write(next,message.trim());return
  }
  write(next,"reviewed")
 }
 const control=()=>{
  if(!current)return null
  if(current.kind==="select"){
   const options=current.id==="crew:admin:3"
    ?[{value:"Bar / Toog",label:"Bar / Toog"},{value:"Tokens",label:"Tokens"},{value:"Merch",label:"Merch"}]
    :[{value:"employee",label:text(language,"Personeel","Staff","Personnel","Personal")},{value:"responsible_lead",label:text(language,"Verantwoordelijke","Responsible lead","Responsable","Verantwortlich")},{value:"admin",label:"Admin"}]
   return <label className="grid gap-2 text-sm font-semibold">{current.title[language]}<select data-demo-people-select value={selection} onChange={e=>setSelection(e.target.value)} className="rounded-lg border bg-background p-3">{options.map(o=><option value={o.value} key={o.value}>{o.label}</option>)}</select></label>
  }
  if(current.kind==="write")return <label className="grid gap-2 text-sm font-semibold">{current.title[language]}<input data-demo-people-search value={search} onChange={e=>setSearch(e.target.value)} placeholder={text(language,"Lina","Lina","Lina","Lina")} className="rounded-lg border bg-background p-3"/></label>
  if(current.kind==="message")return <label className="grid gap-2 text-sm font-semibold">{current.title[language]}<textarea data-demo-people-message value={message} onChange={e=>setMessage(e.target.value)} rows={3} className="rounded-lg border bg-background p-3" placeholder={text(language,"Bericht aan fictieve medewerker","Message to fictional employee","Message à un employé fictif","Nachricht an fiktiven Mitarbeiter")}/></label>
  if(current.kind==="delete")return <label className="grid gap-2 text-sm font-semibold">{text(language,"Typ DEMO om verwijderen van een fictief account te testen","Type DEMO to test fictional account deletion","Saisir DEMO pour tester la suppression d’un compte fictif","DEMO für fiktive Kontolöschung eingeben")}<input data-demo-people-confirm value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder={text(language,"DEMO","DEMO","DEMO","DEMO")} className="rounded-lg border bg-background p-3"/></label>
  return <p className="text-sm text-muted-foreground">{current.help[language]}</p>
 }
 return <main data-tour-demo="training-screen" data-training-people={module} className="mx-auto max-w-6xl space-y-5 p-4 pb-28 md:p-8">
  <header><p className="text-xs font-bold uppercase text-violet-500">{text(language,"TRAINING · fictieve accounts","TRAINING · fictional accounts","FORMATION · comptes fictifs","TRAINING · fiktive Konten")}</p><h1 className="mt-1 text-2xl font-black">{module==="personnel"?text(language,"Registraties en goedkeuringen","Registration and approvals","Inscriptions et approbations","Registrierung und Freigaben"):text(language,"Personeel en rechten","Staff and permissions","Personnel et droits","Personal und Rechte")}</h1><p className="text-sm text-muted-foreground">{text(language,"Alle wijzigingen blijven lokaal in deze demo en raken geen echte accounts.","All changes stay inside this demo, never real user accounts.","Toutes les modifications restent dans cette démo.","Alle Änderungen bleiben nur in dieser Demo.")}</p></header>
  <section className="grid gap-3 md:grid-cols-3">{data.members.map(person=><article key={person.id} className="rounded-xl border p-4"><h2 className="font-bold">{person.name}</h2><p className="mt-2 text-sm">{roleLabel(language,person.role)} · {person.workplace}</p><p className="text-xs text-muted-foreground">{statusLabel(language,person.status)} · {person.verified?text(language,"e-mail geverifieerd","email verified","e-mail vérifié","E-Mail verifiziert"):text(language,"e-mail niet geverifieerd","email unverified","e-mail non vérifié","E-Mail nicht verifiziert")}</p><p className="mt-1 text-xs">{person.blocked?text(language,"GEBLOKKEERD","BLOCKED","BLOQUÉ","GESPERRT"):text(language,"Toegang volgens rol","Role-scoped access","Accès selon le rôle","Rollengebundener Zugriff")}</p></article>)}</section>
  <section className="rounded-xl border border-violet-500/40 p-4"><h2 className="font-semibold">{text(language,"Makeraccount beschermd","Maker account protected","Compte créateur protégé","Erstellerkonto geschützt")}</h2><p className="mt-1 text-sm text-muted-foreground">{text(language,"De maker kan in deze oefening niet geblokkeerd of verwijderd worden.","The maker cannot be blocked or deleted in this exercise.","Le créateur ne peut être ni bloqué ni supprimé.","Der Ersteller kann hier nicht gesperrt oder gelöscht werden.")}</p></section>
  {current&&<section className="space-y-3 rounded-xl border p-4" data-demo-people-operation={current.id}><p className="text-xs font-bold uppercase text-violet-500">{text(language,"Actieve echte demohandeling","Active demo operation","Action démo active","Aktive Demoaktion")}</p><h3 className="font-bold">{current.title[language]}</h3>{control()}<button type="button" data-training-practical-op={current.id} disabled={!hydrated} onClick={submit} className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{current.title[language]}</button>{error&&<p role="alert" className="text-sm text-rose-500">{error}</p>}</section>}
  {data.notice&&<article className="rounded-xl border p-3 text-sm"><strong>{text(language,"Laatste melding","Latest notification","Dernière notification","Letzte Benachrichtigung")}</strong><p>{data.notice}</p></article>}
  <details className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">{text(language,"Auditlog van de demo","Demo audit trail","Journal d’audit de la démo","Demo-Auditprotokoll")} · {data.audit.length}</summary><ol data-demo-people-audit-count={data.audit.length} className="mt-3 space-y-2 text-sm">{data.audit.map((entry,i)=><li key={i} className="rounded-lg border p-2">{entry.person}: {entry.result} — {entry.action}</li>)}</ol></details>
  {data.portalDenied&&<p data-demo-people-access-denied className="rounded-xl border p-3 text-sm">{text(language,"Foutieve portaalrol: toegang geweigerd (simulatie).","Wrong portal role: access denied (simulation).","Mauvais rôle : accès refusé (simulation).","Falsche Portalrolle: Zugriff verweigert (Simulation).")}</p>}
 </main>
}
