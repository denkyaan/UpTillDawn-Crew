"use client"

import {useEffect,useMemo,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {getTrainingOperations} from "@/lib/training-exercise-catalog"
import type {TourRole} from "@/lib/tour-training"

type State={audit:string[];name:string;search:string;filter:string;listName:string;newGuest:string;guestType:string;spots:number;importFile:string;arrived:boolean;backstage:boolean;duplicatesReviewed:boolean;messages:string[];source:string}
const fresh=():State=>({audit:[],name:"DJ Nova",search:"",filter:"",listName:"",newGuest:"",guestType:"guest",spots:2,importFile:"",arrived:false,backstage:false,duplicatesReviewed:false,messages:[],source:"manual"})
const T=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
const key=(role:TourRole)=>"uptilldawn-guestlist-training-v1:"+role
function load(role:TourRole):State{try{const state=JSON.parse(sessionStorage.getItem(key(role))||"null") as State|null;if(state&&Array.isArray(state.audit)&&Array.isArray(state.messages))return state}catch{}return fresh()}
export function SandboxGuestlistTraining({role}:{role:string}){
 const trainingRole:TourRole=role==="admin"?"admin":role==="responsible_lead"?"responsible_lead":"employee"
 const [l,setL]=useState<SupportedUiLocale>("nl")
 const [currentId,setCurrentId]=useState("")
 const [data,setData]=useState<State>(fresh)
 const [text,setText]=useState("")
 const [choice,setChoice]=useState("")
 const [category,setCategory]=useState("")
 const [error,setError]=useState("")
 const [ready,setReady]=useState(false)
 const actions=useMemo(()=>getTrainingOperations(trainingRole,"guestlist"),[trainingRole])
 const current=actions.find(a=>a.id===currentId)
 const group=current?.id.split(":")[1]
 const idx=current?Number(current.id.split(":").at(-1)):-1
 useEffect(()=>{const apply=()=>setL(activeUiLocale());apply();addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 useEffect(()=>{const frame=requestAnimationFrame(()=>{setData(load(trainingRole));setReady(true)});return()=>cancelAnimationFrame(frame)},[trainingRole])
 useEffect(()=>{const sync=()=>{const v=document.querySelector('[data-training-lab] [data-training-operation]')?.getAttribute("data-training-operation")||"";setCurrentId(old=>old===v?old:v)};sync();const observer=new MutationObserver(sync);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["data-training-operation"]});return()=>observer.disconnect()},[])
 const fail=()=>setError(T(l,"Vul alle vereiste gegevens in en volg de stappen op volgorde.","Complete all required fields in order.","Complétez tous les champs obligatoires dans l’ordre.","Fülle alle Pflichtfelder in der richtigen Reihenfolge aus."))
 const options=():{id:string;name:string}[]=>{
  if(current?.kind==="upload")return [{id:"training-guestlist.csv",name:"training-guestlist.csv"},{id:"training-guestlist.pdf",name:"training-guestlist.pdf"}]
  return [{id:"artist",name:T(l,"Artiest","Artist","Artiste","Künstler")},{id:"guest",name:T(l,"Gast","Guest","Invité","Gast")}]
 }
 const record=()=>{
  if(!ready||!current)return
  const next:State={...data,audit:[...data.audit],messages:[...data.messages]}
  let value="reviewed"
  if(current.kind==="write"){
   if(text.trim().length<3)return fail()
   value=text.trim()
   if(group==="shared"&&idx===1||group==="employee"&&idx===0){if(!/nova/i.test(value))return fail();next.search=value}
   if(group==="admin"&&idx===1)next.newGuest=value
  }else if(current.kind==="select"||current.kind==="upload"){
   if(!choice)return fail()
   value=choice
   if(current.kind==="upload"){next.importFile=value;next.source="manual+import"}
   else if(group==="shared"&&idx===2)next.filter=value
   else if(group==="admin"&&idx===2)next.guestType=value
  }else if(current.kind==="number"){
   const n=Number(text)
   if(!Number.isSafeInteger(n)||n<=0||n>20)return fail()
   next.spots=n;value=String(n)
  }else if(current.kind==="form"){
   if(text.trim().length<5||!category)return fail()
   value=text.trim()+" · "+category;next.listName=text.trim()
  }else if(current.kind==="message"){
   if(text.trim().length<8)return fail()
   value=text.trim();next.messages.push(value)
  }else if(current.kind==="toggle"){
   value="confirmed"
   if(group==="shared"&&idx===4){
    if(!next.search||next.filter!=="artist")return fail()
    next.arrived=true;next.backstage=true
   }
   if(group==="employee"&&idx===1&&!next.arrived)return fail()
  }else if(current.kind==="inspect"){
   if(group==="shared"&&idx===5&&!next.backstage)return fail()
   if(group==="admin"&&idx===5)next.duplicatesReviewed=true
  }else return
  next.audit.push(current.id+" · "+value)
  sessionStorage.setItem(key(trainingRole),JSON.stringify(next));setData(next);setText("");setChoice("");setCategory("");setError("")
  dispatchEvent(new CustomEvent("uptilldawn-training-practical-action",{detail:{role:trainingRole,chapter:"guestlist",id:current.id,kind:current.kind,value}}))
 }
 return <main data-tour-demo="training-screen" data-training-guestlist="true" className="mx-auto max-w-6xl space-y-5 p-4 pb-28 md:p-8">
  <header><p className="text-xs font-black uppercase text-violet-500">{T(l,"FICTIEVE INKOM & BACKSTAGE","FICTIONAL ENTRANCE & BACKSTAGE","ENTRÉE ET COULISSES FICTIVES","FIKTIVER EINGANG & BACKSTAGE")}</p><h1 className="text-2xl font-black">{T(l,"Doorzoekbare gastenlijst","Searchable guest list","Liste d’invités consultable","Durchsuchbare Gästeliste")}</h1><p className="text-sm text-muted-foreground">{T(l,"Alle gasten en meldingen blijven in de demobrowser.","All guests and notifications stay in the demo browser.","Tous les invités et messages restent dans cette démo.","Alle Gäste und Meldungen bleiben im Demobrowser.")}</p></header>
  <section className="grid gap-3 sm:grid-cols-2">
   <article className="rounded-xl border p-4" data-demo-guestlist-list><h2 className="font-black">{data.listName||T(l,"UpTillDawn Trainingsavond","UpTillDawn Training Night","Soirée UpTillDawn","UpTillDawn Trainingsabend")}</h2><p>{data.name} · {T(l,"Artiest","Artist","Artiste","Künstler")} · {data.spots} {T(l,"guestspots","guest spots","places invités","Gästeplätze")}</p><p className="text-sm">{T(l,"Aangekomen","Arrived","Arrivé","Angekommen")}: <strong data-demo-guestlist-arrivals>{data.arrived?data.spots:0}/{data.spots}</strong></p><p className="text-sm">{T(l,"Gezocht","Searched","Recherche","Gesucht")}: {data.search||"—"} · {T(l,"Filter","Filter","Filtre","Filter")}: {data.filter||"—"}</p>{data.newGuest&&<p className="text-sm">{data.newGuest} · {data.guestType}</p>}<p className="text-sm">{T(l,"Invoer","Input source","Source","Datenquelle")}: {data.source}</p></article>
   <article className="rounded-xl border p-4"><h2 className="font-black">Backstage Management</h2><p>{data.backstage?T(l,"DJ Nova aangekomen: Backstage verwittigd (demo).","DJ Nova arrived: Backstage notified (demo).","DJ Nova arrivé : Backstage averti (démo).","DJ Nova angekommen: Backstage informiert (Demo)."):T(l,"DJ Nova nog verwacht","DJ Nova still expected","DJ Nova attendu","DJ Nova wird erwartet")}</p><p className="text-sm">{T(l,"Importbestand","Import file","Fichier importé","Importdatei")}: {data.importFile||"—"}</p><p className="text-sm">{T(l,"Duplicaten gecontroleerd","Duplicates reviewed","Doublons vérifiés","Duplikate geprüft")}: {data.duplicatesReviewed?"✓":"—"}</p>{data.messages.map((msg,i)=><p className="mt-2 border-t pt-2 text-sm" key={i}>{msg}</p>)}</article>
  </section>
  {current&&<section data-demo-guestlist-operation={current.id} className="space-y-3 rounded-xl border border-violet-500/50 p-4"><h2 className="font-black">{current.title[l]}</h2><p className="text-sm">{current.help[l]}</p>
   {(current.kind==="write"||current.kind==="form"||current.kind==="number"||current.kind==="message")&&<label className="grid gap-2 text-sm font-bold">{current.title[l]}{current.kind==="message"?<textarea data-demo-guestlist-input rows={3} value={text} onChange={e=>setText(e.target.value)} className="rounded-lg border bg-background p-3"/>:<input data-demo-guestlist-input type={current.kind==="number"?"number":"text"} min={current.kind==="number"?1:undefined} value={text} onChange={e=>setText(e.target.value)} className="rounded-lg border bg-background p-3"/>}</label>}
   {current.kind==="form"&&<label className="grid gap-2 text-sm font-bold">{T(l,"Lijsttype","List type","Type de liste","Listenart")}<select data-demo-guestlist-category value={category} onChange={e=>setCategory(e.target.value)} className="rounded-lg border bg-background p-3"><option value="">{T(l,"Selecteer","Select","Sélectionner","Auswählen")}</option><option value="artist">{T(l,"Artiesten","Artists","Artistes","Künstler")}</option><option value="guest">{T(l,"Gasten","Guests","Invités","Gäste")}</option></select></label>}
   {(current.kind==="select"||current.kind==="upload")&&<label className="grid gap-2 text-sm font-bold">{T(l,"Kies optie","Choose option","Choisir","Option wählen")}<select data-demo-guestlist-select value={choice} onChange={e=>setChoice(e.target.value)} className="rounded-lg border bg-background p-3"><option value="">{T(l,"Selecteer","Select","Sélectionner","Auswählen")}</option>{options().map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
   <button type="button" data-training-practical-op={current.id} disabled={!ready} onClick={record} className="w-full rounded-xl bg-violet-600 p-3 font-black text-white disabled:opacity-40">{current.title[l]}</button>{error&&<p role="alert" className="text-sm text-red-500">{error}</p>}
  </section>}
  <details className="rounded-xl border p-3"><summary className="cursor-pointer font-bold">{T(l,"Controlelog","Audit trail","Journal d’audit","Prüfprotokoll")} · {data.audit.length}</summary><ol data-demo-guestlist-audit-count={data.audit.length} className="mt-2 space-y-1 text-sm">{data.audit.map((x,i)=><li key={i}>{x}</li>)}</ol></details>
 </main>
}
