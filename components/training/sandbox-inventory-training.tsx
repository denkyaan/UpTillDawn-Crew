"use client"

import {useEffect,useMemo,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {getTrainingOperations} from "@/lib/training-exercise-catalog"
import type {TourRole} from "@/lib/tour-training"

type InventoryState={audit:string[];category:string;newItem:string;quantity:number;workplace:string;condition:string;photo:string;document:string;opening:boolean;closing:boolean;reports:string[]}
const initial=():InventoryState=>({audit:[],category:"",newItem:"",quantity:24,workplace:"bar",condition:"ok",photo:"training-stock.png",document:"training-equipment.pdf",opening:false,closing:false,reports:[]})
const T=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
const key=(role:TourRole)=>"uptilldawn-inventory-training-v1:"+role
function restore(role:TourRole){try{const x=JSON.parse(sessionStorage.getItem(key(role))||"null") as InventoryState|null;if(x&&Array.isArray(x.audit)&&Array.isArray(x.reports))return x}catch{}return initial()}
export function SandboxInventoryTraining({role}:{role:string}){
 const trainingRole:TourRole=role==="admin"?"admin":role==="responsible_lead"?"responsible_lead":"employee"
 const [locale,setLocale]=useState<SupportedUiLocale>("nl")
 const [operation,setOperation]=useState("")
 const [data,setData]=useState<InventoryState>(initial)
 const [text,setText]=useState("")
 const [selected,setSelected]=useState("")
 const [category,setCategory]=useState("")
 const [error,setError]=useState("")
 const [ready,setReady]=useState(false)
 const actions=useMemo(()=>getTrainingOperations(trainingRole,"inventory"),[trainingRole])
 const current=actions.find(x=>x.id===operation)
 const group=current?.id.split(":")[1]
 const idx=current?Number(current.id.split(":").at(-1)):-1
 useEffect(()=>{const f=()=>setLocale(activeUiLocale());f();addEventListener(LANGUAGE_APPLIED_EVENT,f);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,f)},[])
 useEffect(()=>{const f=requestAnimationFrame(()=>{setData(restore(trainingRole));setReady(true)});return()=>cancelAnimationFrame(f)},[trainingRole])
 useEffect(()=>{const sync=()=>{const id=document.querySelector('[data-training-lab] [data-training-operation]')?.getAttribute("data-training-operation")||"";setOperation(v=>v===id?v:id)};sync();const observer=new MutationObserver(sync);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["data-training-operation"]});return()=>observer.disconnect()},[])
 const fail=()=>setError(T(locale,"Vul eerst de verplichte gegevens in.","Complete the required fields first.","Complétez d’abord les informations nécessaires.","Fülle zuerst die erforderlichen Angaben aus."))
 const categoryOptions=[
  {id:"stock",text:T(locale,"Voorraad","Stock","Stock","Bestand")},
  {id:"equipment",text:T(locale,"Materiaal","Equipment","Matériel","Ausrüstung")},
  {id:"security",text:T(locale,"Veiligheid","Safety","Sécurité","Sicherheit")}
 ]
 const options=():{id:string;label:string}[]=>{
  if(current?.kind==="upload")return idx===4?[{id:"training-stock.png",label:"training-stock.png"}]:[{id:"training-equipment.pdf",label:"training-equipment.pdf"}]
  if(group==="admin"&&idx===3)return [{id:"bar",label:"Bar / Toog"},{id:"merch",label:"Merch"},{id:"tokens",label:"Tokens"}]
  if(group==="responsible_lead"&&idx===1||group==="shared"&&idx===4)return [{id:"damaged",label:T(locale,"Beschadigd","Damaged","Endommagé","Beschädigt")},{id:"missing",label:T(locale,"Ontbreekt","Missing","Manquant","Fehlt")},{id:"ok",label:T(locale,"In orde","OK","Conforme","In Ordnung")}]
  return [{id:"bar",label:"Bar / Toog"},{id:"merch",label:"Merch"}]
 }
 const record=()=>{
  if(!ready||!current)return
  const next:InventoryState={...data,audit:[...data.audit],reports:[...data.reports]}
  let value="reviewed"
  if(current.kind==="form"){
   if(text.trim().length<4||!category)return fail()
   value=text.trim()+" · "+category
   if(group==="admin"&&idx===0)next.category=text.trim()
   if(group==="admin"&&idx===1)next.newItem=text.trim()
  }else if(current.kind==="select"||current.kind==="upload"){
   if(!selected)return fail()
   value=selected
   if(current.kind==="upload"&&group==="admin"){if(idx===4)next.photo=selected;if(idx===5)next.document=selected}
   if(current.kind==="select"){
    if(group==="admin"&&idx===3)next.workplace=selected
    else next.condition=selected
   }
  }else if(current.kind==="number"){
   const n=Number(text)
   if(!Number.isSafeInteger(n)||n<1||n>10000)return fail()
   next.quantity=n;value=String(n)
  }else if(current.kind==="message"){
   if(text.trim().length<8)return fail()
   next.reports.push(text.trim());value=text.trim()
  }else if(current.kind==="toggle"){
   value="confirmed"
   if(group==="shared"&&idx===3)next.opening=true
   if(group==="shared"&&idx===6){if(!next.opening)return fail();next.closing=true}
   if(group==="responsible_lead"&&idx===3)next.opening=true
   if(group==="responsible_lead"&&idx===4){if(!next.opening)return fail();next.closing=true}
  }
  next.audit.push(current.id+" · "+value)
  sessionStorage.setItem(key(trainingRole),JSON.stringify(next));setData(next);setText("");setSelected("");setCategory("");setError("")
  dispatchEvent(new CustomEvent("uptilldawn-training-practical-action",{detail:{role:trainingRole,chapter:"inventory",id:current.id,kind:current.kind,value}}))
 }
 return <main data-tour-demo="training-screen" data-training-inventory="true" className="mx-auto max-w-6xl space-y-5 p-4 pb-28 md:p-8">
  <header><p className="text-xs font-black uppercase text-violet-500">{T(locale,"FICTIEVE MATERIAALCONTROLE","FICTIONAL EQUIPMENT INSPECTION","CONTRÔLE DE MATÉRIEL FICTIF","FIKTIVE MATERIALKONTROLLE")}</p><h1 className="text-2xl font-black">{T(locale,"Inventaris per werkplek","Inventory by workplace","Inventaire par poste","Inventar pro Arbeitsplatz")}</h1><p className="text-sm text-muted-foreground">{T(locale,"Een eigen trainingsoverzicht, zonder echte inventaris te wijzigen.","Your own training ledger; no production inventory is changed.","Registre de formation distinct ; aucun inventaire réel n’est modifié.","Eigenes Trainingsprotokoll ohne Änderungen am echten Inventar.")}</p></header>
  <div className="grid gap-3 sm:grid-cols-2" data-demo-inventory-dashboard>
   <article className="rounded-xl border p-4"><h2 className="font-bold">{T(locale,"Werkplek","Workplace","Poste","Arbeitsplatz")}: {data.workplace==="bar"?"Bar / Toog":data.workplace}</h2><p>{data.newItem||T(locale,"Waterflesjes","Water bottles","Bouteilles d’eau","Wasserflaschen")}: <strong data-demo-inventory-quantity>{data.quantity}</strong></p><p className="text-sm">{T(locale,"Categorie","Category","Catégorie","Kategorie")}: {data.category||"stock"}</p><p className="text-sm">{T(locale,"Staat","Condition","État","Zustand")}: <strong>{data.condition}</strong></p></article>
   <article className="rounded-xl border p-4"><h2 className="font-bold">{T(locale,"Foto's en documenten","Photos and documents","Photos et documents","Fotos und Dokumente")}</h2><p>{data.photo} · {data.document}</p><p className="text-sm">{T(locale,"Opstartcheck","Opening check","Contrôle d’ouverture","Startkontrolle")}: {data.opening?"✓":"—"} · {T(locale,"Afsluitcheck","Closing check","Contrôle de fermeture","Abschlusskontrolle")}: {data.closing?"✓":"—"}</p><p className="text-sm">{T(locale,"Gemelde tekorten","Shortages reported","Manques signalés","Gemeldete Fehlbestände")}: {data.reports.length}</p></article>
  </div>
  <section className="rounded-xl border p-4"><h2 className="font-bold">{T(locale,"Wekelijks inventarisoverzicht","Weekly inventory review","Revue hebdomadaire de l’inventaire","Wöchentliche Inventarübersicht")}</h2><p className="text-sm">{T(locale,"Deze lijst synchroniseert in de training met de toegewezen werkplek, inclusief schade en tekorten.","This training list follows the assigned workplace, including damage and shortages.","Cette liste de formation suit le poste attribué, les dégâts et les manques.","Diese Trainingsliste folgt dem zugewiesenen Arbeitsplatz sowie Schäden und Fehlbeständen.")}</p>{data.reports.map((report,i)=><p key={i} className="mt-2 border-t pt-2 text-sm">{report}</p>)}</section>
  {current&&<section data-demo-inventory-operation={current.id} className="space-y-3 rounded-xl border border-violet-500/50 p-4"><h2 className="font-black">{current.title[locale]}</h2><p className="text-sm">{current.help[locale]}</p>
   {(current.kind==="form"||current.kind==="number"||current.kind==="message")&&<label className="grid gap-2 text-sm font-bold">{current.title[locale]}
    {current.kind==="message"?<textarea data-demo-inventory-input value={text} onChange={e=>setText(e.target.value)} rows={3} className="rounded-lg border bg-background p-3"/>:<input data-demo-inventory-input type={current.kind==="number"?"number":"text"} min={current.kind==="number"?1:undefined} value={text} onChange={e=>setText(e.target.value)} className="rounded-lg border bg-background p-3"/>}</label>}
   {current.kind==="form"&&<label className="grid gap-2 text-sm font-bold">{T(locale,"Materiaalgroep","Inventory group","Groupe de matériel","Materialgruppe")}<select data-demo-inventory-category value={category} onChange={e=>setCategory(e.target.value)} className="rounded-lg border bg-background p-3"><option value="">{T(locale,"Selecteer","Select","Sélectionner","Auswählen")}</option>{categoryOptions.map(x=><option key={x.id} value={x.id}>{x.text}</option>)}</select></label>}
   {(current.kind==="select"||current.kind==="upload")&&<label className="grid gap-2 text-sm font-bold">{current.title[locale]}<select data-demo-inventory-select value={selected} onChange={e=>setSelected(e.target.value)} className="rounded-lg border bg-background p-3"><option value="">{T(locale,"Selecteer","Select","Sélectionner","Auswählen")}</option>{options().map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>}
   <button type="button" data-training-practical-op={current.id} disabled={!ready} onClick={record} className="w-full rounded-xl bg-violet-600 p-3 font-black text-white disabled:opacity-40">{current.title[locale]}</button>
   {error&&<p role="alert" className="text-sm text-red-500">{error}</p>}
  </section>}
  <details className="rounded-xl border p-3"><summary className="cursor-pointer font-bold">{T(locale,"Controlelog","Audit trail","Journal d’audit","Prüfprotokoll")} · {data.audit.length}</summary><ol data-demo-inventory-audit-count={data.audit.length} className="mt-2 space-y-1 text-sm">{data.audit.map((x,i)=><li key={i}>{x}</li>)}</ol></details>
 </main>
}
