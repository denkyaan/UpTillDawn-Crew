"use client"
import {useEffect,useRef,useState,type ChangeEvent} from "react"
import {validateProviderTransactionCsv} from "@/lib/administration/provider-transaction-import"
import type {SalesReconciliationReport} from "@/lib/administration/sales-reconciliation-report"
import type {SupportedUiLocale} from "@/lib/locale-preferences"

type Mapping={id:string;provider:"eventix"|"sumup"|"eventpay";external_event_id:string;event_id:string;enabled:boolean}
type Overview={report:SalesReconciliationReport;transactionCount:number}
const copy={
 nl:{walletLiability:"EventPay-kaartopladingen · prepaid verplichting, geen omzet",bar:"Bar",title:"Providerbetalingen en terugbetalingen",intro:"Importeer genormaliseerde Eventix/SumUp/EventPay-transacties via een actieve evenementkoppeling. Dit is een gecontroleerd providerregister, geen bankafschrift of boekhoudkundige betaling. Facturen, kassa en voorraad worden niet automatisch gewijzigd.",refresh:"Gegevens vernieuwen",mapping:"Actieve koppeling",file:"Transactie-CSV (max. 1 MB, 500 regels)",template:"CSV-sjabloon downloaden",emptyMapping:"Er zijn geen actieve evenementkoppelingen. Activeer eerst een koppeling onder Ticketing.",loading:"Transacties laden…",failed:"Transacties of koppelingen konden niet worden geladen. Controleer database en toegangsrechten.",invalid:"Ongeldig bestand. Controleer de regels en het externe evenement-ID.",valid:"Import gecontroleerd",rows:"Regels",paid:"Betaald volgens provider",refund:"Terugbetaald volgens provider",pending:"In behandeling",import:"Transacties registreren",busy:"Transacties opslaan…",saved:"Nieuwe transacties",skipped:"Bestaande regels overgeslagen",conflict:"Import geweigerd: koppeling gewijzigd of bestaande transactie heeft afwijkende gegevens. Geen gedeeltelijke import.",error:"Import mislukt; geen bevestigde opslag.",report:"Afstemming providertransacties",total:"Netto volgens provider",tx:"Transactiestatussen",events:"Per evenement",tickets:"Tickets",merch:"Merch",tokens:"Tokens",exceptions:"Uitzonderingen ter controle",unmatched:"Niet gematcht",conflicts:"Conflicten",duplicates:"Duplicaten",download:"Afstemming CSV",downloadExceptions:"Uitzonderingen CSV",noRecords:"Er zijn nog geen providertransacties opgeslagen.",limited:"Dit rapport verifieert geïmporteerde transacties onderling. Het bevestigt geen ontvangen bankuitbetalingen of automatisch geboekte omzet.",normalizedFormat:"EventPay: gebruik het genormaliseerde CSV-sjabloon na controle tegen het officiële transactieoverzicht. Geen ruwe kaartcodes of wallet-ID’s importeren. Bar en Merch zijn omzet; topups zijn tegoedverplichtingen. Dit start geen betalingen."},
 fr:{walletLiability:"Recharges EventPay · solde prépayé, pas du chiffre d’affaires",bar:"Bar",title:"Paiements et remboursements fournisseur",intro:"Importez les transactions normalisées Eventix/SumUp/EventPay via une association active. Il s’agit d’un registre de transactions, pas d’un relevé bancaire ni d’un paiement comptabilisé. Les factures, les caisses et le stock ne sont pas modifiés.",refresh:"Actualiser",mapping:"Association active",file:"CSV transactions (max. 1 Mo, 500 lignes)",template:"Télécharger le modèle CSV",emptyMapping:"Aucune association active. Activez d’abord une association dans Billetterie.",loading:"Chargement des transactions…",failed:"Transactions ou associations indisponibles. Vérifiez la base et vos droits.",invalid:"Fichier incorrect. Vérifiez les lignes et l’ID événement externe.",valid:"Import vérifié",rows:"Lignes",paid:"Payé selon le fournisseur",refund:"Remboursé selon le fournisseur",pending:"En attente",import:"Enregistrer les transactions",busy:"Enregistrement…",saved:"Nouvelles transactions",skipped:"Lignes existantes ignorées",conflict:"Import refusé : association modifiée ou transaction contradictoire. Aucun import partiel.",error:"Import échoué ; aucun enregistrement confirmé.",report:"Rapprochement fournisseur",total:"Net selon le fournisseur",tx:"Statuts des transactions",events:"Par événement",tickets:"Billets",merch:"Merch",tokens:"Jetons",exceptions:"Exceptions à vérifier",unmatched:"Non rapprochées",conflicts:"Conflits",duplicates:"Doublons",download:"CSV rapprochement",downloadExceptions:"CSV exceptions",noRecords:"Aucune transaction enregistrée.",limited:"Ce rapport compare les transactions importées entre elles. Il ne confirme aucun versement bancaire ni revenu comptabilisé automatiquement.",normalizedFormat:"EventPay : utilisez le modèle CSV normalisé après contrôle du relevé officiel. Ne téléversez aucun code de carte ni identifiant de wallet. Bar et Merch relèvent des ventes ; topups sont des avoirs prépayés. Aucun paiement n’est lancé."},
 en:{walletLiability:"EventPay wallet top-ups · prepaid liability, not revenue",bar:"Bar",title:"Provider payments and refunds",intro:"Import normalized Eventix/SumUp/EventPay transactions against an active event mapping. This is a provider transaction register, not a bank statement or posted accounting payment. It does not update invoices, checkout or inventory.",refresh:"Refresh data",mapping:"Active event mapping",file:"Transaction CSV (max 1 MB, 500 rows)",template:"Download CSV template",emptyMapping:"No active mappings. Enable an event mapping under Ticketing first.",loading:"Loading transactions…",failed:"Could not load transactions or mappings. Check database and access rights.",invalid:"Invalid file. Check rows and external event ID.",valid:"Import validated",rows:"Rows",paid:"Provider-reported paid",refund:"Provider-reported refunded",pending:"Pending",import:"Record transactions",busy:"Recording transactions…",saved:"New transactions",skipped:"Existing rows skipped",conflict:"Import rejected: mapping changed or stored transaction conflicts. No partial import.",error:"Import failed; no confirmed save.",report:"Provider transaction reconciliation",total:"Provider-reported net",tx:"Transaction statuses",events:"By event",tickets:"Tickets",merch:"Merch",tokens:"Tokens",exceptions:"Exceptions for review",unmatched:"Unmatched",conflicts:"Conflicts",duplicates:"Duplicates",download:"Reconciliation CSV",downloadExceptions:"Exceptions CSV",noRecords:"No provider transactions stored yet.",limited:"This report compares imported transaction claims. It does not verify bank payouts or automatically post accounting revenue.",normalizedFormat:"EventPay: use the normalized CSV template after checking against the official provider statement. Never upload raw card codes or wallet IDs. Bar and Merch are sales; topups are prepaid liabilities. No payments are initiated."},
 de:{walletLiability:"EventPay-Kartenaufladungen · Guthabenverbindlichkeit, kein Umsatz",bar:"Bar",title:"Anbieterzahlungen und Rückerstattungen",intro:"Normierte Eventix/SumUp/EventPay-Transaktionen über eine aktive Eventzuordnung importieren. Dies ist ein Anbietertransaktionsregister, kein Kontoauszug oder eine verbuchte Zahlung. Rechnungen, Kasse und Bestand bleiben unverändert.",refresh:"Daten aktualisieren",mapping:"Aktive Eventzuordnung",file:"Transaktions-CSV (max. 1 MB, 500 Zeilen)",template:"CSV-Vorlage herunterladen",emptyMapping:"Keine aktiven Zuordnungen. Zuerst unter Ticketing eine Zuordnung aktivieren.",loading:"Transaktionen laden…",failed:"Transaktionen oder Zuordnungen nicht verfügbar. Datenbank und Berechtigungen prüfen.",invalid:"Ungültige Datei. Zeilen und externe Event-ID prüfen.",valid:"Import geprüft",rows:"Zeilen",paid:"Laut Anbieter bezahlt",refund:"Laut Anbieter erstattet",pending:"Ausstehend",import:"Transaktionen erfassen",busy:"Wird gespeichert…",saved:"Neue Transaktionen",skipped:"Vorhandene Zeilen übersprungen",conflict:"Import abgelehnt: Zuordnung geändert oder widersprüchliche Transaktion. Kein Teilimport.",error:"Import fehlgeschlagen; keine Speicherung bestätigt.",report:"Anbietertransaktionsabgleich",total:"Netto laut Anbieter",tx:"Transaktionsstatus",events:"Pro Event",tickets:"Tickets",merch:"Merch",tokens:"Ausgabemarken",exceptions:"Ausnahmen zur Prüfung",unmatched:"Nicht zugeordnet",conflicts:"Konflikte",duplicates:"Duplikate",download:"Abgleich CSV",downloadExceptions:"Ausnahmen CSV",noRecords:"Noch keine Anbietertransaktionen gespeichert.",limited:"Dieser Bericht gleicht importierte Transaktionsangaben ab. Er bestätigt keine Bankauszahlungen und keine automatische Umsatzbuchung.",normalizedFormat:"EventPay: normierte CSV-Vorlage nach Prüfung mit dem offiziellen Anbieterbericht verwenden. Keine Karten- oder Wallet-Kennungen hochladen. Bar und Merch sind Verkäufe; topups sind Guthabenverbindlichkeiten. Es werden keine Zahlungen ausgelöst."}
} as const
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const external=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/
async function readWorkspace(signal?:AbortSignal):Promise<{mappings:Mapping[];overview:Overview}>{
 const [mapped,reported]=await Promise.all([
  fetch("/api/administration/provider-mappings",{cache:"no-store",signal}),
  fetch("/api/administration/provider-transactions",{cache:"no-store",signal})
 ])
 if(!mapped.ok||!reported.ok)throw Error("Provider report unavailable")
 const mappingsValue:unknown=await mapped.json()
 const reportValue:unknown=await reported.json()
 if(!mappingsValue||typeof mappingsValue!=="object"||!Array.isArray((mappingsValue as {mappings?:unknown}).mappings))
  throw Error("Invalid mappings")
 if(!reportValue||typeof reportValue!=="object")throw Error("Invalid report")
 const overview=reportValue as Overview
 if(!overview.report||!Array.isArray(overview.report.events)
  ||!overview.report.exceptions||!overview.report.totals||!Number.isSafeInteger(overview.transactionCount))
  throw Error("Invalid report totals")
 const mappings=(mappingsValue as {mappings:unknown[]}).mappings.filter((item):item is Mapping=>{
  if(!item||typeof item!=="object")return false
  const row=item as Record<string,unknown>
  return typeof row.id==="string"&&uuid.test(row.id)
   &&(row.provider==="eventix"||row.provider==="sumup"||row.provider==="eventpay")
   &&typeof row.event_id==="string"&&uuid.test(row.event_id)
   &&typeof row.external_event_id==="string"&&external.test(row.external_event_id)
   &&row.enabled===true
 })
 return {mappings,overview}
}

export default function ProviderTransactionWorkspace({locale,events}:{locale:SupportedUiLocale;events:{id:string;name:string}[]}){
 const t=copy[locale],revision=useRef(0)
 const [mappings,setMappings]=useState<Mapping[]>([]),[mappingId,setMappingId]=useState("")
 const [overview,setOverview]=useState<Overview|null>(null)
 const [loading,setLoading]=useState(true),[failure,setFailure]=useState(false),[busy,setBusy]=useState(false)
 const [file,setFile]=useState<File|null>(null),[csv,setCsv]=useState<string|null>(null),[feedback,setFeedback]=useState("")
 async function reload(){
  setLoading(true)
  try{
   const state=await readWorkspace()
   setMappings(state.mappings);setOverview(state.overview)
   setMappingId(previous=>state.mappings.some(m=>m.id===previous)?previous:state.mappings[0]?.id??"")
   setFailure(false)
  }catch{setFailure(true)}finally{setLoading(false)}
 }
 useEffect(()=>{
  const controller=new AbortController()
  void readWorkspace(controller.signal).then(state=>{
   if(controller.signal.aborted)return
   setMappings(state.mappings);setOverview(state.overview)
   setMappingId(state.mappings[0]?.id??"")
   setFailure(false);setLoading(false)
  }).catch(()=>{if(!controller.signal.aborted){setFailure(true);setLoading(false)}})
  return ()=>controller.abort()
 },[])
 const selected=mappings.find(m=>m.id===mappingId)??null
 const preview=selected&&csv!==null?validateProviderTransactionCsv(csv,selected.event_id,selected.external_event_id,500,selected.provider):null
 const money=(cents:number)=>new Intl.NumberFormat(locale,{style:"currency",currency:"EUR"}).format(cents/100)
 const eventName=(id:string)=>events.find(e=>e.id===id)?.name??id
 function resetFile(){revision.current++;setFile(null);setCsv(null);setFeedback("")}
 async function chooseFile(event:ChangeEvent<HTMLInputElement>){
  const next=event.target.files?.[0],version=++revision.current
  setFile(null);setCsv(null);setFeedback("")
  if(!next)return
  if(next.size===0||next.size>1_000_000||!next.name.toLowerCase().endsWith(".csv")){setFeedback(t.invalid);return}
  try{
   const content=await next.text()
   if(version===revision.current){setFile(next);setCsv(content)}
  }catch{if(version===revision.current)setFeedback(t.invalid)}
 }
 async function save(){
  if(busy||!selected||!file||!preview||preview.errors.length||!preview.rows.length)return
  setBusy(true);setFeedback("")
  const form=new FormData()
  form.set("mappingId",selected.id);form.set("file",file)
  try{
   const response=await fetch("/api/administration/provider-transactions",{method:"POST",body:form})
   const body=await response.json().catch(()=>({}))
   if(!response.ok){setFeedback(response.status===409||response.status===403?t.conflict:t.error);return}
   if(!body.result||!Number.isSafeInteger(body.result.inserted)||!Number.isSafeInteger(body.result.skipped)){setFeedback(t.error);return}
   setFeedback(t.saved+": "+body.result.inserted+" · "+t.skipped+": "+body.result.skipped)
   await reload()
  }catch{setFeedback(t.error)}finally{setBusy(false)}
 }
 const example=selected
  ?"transaction_id,external_event_id,category,sale_reference,status,amount,currency,occurred_at\n"
   +(selected.provider==="eventpay"
    ?"BAR-001,"+selected.external_event_id+",bar,ORDER-BAR-001,paid,8.00,EUR,2026-11-09T20:00:00+01:00\n"
     +"RELOAD-001,"+selected.external_event_id+",topups,ORDER-TOPUP-001,paid,20.00,EUR,2026-11-09T20:10:00+01:00\n"
    :"PAY-001,"+selected.external_event_id+",tickets,ORDER-001,paid,30.00,EUR,2026-11-09T20:00:00+01:00\n"
     +"REF-001,"+selected.external_event_id+",tickets,ORDER-001,refunded,5.00,EUR,2026-11-09T21:00:00+01:00\n")
  :""
 const categories=(["tickets","merch","tokens","bar"] as const)
 const exceptions=overview?.report.exceptions
 const exceptionCounts=exceptions?{
  conflicts:exceptions.conflicts.length,unmatched:exceptions.unmatched.length,
  duplicates:exceptions.duplicates.length,pending:exceptions.pending.length
 }:null
 const latestExceptions=exceptions
  ?([...exceptions.conflicts,...exceptions.unmatched,...exceptions.pending].slice(0,12)):[]

 return <section className="space-y-4 rounded-2xl border bg-card p-5" aria-label={t.title}>
  <header className="space-y-2"><h2 className="text-lg font-semibold">{t.title}</h2>
   <p className="text-sm text-muted-foreground">{t.intro}</p></header>
  <button type="button" disabled={loading||busy} onClick={()=>{resetFile();void reload()}} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{t.refresh}</button>
  {loading&&<p role="status">{t.loading}</p>}
  {failure&&<p role="alert" className="text-sm text-destructive">{t.failed}</p>}
  {!loading&&selected&&<div className="space-y-3 rounded-xl border p-3">
   <label className="grid gap-1 text-sm">{t.mapping}
    <select value={mappingId} disabled={busy} onChange={e=>{resetFile();setMappingId(e.target.value)}} className="w-full rounded-lg border bg-background p-2">
     {mappings.map(m=><option value={m.id} key={m.id}>{m.provider==="eventix"?"Eventix":m.provider==="eventpay"?"EventPay":"SumUp"} · {m.external_event_id} · {eventName(m.event_id)}</option>)}
    </select></label>
   <label className="grid gap-1 text-sm">{t.file}
    <input key={mappingId} type="file" accept=".csv,text/csv" disabled={busy} onChange={chooseFile} className="max-w-full rounded-lg border p-2"/>
   </label>
   <a href={"data:text/csv;charset=utf-8,"+encodeURIComponent(example)} download="provider-transactions-example.csv" className="inline-block text-sm text-violet-400 underline">{t.template}</a>
   {preview&&<div role="status" className="text-sm">{preview.errors.length
    ?<p>{t.invalid} ({preview.errors.slice(0,20).map(e=>e.line).join(", ")})</p>
    :<p>{t.valid}: {t.rows} {preview.rows.length} · {t.paid}: {money(preview.paidCents)} · {t.refund}: {money(preview.refundedCents)} · {t.pending}: {preview.pendingCount}</p>}</div>}
   <button type="button" disabled={busy||!file||!preview||preview.errors.length>0||!preview.rows.length} onClick={()=>void save()} className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?t.busy:t.import}</button>
   {feedback&&<p role="status" className="text-sm">{feedback}</p>}
  </div>}
  {!loading&&!mappings.length&&!failure&&<p className="text-sm">{t.emptyMapping}</p>}
  {overview&&!failure&&<div className="space-y-3">
   <h3 className="font-semibold">{t.report}</h3>
   <p className="text-sm text-muted-foreground">{t.limited}</p>
   <p className="text-xs text-muted-foreground">{t.normalizedFormat}</p>
   {overview.transactionCount===0?<p className="text-sm">{t.noRecords}</p>:<>
    <div className="flex flex-wrap gap-2">
     <a href="/api/administration/provider-transactions?export=net" className="rounded-lg border px-3 py-2 text-sm">{t.download}</a>
     <a href="/api/administration/provider-transactions?export=exceptions" className="rounded-lg border px-3 py-2 text-sm">{t.downloadExceptions}</a>
    </div>
    <p className="text-sm">{t.tx}: <strong>{overview.transactionCount}</strong> · {t.total}: <strong>{money(categories.reduce((sum,c)=>sum+overview.report.totals[c],0))}</strong></p>
    <p className="text-sm font-semibold">{t.walletLiability}: <strong>{money(overview.report.totals.topups)}</strong></p>
    <div className="grid gap-3 sm:grid-cols-3">{categories.map(category=><div key={category} className="rounded-xl border p-3 text-sm">
     <p className="font-semibold">{t[category]}</p><p className="text-xl font-bold">{money(overview.report.totals[category])}</p>
    </div>)}</div>
    <h4 className="font-semibold">{t.events}</h4>
    <ul className="divide-y rounded-xl border">{overview.report.events.slice(0,50).map(event=><li key={event.eventId} className="space-y-1 p-3 text-sm">
     <strong>{eventName(event.eventId)}</strong>
     <p>{categories.map(c=>t[c]+": "+money(event.netCents[c])).join(" · ")}</p>
     <p className="text-muted-foreground">{t.walletLiability}: {money(event.netCents.topups)}</p>
     <p className="text-muted-foreground">{t.paid}: {money(categories.reduce((sum,c)=>sum+event.paidCents[c],0))} · {t.refund}: {money(categories.reduce((sum,c)=>sum+event.refundedCents[c],0))}</p>
    </li>)}</ul>
    {exceptionCounts&&<div className="space-y-2 rounded-xl border p-3 text-sm">
     <h4 className="font-semibold">{t.exceptions}</h4>
     <p>{t.conflicts}: {exceptionCounts.conflicts} · {t.unmatched}: {exceptionCounts.unmatched} · {t.duplicates}: {exceptionCounts.duplicates} · {t.pending}: {exceptionCounts.pending}</p>
     {latestExceptions.length>0&&<ul className="list-disc space-y-1 pl-5">{latestExceptions.map((v,i)=><li key={i} className="break-all">{v}</li>)}</ul>}
    </div>}
   </>}
  </div>}
 </section>
}
