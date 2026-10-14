"use client"

import {useEffect,useMemo,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {getTrainingOperations} from "@/lib/training-exercise-catalog"

type State={audit:string[];merchCents:number;tillCents:number;tokenCents:number;merchSold:number;tokensSold:number;reconciled:boolean;discrepancyCents:number;exportReady:boolean}
const initial=():State=>({audit:[],merchCents:38450,tillCents:65000,tokenCents:25000,merchSold:0,tokensSold:0,reconciled:false,discrepancyCents:0,exportReady:false})
const KEY="uptilldawn-sales-training-v1:admin"
const T=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
const money=(v:number)=>new Intl.NumberFormat("nl-BE",{style:"currency",currency:"EUR"}).format(v/100)
const explanations=[
 ["Open de eventbalans. Enkel Merch, Kassa en Tokens zijn inkomstenbronnen; pauzes en werkuren zijn geen omzet.","Open the event ledger. Only Merch, Till and Tokens are revenue sources; breaks and work hours are not sales.","Ouvrez le bilan : seuls Merch, Caisse et Jetons sont des recettes.","Öffne die Eventbilanz. Nur Merch, Kasse und Tokens sind Einnahmequellen."],
 ["De Merch-kolom bevat producten en aantallen. Vergelijk elke verkoop met de prijslijst.","Merch revenue lists products and quantities. Match each sale to its price list.","Les ventes Merch indiquent produits et quantités. Comparez les prix.","Merch-Verkäufe enthalten Artikel und Mengen. Prüfe die Preisliste."],
 ["De kassa toont enkel werkelijk geïnde bedragen. Vergelijk de getelde kas met het verkooptotaal.","The till shows collected payments. Reconcile counted cash against recorded sales.","La caisse comprend uniquement les paiements encaissés. Rapprochez le comptage.","Die Kasse zeigt vereinnahmte Zahlungen. Gleiche Bargeld und Verkäufe ab."],
 ["Tokenverkopen zijn apart zichtbaar, maar tellen slechts één keer mee in het eventtotaal.","Token sales are reported separately but counted only once in total event revenue.","Les jetons sont affichés séparément et comptés une seule fois.","Tokenumsatz wird separat ausgewiesen und nur einmal summiert."],
 ["Voer het aantal verkochte T-shirts in. In deze fictieve prijslijst kost één shirt €12.","Enter the number of T-shirts sold. In this fictional price list each shirt costs €12.","Saisissez le nombre de T-shirts vendus. Un T-shirt fictif coûte 12 €.","Trage die Anzahl verkaufter T-Shirts ein. Jedes kostet fiktiv 12 €."],
 ["Voer het aantal tokenbundels in. Eén fictieve bundel kost €8.","Enter the number of token bundles sold. Each fictional bundle costs €8.","Saisissez le nombre de lots de jetons. Chaque lot fictif coûte 8 €.","Trage die Anzahl der Tokenpakete ein. Jedes kostet fiktiv 8 €."],
 ["Controleer dat Merch + Kassa + Tokens gelijk zijn aan de evenementomzet. Nieuwe verkopen moeten in de som staan.","Check that Merch + Till + Tokens equals the event total, including both new sales.","Vérifiez la somme Merch + Caisse + Jetons, nouvelles ventes incluses.","Prüfe, dass Merch + Kasse + Tokens den Eventumsatz ergeben, inklusive neuer Verkäufe."],
 ["Vergelijk de verwachte en getelde kas. Het fictieve voorbeeld sluit exact aan en heeft geen verschil.","Compare expected and counted cash. The fictional till reconciles with no discrepancy.","Comparez les montants attendus et comptés. La caisse fictive est équilibrée.","Vergleiche Soll- und Ist-Kasse. Die fiktive Kasse stimmt exakt überein."],
 ["Het demoverkooprapport bevat de bijgewerkte omzet per categorie en kan zonder productiegegevens worden nagekeken.","The demo report shows updated revenue by category, without accessing production data.","Le rapport démo récapitule les recettes mises à jour sans données de production.","Der Demobericht zeigt die aktualisierten Umsätze ohne Produktionsdaten."]
] as const
function restore():State{try{const x=JSON.parse(sessionStorage.getItem(KEY)||"null") as State|null;if(x&&Array.isArray(x.audit)&&typeof x.merchCents==="number")return x}catch{}return initial()}
export function SandboxSalesTraining(){
 const [locale,setLocale]=useState<SupportedUiLocale>("nl")
 const [operationId,setOperationId]=useState("")
 const [state,setState]=useState<State>(initial)
 const [amount,setAmount]=useState("")
 const [error,setError]=useState("")
 const [ready,setReady]=useState(false)
 const operations=useMemo(()=>getTrainingOperations("admin","sales"),[])
 const step=operations.find(op=>op.id===operationId)
 const index=step?Number(step.id.split(":").at(-1)):-1
 useEffect(()=>{const f=()=>setLocale(activeUiLocale());f();addEventListener(LANGUAGE_APPLIED_EVENT,f);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,f)},[])
 useEffect(()=>{const frame=requestAnimationFrame(()=>{setState(restore());setReady(true)});return()=>cancelAnimationFrame(frame)},[])
 useEffect(()=>{
  const sync=()=>{const id=document.querySelector('[data-training-lab] [data-training-operation]')?.getAttribute("data-training-operation")||"";setOperationId(old=>old===id?old:id)}
  sync();const observer=new MutationObserver(sync)
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["data-training-operation"]})
  return()=>observer.disconnect()
 },[])
 const total=state.merchCents+state.tillCents+state.tokenCents
 const perform=()=>{
  if(!ready||!step||index<0||index>8)return
  const next={...state,audit:[...state.audit]}
  let value="reviewed"
  if(step.kind==="number"){
   const count=Number(amount)
   if(!Number.isSafeInteger(count)||count<=0||count>1000){setError(T(locale,"Voer een geheel aantal tussen 1 en 1000 in.","Enter an integer from 1 to 1000.","Saisissez un entier entre 1 et 1 000.","Gib eine Ganzzahl von 1 bis 1000 ein."));return}
   if(index===4){next.merchSold+=count;next.merchCents+=count*1200}
   if(index===5){next.tokensSold+=count;next.tokenCents+=count*800}
   value=String(count)
  }else if(index===6){
   if(!next.merchSold||!next.tokensSold){setError(T(locale,"Registreer eerst beide verkopen.","Record both sales first.","Enregistrez d’abord les deux ventes.","Erfasse zunächst beide Verkäufe."));return}
   next.reconciled=true
  }else if(index===7){
   if(!next.reconciled)return
   next.discrepancyCents=0
  }else if(index===8){
   if(!next.reconciled||!next.merchSold||!next.tokensSold)return
   next.exportReady=true
  }
  next.audit.push(step.id+" · "+value)
  sessionStorage.setItem(KEY,JSON.stringify(next))
  setState(next);setAmount("");setError("")
  dispatchEvent(new CustomEvent("uptilldawn-training-practical-action",{detail:{role:"admin",chapter:"sales",id:step.id,kind:step.kind,value}}))
 }
 return <main data-tour-demo="training-screen" data-training-sales="true" className="mx-auto max-w-6xl space-y-5 p-4 pb-28 md:p-8">
  <header><p className="text-xs font-black uppercase text-violet-500">{T(locale,"ADMIN · FICTIEVE INKOMSTEN","ADMIN · FICTIONAL REVENUE","ADMIN · RECETTES FICTIVES","ADMIN · FIKTIVE EINNAHMEN")}</p><h1 className="text-2xl font-black">Sales</h1><p className="text-sm text-muted-foreground">{T(locale,"Alle bedragen en verkopen behoren uitsluitend tot deze demobrowser.","All amounts and sales belong only to this demo browser.","Tous les montants et ventes sont limités à cette démo.","Alle Beträge und Verkäufe existieren nur in dieser Demo.")}</p></header>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-demo-sales-ledger>
   <article className="rounded-xl border p-4"><h2 className="text-sm font-bold">{T(locale,"Merchandise","Merchandise","Marchandises","Merchandise")}</h2><p data-demo-sales-merch className="text-xl font-black">{money(state.merchCents)}</p></article>
   <article className="rounded-xl border p-4"><h2 className="text-sm font-bold">{T(locale,"Kassa","Till","Caisse","Kasse")}</h2><p className="text-xl font-black">{money(state.tillCents)}</p></article>
   <article className="rounded-xl border p-4"><h2 className="text-sm font-bold">Tokens</h2><p data-demo-sales-tokens className="text-xl font-black">{money(state.tokenCents)}</p></article>
   <article className="rounded-xl border p-4"><h2 className="text-sm font-bold">{T(locale,"Eventtotaal","Event total","Total événement","Eventsumme")}</h2><p data-demo-sales-total className="text-xl font-black">{money(total)}</p></article>
  </div>
  <section className="space-y-2 rounded-xl border p-4"><h2 className="font-bold">{T(locale,"Prijslijst en kassa-afstemming","Price list and till reconciliation","Tarifs et rapprochement caisse","Preisliste und Kassenabgleich")}</h2>
   <p className="text-sm">{T(locale,"T-shirt","T-shirt","T-shirt","T-Shirt")}: {money(1200)} · {T(locale,"Tokenbundel","Token bundle","Lot de jetons","Tokenpaket")}: {money(800)}</p>
   <p className="text-sm">{T(locale,"Toegevoegde T-shirts","T-shirts added","T-shirts ajoutés","Erfasste T-Shirts")}: {state.merchSold} · {T(locale,"Toegevoegde tokenbundels","Token bundles added","Lots de jetons ajoutés","Erfasste Tokenpakete")}: {state.tokensSold}</p>
   <p className="text-sm">{T(locale,"Kasverschil","Till discrepancy","Écart de caisse","Kassendifferenz")}: {money(state.discrepancyCents)}</p>
   {state.exportReady&&<p data-demo-sales-export-ready className="font-bold text-violet-500">{T(locale,"Fictief verkooprapport klaar voor controle","Fictional sales report ready for review","Rapport des ventes fictives prêt à vérifier","Fiktiver Umsatzbericht bereit zur Prüfung")}</p>}
  </section>
  {step&&<section data-demo-sales-operation={step.id} className="space-y-3 rounded-xl border border-violet-500/50 p-4"><h2 className="font-black">{step.title[locale]}</h2><p className="text-sm">{explanations[index][locale==="nl"?0:locale==="en"?1:locale==="fr"?2:3]}</p>
   {step.kind==="number"&&<label className="grid gap-2 text-sm font-bold">{T(locale,"Aantal verkopen","Sales quantity","Nombre de ventes","Verkaufsanzahl")}<input data-demo-sales-amount type="number" min="1" max="1000" step="1" className="rounded-lg border bg-background p-3" value={amount} onChange={e=>setAmount(e.target.value)}/></label>}
   <button type="button" data-training-practical-op={step.id} disabled={!ready} onClick={perform} className="w-full rounded-xl bg-violet-600 p-3 font-black text-white disabled:opacity-40">{step.title[locale]}</button>
   {error&&<p role="alert" className="text-sm text-red-500">{error}</p>}
  </section>}
  <details className="rounded-xl border p-3"><summary className="cursor-pointer font-bold">{T(locale,"Controlelog","Audit trail","Journal d’audit","Prüfprotokoll")} · {state.audit.length}</summary><ol className="mt-2 space-y-1 text-sm" data-demo-sales-audit-count={state.audit.length}>{state.audit.map((entry,i)=><li key={i}>{entry}</li>)}</ol></details>
 </main>
}
