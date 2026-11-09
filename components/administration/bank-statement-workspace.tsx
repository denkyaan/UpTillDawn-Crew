"use client"
import {useEffect,useRef,useState,type ChangeEvent} from "react"
import {normalizeIban,validateBankStatementCsv,type BankMatchView,type StoredBankEntry} from "@/lib/administration/bank-statement"
import type {SupportedUiLocale} from "@/lib/locale-preferences"

type Snapshot={entries:StoredBankEntry[];suggestions:BankMatchView[];canApprove:boolean;total:number}
const copy={
 nl:{title:"Bankafschriften en factuurbetalingen afstemmen",intro:"Importeer een genormaliseerd bankafschrift. Vergelijk met reeds geregistreerde factuurbetalingen. Alleen Admin bevestigt een exacte match; er worden geen betalingen geboekt of overschrijvingen uitgevoerd.",refresh:"Vernieuwen",account:"IBAN van de bankrekening",file:"Bank-CSV (max. 500 KB, 250 regels)",sample:"Voorbeeld-CSV downloaden",valid:"Gecontroleerde regels",net:"Netto bedrag",import:"Afschrift importeren",uploading:"Importeren…",saved:"Nieuwe regels",skipped:"Identieke regels overgeslagen",invalid:"Ongeldig afschrift: controleer IBAN, referenties, datums en EUR-bedragen.",error:"Bankafstemming niet beschikbaar. Controleer de database en toegang.",importError:"Import geweigerd. Er is geen gedeeltelijke import uitgevoerd.",loading:"Afschriftgegevens laden…",list:"Bankregels en factuurmatches",empty:"Geen bankregels geïmporteerd.",ready:"Exacte match voorgesteld",ambiguous:"Dubbelzinnige match",unmatched:"Geen exacte match",confirmed:"Door Admin bevestigd",confirm:"Match bevestigen",confirming:"Bevestigen…",confirmedNow:"Match bevestigd",confirmError:"Match geweigerd; niets gewijzigd.",note:"Een geüpload afschrift is geen live bankverificatie. Bevestigen vereist dezelfde referentie, datum en exact ondertekend bedrag.",invoice:"Factuur",total:"Bankregels",readonly:"Alleen Admin mag definitief bevestigen."},
 fr:{title:"Rapprochement bancaire et paiements de factures",intro:"Importez un relevé normalisé et comparez-le aux paiements déjà enregistrés. Seul Admin confirme les correspondances exactes. Aucun paiement ni virement n'est effectué.",refresh:"Actualiser",account:"IBAN du compte bancaire",file:"CSV bancaire (500 Ko, 250 lignes max.)",sample:"Télécharger un exemple CSV",valid:"Lignes vérifiées",net:"Montant net",import:"Importer le relevé",uploading:"Import en cours…",saved:"Nouvelles lignes",skipped:"Lignes identiques ignorées",invalid:"Relevé invalide : vérifiez IBAN, références, dates et montants EUR.",error:"Rapprochement indisponible. Vérifiez la base et les droits.",importError:"Import refusé. Aucune importation partielle.",loading:"Chargement des lignes…",list:"Lignes bancaires et factures",empty:"Aucune ligne bancaire importée.",ready:"Correspondance exacte proposée",ambiguous:"Correspondance ambiguë",unmatched:"Aucune correspondance exacte",confirmed:"Confirmée par Admin",confirm:"Confirmer",confirming:"Confirmation…",confirmedNow:"Correspondance confirmée",confirmError:"Confirmation refusée ; aucune modification.",note:"Un relevé téléversé ne constitue pas une vérification bancaire directe. Référence, date et montant signé doivent être identiques.",invoice:"Facture",total:"Lignes bancaires",readonly:"Seul Admin peut confirmer définitivement."},
 en:{title:"Reconcile bank statements and invoice payments",intro:"Import a normalized bank statement and compare it with existing invoice payments. Only Admin confirms exact matches. No payment is posted and no transfer is made.",refresh:"Refresh",account:"Bank account IBAN",file:"Bank CSV (max 500 KB, 250 rows)",sample:"Download example CSV",valid:"Validated rows",net:"Net amount",import:"Import statement",uploading:"Importing…",saved:"New rows",skipped:"Identical rows skipped",invalid:"Invalid statement: check IBAN, references, dates and EUR amounts.",error:"Bank reconciliation unavailable. Check database and access.",importError:"Import rejected. Nothing was partially imported.",loading:"Loading statement data…",list:"Bank entries and invoice matches",empty:"No bank entries imported.",ready:"Exact match suggested",ambiguous:"Ambiguous match",unmatched:"No exact match",confirmed:"Admin confirmed",confirm:"Confirm match",confirming:"Confirming…",confirmedNow:"Match confirmed",confirmError:"Match rejected; no changes made.",note:"An uploaded statement is not live bank verification. Matching requires identical reference, date and signed amount.",invoice:"Invoice",total:"Bank entries",readonly:"Only Admin can confirm final matches."},
 de:{title:"Kontoauszüge und Rechnungszahlungen abgleichen",intro:"Normierte Kontoauszüge importieren und mit bestehenden Rechnungszahlungen vergleichen. Nur Admin bestätigt exakte Zuordnungen. Keine Zahlung oder Überweisung wird ausgelöst.",refresh:"Aktualisieren",account:"IBAN des Bankkontos",file:"Bank-CSV (max. 500 KB, 250 Zeilen)",sample:"CSV-Beispiel herunterladen",valid:"Geprüfte Zeilen",net:"Nettobetrag",import:"Auszug importieren",uploading:"Importieren…",saved:"Neue Zeilen",skipped:"Identische Zeilen übersprungen",invalid:"Ungültiger Auszug: IBAN, Referenzen, Daten und EUR-Beträge prüfen.",error:"Bankabgleich nicht verfügbar. Datenbank und Rechte prüfen.",importError:"Import abgelehnt. Keine Teilimportierung.",loading:"Auszugsdaten laden…",list:"Bankzeilen und Rechnungszuordnungen",empty:"Keine Bankzeilen importiert.",ready:"Exakte Zuordnung vorgeschlagen",ambiguous:"Mehrdeutige Zuordnung",unmatched:"Keine exakte Zuordnung",confirmed:"Von Admin bestätigt",confirm:"Zuordnung bestätigen",confirming:"Bestätigen…",confirmedNow:"Zuordnung bestätigt",confirmError:"Zuordnung abgelehnt; keine Änderung.",note:"Ein hochgeladener Auszug ist keine Live-Bankbestätigung. Referenz, Datum und vorzeichenrichtiger Betrag müssen identisch sein.",invoice:"Rechnung",total:"Bankzeilen",readonly:"Nur Admin darf Zuordnungen endgültig bestätigen."}
} as const
const states={ready:"text-violet-400",ambiguous:"text-amber-500",unmatched:"text-muted-foreground",confirmed:"text-emerald-500"}
async function requestSnapshot(signal?:AbortSignal):Promise<Snapshot>{
 const response=await fetch("/api/administration/bank-statements",{cache:"no-store",signal})
 if(!response.ok)throw Error("Bank query failed")
 const value:unknown=await response.json()
 if(!value||typeof value!=="object")throw Error("Invalid bank data")
 const data=value as Snapshot
 if(!Array.isArray(data.entries)||!Array.isArray(data.suggestions)
   ||data.entries.length!==data.suggestions.length
   ||typeof data.canApprove!=="boolean"||!Number.isSafeInteger(data.total))
  throw Error("Invalid bank report")
 return data
}
export default function BankStatementWorkspace({locale}:{locale:SupportedUiLocale}){
 const t=copy[locale],revision=useRef(0)
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null)
 const [account,setAccount]=useState(""),[file,setFile]=useState<File|null>(null),[csv,setCsv]=useState<string|null>(null)
 const [loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[busy,setBusy]=useState(false)
 const [matching,setMatching]=useState<string|null>(null),[message,setMessage]=useState("")
 useEffect(()=>{
  const abort=new AbortController()
  void requestSnapshot(abort.signal).then(data=>{
   if(abort.signal.aborted)return
   setSnapshot(data);setFailed(false);setLoading(false)
  }).catch(()=>{if(!abort.signal.aborted){setFailed(true);setLoading(false)}})
  return ()=>abort.abort()
 },[])
 async function reload(){
  setLoading(true)
  try{setSnapshot(await requestSnapshot());setFailed(false)}
  catch{setFailed(true)}finally{setLoading(false)}
 }
 function clearFile(){revision.current++;setFile(null);setCsv(null);setMessage("")}
 async function fileChanged(event:ChangeEvent<HTMLInputElement>){
  const next=event.target.files?.[0],version=++revision.current
  setFile(null);setCsv(null);setMessage("")
  if(!next)return
  if(next.size===0||next.size>500_000||!next.name.toLowerCase().endsWith(".csv")){setMessage(t.invalid);return}
  try{const contents=await next.text();if(version===revision.current){setFile(next);setCsv(contents)}}
  catch{if(version===revision.current)setMessage(t.invalid)}
 }
 const preview=csv!==null?validateBankStatementCsv(csv,account):null
 const money=(cents:number)=>new Intl.NumberFormat(locale,{style:"currency",currency:"EUR"}).format(cents/100)
 const sampleIban="BE68 5390 0754 7034" // Locale-independent example of a valid Belgian IBAN.
 const sample="transaction_reference,booking_date,amount,currency,counterparty_iban,description\nBANK-001,2026-11-09,30.00,EUR,,Invoice payment\nBANK-002,2026-11-09,-12.50,EUR,,Supplier invoice\n"
 async function importRows(){
  if(!file||!preview||preview.errors.length||busy||matching)return
  const form=new FormData();form.set("bankAccountIban",normalizeIban(account));form.set("file",file)
  setBusy(true);setMessage("")
  try{
   const response=await fetch("/api/administration/bank-statements",{method:"POST",body:form})
   const value=await response.json().catch(()=>({}))
   if(!response.ok||!value.result||!Number.isSafeInteger(value.result.inserted)||!Number.isSafeInteger(value.result.skipped)){setMessage(t.importError);return}
   setMessage(t.saved+": "+value.result.inserted+" · "+t.skipped+": "+value.result.skipped)
   await reload()
  }catch{setMessage(t.importError)}finally{setBusy(false)}
 }
 async function confirmMatch(entryId:string,paymentId:string){
  if(!snapshot?.canApprove||matching||busy)return
  setMatching(entryId);setMessage("")
  try{
   const response=await fetch("/api/administration/bank-statements/match",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({entryId,paymentId})
   })
   if(!response.ok){setMessage(t.confirmError);return}
   const value=await response.json()
   if(typeof value.matchId!=="string"){setMessage(t.confirmError);return}
   setMessage(t.confirmedNow);await reload()
  }catch{setMessage(t.confirmError)}finally{setMatching(null)}
 }
 const suggestions=new Map(snapshot?.suggestions.map(s=>[s.entryId,s])??[])
 return <section className="space-y-4 rounded-2xl border bg-card p-5" aria-label={t.title}>
  <h2 className="text-lg font-semibold">{t.title}</h2>
  <p className="text-sm text-muted-foreground">{t.intro}</p>
  <button type="button" disabled={loading||busy||matching!==null} onClick={()=>{clearFile();void reload()}} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{t.refresh}</button>
  {loading&&<p role="status">{t.loading}</p>}
  {failed&&<p role="alert" className="text-sm">{t.error}</p>}
  {!failed&&<div className="grid gap-3 rounded-xl border p-3">
   <label className="grid gap-1 text-sm">{t.account}
    <input value={account} onChange={event=>{clearFile();setAccount(event.target.value)}} placeholder={sampleIban} autoComplete="off" className="rounded-lg border bg-background p-2"/>
   </label>
   <label className="grid gap-1 text-sm">{t.file}
    <input type="file" accept=".csv,text/csv" disabled={busy} onChange={fileChanged} className="rounded-lg border p-2"/>
   </label>
   <a className="text-sm text-violet-400 underline" href={"data:text/csv;charset=utf-8,"+encodeURIComponent(sample)} download="bank-statement-example.csv">{t.sample}</a>
   {preview&&<p role="status" className="text-sm">{preview.errors.length?t.invalid+" ("+preview.errors.slice(0,10).map(e=>e.line).join(", ")+")":t.valid+": "+preview.rows.length+" · "+t.net+": "+money(preview.netCents)}</p>}
   <button type="button" disabled={!file||!preview||preview.rows.length===0||preview.errors.length>0||busy||matching!==null} onClick={()=>void importRows()} className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?t.uploading:t.import}</button>
  </div>}
  {message&&<p role="status" className="text-sm">{message}</p>}
  {snapshot&&!failed&&<div className="space-y-3">
   <h3 className="font-semibold">{t.list} ({t.total}: {snapshot.total})</h3>
   <p className="text-sm text-muted-foreground">{t.note}</p>
   {!snapshot.canApprove&&<p className="text-sm text-muted-foreground">{t.readonly}</p>}
   {!snapshot.entries.length&&<p className="text-sm">{t.empty}</p>}
   <ul className="divide-y rounded-xl border">{snapshot.entries.map(entry=>{
    const suggestion=suggestions.get(entry.id)
    const state=suggestion?.state??"unmatched"
    const amount=Number(entry.amount_cents)
    return <li key={entry.id} className="space-y-1 p-3 text-sm">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <strong className="break-all">{entry.transaction_reference}</strong>
      <span>{money(amount)}</span>
     </div>
     <p className="text-muted-foreground">{entry.booking_date} · {entry.bank_account_iban} · {entry.description}</p>
     <p className={states[state]}>{t[state]}{suggestion?.documentNumber?" · "+t.invoice+": "+suggestion.documentNumber:""}</p>
     {snapshot.canApprove&&state==="ready"&&suggestion?.paymentId&&<button type="button" disabled={matching!==null||busy||loading} onClick={()=>void confirmMatch(entry.id,suggestion.paymentId!)} className="rounded-lg border px-3 py-2 disabled:opacity-50">{matching===entry.id?t.confirming:t.confirm}</button>}
    </li>
   })}</ul>
  </div>}
 </section>
}
