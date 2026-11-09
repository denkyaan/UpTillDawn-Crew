"use client"
import {useEffect,useRef,useState,type ChangeEvent} from "react"
import {validateBankStatementCsv} from "@/lib/administration/bank-statement-import"
import type {SupportedUiLocale} from "@/lib/locale-preferences"

type Statement={
 id:string;transaction_id:string;booked_on:string;direction:"credit"|"debit";
 amount_cents:number;payment_reference:string;description:string;
 linked_document_id:string|null;posted_payment_id:string|null;
 ignored_at:string|null;ignored_reason:string|null
}
type Invoice={id:string;number:string;kind:"sales_invoice"|"purchase_invoice";outstandingCents:number}
type Data={statements:Statement[];invoices:Invoice[];canApprove:boolean}
const translations={
 nl:{title:"Bankafschriften en factuurafstemming",intro:"Importeer genormaliseerde EUR-banktransacties. Een CSV is geen onafhankelijk geverifieerd bankbewijs. Alleen Admin kan na controle een banktransactie definitief als factuurbetaling vastleggen; de database voorkomt dubbel boeken en overbetalingen.",refresh:"Gegevens vernieuwen",upload:"CSV-bankafschrift (max. 1 MB, 500 regels)",template:"Voorbeeld-CSV downloaden",save:"Banktransacties importeren",saving:"Importeren…",valid:"CSV gecontroleerd",invalid:"Ongeldig bankafschrift. Controleer de regels en de vereiste kolommen.",credit:"Bijgeschreven",debit:"Afgeschreven",rows:"Transacties",saved:"Nieuw opgeslagen",skipped:"Bestaande overgeslagen",error:"Gegevens konden niet worden geladen of opgeslagen.",conflict:"Bestaande transactie wijkt af: volledige import geweigerd.",empty:"Nog geen banktransacties geïmporteerd.",unresolved:"Nog te beoordelen",posted:"Geboekt",ignored:"Genegeerd",select:"Kies een goedgekeurde factuur",noCandidate:"Geen geschikte factuur met voldoende openstaand saldo.",approve:"Boek als factuurbetaling",approving:"Boeking controleren…",approveConfirm:"Heb je deze banktransactie gecontroleerd tegen het echte bankafschrift en wil je ze definitief als betaling boeken?",ignoredReason:"Reden voor negeren (min. 5 tekens)",ignore:"Negeer met reden",ignoreConfirm:"Deze transactie als genegeerd afsluiten?",postSuccess:"Betaling veilig vastgelegd",ignoreSuccess:"Transactie als genegeerd gemarkeerd",failedAction:"Actie geweigerd. Controleer factuur, saldo, rechten en bankreferentie.",onlyAdmin:"Alleen Admin kan betalingen bevestigen of bankregels negeren.",previous:"Vorige",next:"Volgende",showing:"Pagina",of:"van",direction:"Richting",amount:"Bedrag",reference:"Bankreferentie",noNotes:"Geen omschrijving",outstanding:"Openstaand",status:"Status"},
 fr:{title:"Relevés bancaires et rapprochement des factures",intro:"Importez les transactions bancaires EUR normalisées. Un CSV n’est pas une preuve bancaire indépendante. Seul Admin peut enregistrer un paiement après vérification; la base bloque les doublons et les trop-perçus.",refresh:"Actualiser",upload:"Relevé CSV (max. 1 Mo, 500 lignes)",template:"Télécharger le modèle CSV",save:"Importer les transactions",saving:"Import…",valid:"CSV vérifié",invalid:"Relevé incorrect. Vérifiez les colonnes et les lignes.",credit:"Crédit",debit:"Débit",rows:"Transactions",saved:"Nouvelles enregistrées",skipped:"Existantes ignorées",error:"Impossible de charger ou d’enregistrer les données.",conflict:"Une transaction existante diffère : import intégral rejeté.",empty:"Aucune transaction importée.",unresolved:"À examiner",posted:"Comptabilisé",ignored:"Ignoré",select:"Sélectionner une facture approuvée",noCandidate:"Aucune facture admissible avec solde suffisant.",approve:"Enregistrer le paiement",approving:"Vérification…",approveConfirm:"Avez-vous vérifié cette transaction avec le relevé bancaire réel et souhaitez-vous l’enregistrer définitivement ?",ignoredReason:"Motif d’ignorance (5 caractères min.)",ignore:"Ignorer avec motif",ignoreConfirm:"Clôturer cette transaction comme ignorée ?",postSuccess:"Paiement enregistré",ignoreSuccess:"Transaction ignorée",failedAction:"Action refusée. Vérifiez la facture, le solde, les droits et la référence.",onlyAdmin:"Seul Admin peut confirmer des paiements ou ignorer des lignes.",previous:"Précédent",next:"Suivant",showing:"Page",of:"sur",direction:"Sens",amount:"Montant",reference:"Référence bancaire",noNotes:"Sans description",outstanding:"Solde",status:"Statut"},
 en:{title:"Bank statements and invoice matching",intro:"Import normalized EUR bank transactions. A CSV is not independently verified bank evidence. Only Admin may record a payment after checking it; the database blocks duplicates and overpayments.",refresh:"Refresh data",upload:"Bank CSV (max 1 MB, 500 rows)",template:"Download example CSV",save:"Import bank transactions",saving:"Importing…",valid:"CSV validated",invalid:"Invalid statement. Check its rows and columns.",credit:"Incoming",debit:"Outgoing",rows:"Transactions",saved:"New saved",skipped:"Existing skipped",error:"Unable to load or save bank data.",conflict:"An existing transaction differs: entire import rejected.",empty:"No bank transactions imported yet.",unresolved:"Needs review",posted:"Posted",ignored:"Ignored",select:"Choose an approved invoice",noCandidate:"No eligible invoice with sufficient outstanding balance.",approve:"Record invoice payment",approving:"Checking posting…",approveConfirm:"Have you verified this transaction against the real bank statement and do you want to record a final invoice payment?",ignoredReason:"Reason for ignoring (at least 5 characters)",ignore:"Ignore with reason",ignoreConfirm:"Close this transaction as ignored?",postSuccess:"Payment securely recorded",ignoreSuccess:"Transaction marked ignored",failedAction:"Action rejected. Check invoice, outstanding balance, permissions and bank reference.",onlyAdmin:"Only Admin can approve invoice payments or ignore bank transactions.",previous:"Previous",next:"Next",showing:"Page",of:"of",direction:"Direction",amount:"Amount",reference:"Bank reference",noNotes:"No description",outstanding:"Outstanding",status:"Status"},
 de:{title:"Kontoauszüge und Rechnungsabgleich",intro:"Normierte EUR-Banktransaktionen importieren. Eine CSV-Datei ist kein unabhängig verifizierter Banknachweis. Nur Admin darf nach Prüfung eine Zahlung buchen; die Datenbank verhindert Dubletten und Überzahlungen.",refresh:"Aktualisieren",upload:"Bank-CSV (max. 1 MB, 500 Zeilen)",template:"Beispiel-CSV herunterladen",save:"Banktransaktionen importieren",saving:"Import läuft…",valid:"CSV geprüft",invalid:"Ungültiger Kontoauszug. Zeilen und Spalten prüfen.",credit:"Eingang",debit:"Ausgang",rows:"Transaktionen",saved:"Neu gespeichert",skipped:"Vorhandene übersprungen",error:"Bankdaten konnten nicht geladen oder gespeichert werden.",conflict:"Vorhandene Transaktion weicht ab: gesamter Import abgelehnt.",empty:"Noch keine Banktransaktionen importiert.",unresolved:"Zu prüfen",posted:"Gebucht",ignored:"Ignoriert",select:"Genehmigte Rechnung auswählen",noCandidate:"Keine geeignete Rechnung mit ausreichendem Restbetrag.",approve:"Rechnungszahlung buchen",approving:"Buchung wird geprüft…",approveConfirm:"Hast du diese Transaktion mit dem echten Kontoauszug geprüft und willst du sie endgültig als Zahlung buchen?",ignoredReason:"Grund für Ignorieren (mind. 5 Zeichen)",ignore:"Mit Begründung ignorieren",ignoreConfirm:"Diese Transaktion als ignoriert schließen?",postSuccess:"Zahlung sicher erfasst",ignoreSuccess:"Transaktion ignoriert",failedAction:"Aktion abgelehnt. Rechnung, Saldo, Berechtigung und Referenz prüfen.",onlyAdmin:"Nur Admin darf Rechnungszahlungen bestätigen oder Bankeinträge ignorieren.",previous:"Zurück",next:"Weiter",showing:"Seite",of:"von",direction:"Richtung",amount:"Betrag",reference:"Bankreferenz",noNotes:"Keine Beschreibung",outstanding:"Offen",status:"Status"}
} as const
const pageSize=20
async function fetchWorkspace(signal?:AbortSignal):Promise<Data>{
 const response=await fetch("/api/administration/bank-statements",{cache:"no-store",signal})
 if(!response.ok)throw Error("Bank register unavailable")
 const data:unknown=await response.json()
 if(!data||typeof data!=="object"||!Array.isArray((data as Data).statements)
    ||!Array.isArray((data as Data).invoices)||typeof (data as Data).canApprove!=="boolean")
  throw Error("Invalid bank register")
 return data as Data
}
export default function BankStatementWorkspace({locale}:{locale:SupportedUiLocale}){
 const t=translations[locale],revision=useRef(0)
 const [workspace,setWorkspace]=useState<Data|null>(null)
 const [loading,setLoading]=useState(true),[error,setError]=useState(false),[busy,setBusy]=useState(false)
 const [file,setFile]=useState<File|null>(null),[csv,setCsv]=useState<string|null>(null)
 const [feedback,setFeedback]=useState(""),[selected,setSelected]=useState<Record<string,string>>({})
 const [reasons,setReasons]=useState<Record<string,string>>({}),[page,setPage]=useState(1)
 useEffect(()=>{
  const controller=new AbortController()
  void fetchWorkspace(controller.signal).then(data=>{
   if(controller.signal.aborted)return
   setWorkspace(data);setLoading(false);setError(false)
  }).catch(()=>{if(!controller.signal.aborted){setLoading(false);setError(true)}})
  return ()=>controller.abort()
 },[])
 async function refresh(){
  setLoading(true)
  try{setWorkspace(await fetchWorkspace());setError(false)}
  catch{setError(true)}finally{setLoading(false)}
 }
 function resetFile(){revision.current++;setFile(null);setCsv(null);setFeedback("")}
 async function chooseFile(event:ChangeEvent<HTMLInputElement>){
  const current=++revision.current,chosen=event.target.files?.[0]
  setFile(null);setCsv(null);setFeedback("")
  if(!chosen)return
  if(!chosen.name.toLowerCase().endsWith(".csv")||chosen.size===0||chosen.size>1_000_000){
   setFeedback(t.invalid);return
  }
  try{
   const text=await chosen.text()
   if(current===revision.current){setFile(chosen);setCsv(text)}
  }catch{if(current===revision.current)setFeedback(t.invalid)}
 }
 const preview=csv===null?null:validateBankStatementCsv(csv)
 const money=(value:number)=>new Intl.NumberFormat(locale,{style:"currency",currency:"EUR"}).format(value/100)
 async function importFile(){
  if(!file||!preview||preview.errors.length||!preview.rows.length||busy)return
  setBusy(true);setFeedback("")
  const form=new FormData();form.set("file",file)
  try{
   const response=await fetch("/api/administration/bank-statements",{method:"POST",body:form})
   const body=await response.json().catch(()=>({}))
   if(!response.ok){setFeedback(response.status===409?t.conflict:t.error);return}
   if(!body.result||!Number.isSafeInteger(body.result.inserted)||!Number.isSafeInteger(body.result.skipped)){
    setFeedback(t.error);return
   }
   const message=t.saved+": "+body.result.inserted+" · "+t.skipped+": "+body.result.skipped
   resetFile();await refresh();setFeedback(message)
  }catch{setFeedback(t.error)}finally{setBusy(false)}
 }
 async function decide(action:"post"|"ignore",entry:Statement){
  if(!workspace?.canApprove||busy)return
  const docId=selected[entry.id],reason=(reasons[entry.id]??"").trim()
  if(action==="post"&&!docId)return
  if(action==="ignore"&&(reason.length<5||reason.length>500))return
  if(!window.confirm(action==="post"?t.approveConfirm:t.ignoreConfirm))return
  setBusy(true);setFeedback("")
  try{
   const response=await fetch("/api/administration/bank-statements",{
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(action==="post"?{action,statementId:entry.id,documentId:docId}:
     {action,statementId:entry.id,reason})
   })
   if(!response.ok){setFeedback(t.failedAction);return}
   await refresh()
   setFeedback(action==="post"?t.postSuccess:t.ignoreSuccess)
  }catch{setFeedback(t.failedAction)}finally{setBusy(false)}
 }
 const rows=workspace?.statements??[]
 const totalPages=Math.max(1,Math.ceil(rows.length/pageSize))
 const currentPage=Math.min(page,totalPages)
 const visible=rows.slice((currentPage-1)*pageSize,currentPage*pageSize)
 const unresolved=rows.filter(row=>!row.posted_payment_id&&!row.ignored_at).length
 const posted=rows.filter(row=>Boolean(row.posted_payment_id)).length
 const ignored=rows.filter(row=>Boolean(row.ignored_at)).length
 const example="transaction_id,booked_on,direction,amount,currency,payment_reference,description\n"
  +"BANK-001,2026-11-09,credit,30.00,EUR,INV-2026-001,Example invoice receipt\n"
  +"BANK-002,2026-11-09,debit,10.50,EUR,SUP-2026-001,Example supplier payment\n"
 return <section className="space-y-4 rounded-2xl border bg-card p-5" aria-label={t.title}>
  <h2 className="text-lg font-semibold">{t.title}</h2>
  <p className="text-sm text-muted-foreground">{t.intro}</p>
  <button type="button" disabled={busy||loading} onClick={()=>{resetFile();void refresh()}} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{t.refresh}</button>
  {loading&&<p role="status">{t.refresh}…</p>}
  {error&&<p role="alert" className="text-sm text-destructive">{t.error}</p>}
  {!loading&&!error&&<div className="space-y-3 rounded-xl border p-3">
   <label className="grid gap-1 text-sm">{t.upload}
    <input type="file" accept=".csv,text/csv" disabled={busy} onChange={chooseFile} className="max-w-full rounded-lg border p-2"/>
   </label>
   <a href={"data:text/csv;charset=utf-8,"+encodeURIComponent(example)} download="bank-statement-example.csv" className="text-sm text-violet-400 underline">{t.template}</a>
   {preview&&<div role="status" className="text-sm">{preview.errors.length
    ?<p>{t.invalid} ({preview.errors.slice(0,20).map(row=>row.line).join(", ")})</p>
    :<p>{t.valid}: {t.rows} {preview.rows.length} · {t.credit}: {money(preview.creditCents)} · {t.debit}: {money(preview.debitCents)}</p>}</div>}
   <button type="button" disabled={busy||!file||!preview||preview.errors.length>0||!preview.rows.length} onClick={()=>void importFile()} className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?t.saving:t.save}</button>
  </div>}
  {feedback&&<p role="status" className="text-sm">{feedback}</p>}
  {workspace&&!error&&<div className="space-y-3">
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
    {([{label:t.rows,value:rows.length},{label:t.unresolved,value:unresolved},{label:t.posted,value:posted},{label:t.ignored,value:ignored}]).map(k=><div key={k.label} className="rounded-xl border p-3"><strong className="block text-xl">{k.value}</strong>{k.label}</div>)}
   </div>
   {!workspace.canApprove&&<p className="text-sm text-muted-foreground">{t.onlyAdmin}</p>}
   {rows.length===0?<p className="text-sm">{t.empty}</p>:<>
    <ol className="space-y-3">{visible.map(entry=>{
     const candidates=workspace.invoices.filter(invoice=>
      (entry.direction==="credit"?invoice.kind==="sales_invoice":invoice.kind==="purchase_invoice")
       &&invoice.outstandingCents>=entry.amount_cents)
     const isPosted=Boolean(entry.posted_payment_id),isIgnored=Boolean(entry.ignored_at)
     return <li key={entry.id} className="space-y-2 rounded-xl border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
       <strong>{entry.booked_on} · {entry.transaction_id}</strong>
       <strong>{entry.direction==="credit"?"+":"−"} {money(entry.amount_cents)}</strong>
      </div>
      <p className="break-all text-muted-foreground">{t.reference}: {entry.payment_reference||"—"}</p>
      <p className="break-words">{entry.description||t.noNotes}</p>
      <p>{t.status}: <strong>{isPosted?t.posted:isIgnored?t.ignored:t.unresolved}</strong></p>
      {isPosted&&<p className="break-all">{entry.linked_document_id}</p>}
      {isIgnored&&<p className="break-words">{entry.ignored_reason}</p>}
      {!isPosted&&!isIgnored&&workspace.canApprove&&<div className="space-y-2">
       {candidates.length>0?<label className="grid gap-1">{t.select}
        <select value={selected[entry.id]??""} onChange={e=>setSelected(prev=>({...prev,[entry.id]:e.target.value}))}
         disabled={busy} className="w-full rounded-lg border bg-background p-2">
         <option value="">—</option>
         {candidates.map(invoice=><option key={invoice.id} value={invoice.id}>{invoice.number} · {t.outstanding}: {money(invoice.outstandingCents)}</option>)}
        </select>
       </label>:<p className="text-muted-foreground">{t.noCandidate}</p>}
       <button type="button" disabled={busy||!candidates.some(invoice=>invoice.id===selected[entry.id])} onClick={()=>void decide("post",entry)} className="rounded-lg border border-violet-500 px-3 py-2 font-semibold disabled:opacity-50">{busy?t.approving:t.approve}</button>
       <label className="grid gap-1">{t.ignoredReason}
        <input value={reasons[entry.id]??""} maxLength={500} disabled={busy}
         onChange={e=>setReasons(prev=>({...prev,[entry.id]:e.target.value}))}
         className="w-full rounded-lg border bg-background p-2"/>
       </label>
       <button type="button" disabled={busy||(reasons[entry.id]??"").trim().length<5} onClick={()=>void decide("ignore",entry)} className="rounded-lg border px-3 py-2 disabled:opacity-50">{t.ignore}</button>
      </div>}
     </li>
    })}</ol>
    <div className="flex items-center justify-between gap-3 text-sm">
     <button type="button" disabled={currentPage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded-lg border px-3 py-2 disabled:opacity-50">{t.previous}</button>
     <span>{t.showing} {currentPage} {t.of} {totalPages}</span>
     <button type="button" disabled={currentPage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="rounded-lg border px-3 py-2 disabled:opacity-50">{t.next}</button>
    </div>
   </>}
  </div>}
 </section>
}
