"use client"

import {useState,useRef} from "react"
import {parseSepaCsv} from "@/lib/administration/sepa-csv.mjs"
import {prepareSepaCreditTransfer} from "@/lib/administration/sepa-credit-transfer.mjs"

const copy={
 nl:{format:"Invoerformaat",check:"Controleer IBAN, datum, referenties en bedragen.",title:"SEPA-betaalbestand voorbereiden",intro:"Offline XML-export. Controleer begunstigden en bedragen vóór je het bestand bij je bank indient. Er worden geen betalingen verzonden.",debtor:"Naam rekeninghouder",iban:"IBAN rekeninghouder",date:"Uitvoeringsdatum",reference:"Batchreferentie",rows:"Betalingen (JSON-lijst met id, name, iban, amount, remittance)",create:"XML-bestand voorbereiden",ready:"Betaalbestand voorbereid. Nog niet ingediend of goedgekeurd door de bank.",error:"Ongeldige gegevens"},
 fr:{format:"Format de saisie",check:"Vérifiez les IBAN, dates, références et montants.",title:"Préparer un fichier SEPA",intro:"Export XML hors ligne. Vérifiez les bénéficiaires et montants avant transmission à la banque. Aucun paiement n'est envoyé.",debtor:"Titulaire du compte",iban:"IBAN du débiteur",date:"Date d'exécution",reference:"Référence du lot",rows:"Paiements (liste JSON: id, name, iban, amount, remittance)",create:"Préparer le fichier XML",ready:"Fichier préparé, non transmis ni approuvé par la banque.",error:"Données invalides"},
 en:{format:"Input format",check:"Check IBANs, dates, references and amounts.",title:"Prepare SEPA payment file",intro:"Offline XML export. Verify beneficiaries and amounts before submitting to your bank. No payments are sent.",debtor:"Account holder",iban:"Debtor IBAN",date:"Execution date",reference:"Batch reference",rows:"Payments (JSON array: id, name, iban, amount, remittance)",create:"Prepare XML file",ready:"File prepared; not submitted or approved by the bank.",error:"Invalid data"},
 de:{format:"Eingabeformat",check:"IBAN, Datum, Referenzen und Beträge prüfen.",title:"SEPA-Zahlungsdatei vorbereiten",intro:"Offline-XML-Export. Prüfen Sie Empfänger und Beträge vor Einreichung bei der Bank. Keine Zahlung wird gesendet.",debtor:"Kontoinhaber",iban:"IBAN des Auftraggebers",date:"Ausführungsdatum",reference:"Batchreferenz",rows:"Zahlungen (JSON-Liste: id, name, iban, amount, remittance)",create:"XML-Datei vorbereiten",ready:"Datei vorbereitet; noch nicht bei der Bank eingereicht oder genehmigt.",error:"Ungültige Daten"}
}
export default function SepaExport({locale="nl"}){
 const t=copy[locale]||copy.nl
 const fileRevision=useRef(0)
 const [debtorName,setDebtorName]=useState("")
 const [debtorIban,setDebtorIban]=useState("")
 const [executionDate,setExecutionDate]=useState("")
 const [messageId,setMessageId]=useState("")
 const [transactions,setTransactions]=useState("[]")
 const [inputFormat,setInputFormat]=useState("json")
 const [feedback,setFeedback]=useState("")
 const [isError,setIsError]=useState(false)
 const [uploadName,setUploadName]=useState("")
 async function loadCsvFile(event){
  const revision=++fileRevision.current
  const file=event.target.files?.[0]
  if(!file)return
  try{
   if(file.size>2_000_000||!file.name.toLowerCase().endsWith(".csv"))throw Error("CSV file exceeds 2 MB")
   const content=await file.text()
   parseSepaCsv(content)
   if(revision!==fileRevision.current)return
   setInputFormat("csv")
   setTransactions(content)
   setUploadName(file.name)
   setIsError(false)
   setFeedback("")
  }catch{
   if(revision!==fileRevision.current)return
   setIsError(true)
   setFeedback(`${t.error}. ${t.check}`)
  }finally{event.target.value=""}
 }
 function prepare(event){
  event.preventDefault()
  try{
   const parsed=inputFormat==="csv"?parseSepaCsv(transactions):JSON.parse(transactions)
   const result=prepareSepaCreditTransfer({messageId,debtorName,debtorIban,executionDate,transactions:parsed})
   const url=URL.createObjectURL(new Blob([result.xml],{type:"application/xml;charset=utf-8"}))
   const link=document.createElement("a")
   link.href=url
   link.download=`sepa-${messageId}.xml`
   document.body.appendChild(link)
   link.click()
   link.remove()
   setTimeout(()=>URL.revokeObjectURL(url),1000)
   setIsError(false)
   setFeedback(`${t.ready} (${result.count} / €${(result.totalCents/100).toFixed(2)})`)
  }catch{setIsError(true);setFeedback(`${t.error}. ${t.check}`)}
 }
 return <section className="rounded-2xl border bg-card p-5" aria-label={t.title}>
  <h2 className="text-lg font-semibold">{t.title}</h2><p className="mt-2 text-sm text-muted-foreground">{t.intro}</p>
  <form className="mt-4 grid gap-3" onSubmit={prepare}>
   {[[t.debtor,debtorName,setDebtorName,"text"],[t.iban,debtorIban,setDebtorIban,"text"],[t.date,executionDate,setExecutionDate,"date"],[t.reference,messageId,setMessageId,"text"]].map(([label,value,setValue,type])=><label className="grid gap-1 text-sm" key={label}><span>{label}</span><input required type={type} value={value} onChange={event=>setValue(event.target.value)} className="rounded-lg border bg-background p-2" /></label>)}
   <label className="grid gap-1 text-sm"><span>{locale==="fr"?"Importer un fichier CSV":locale==="de"?"CSV-Datei importieren":locale==="en"?"Import CSV file":"CSV-bestand importeren"} (max. 2 MB)</span><input type="file" accept=".csv,text/csv" onChange={loadCsvFile} className="rounded-lg border bg-background p-2" /></label>
   {uploadName&&<p className="text-xs text-muted-foreground" role="status">{uploadName}</p>}
   <label className="grid gap-1 text-sm"><span>{t.format}</span><select value={inputFormat} onChange={event=>{fileRevision.current++;setInputFormat(event.target.value);setUploadName("");setTransactions(event.target.value==="csv"?"id,name,iban,amount,remittance\n":"[]")}} className="rounded-lg border bg-background p-2"><option value="json">JSON</option><option value="csv">CSV</option></select></label>
   <label className="grid gap-1 text-sm"><span>{inputFormat==="csv"?"CSV: id,name,iban,amount,remittance":t.rows}</span><textarea required rows={6} spellCheck={false} value={transactions} onChange={event=>setTransactions(event.target.value)} className="rounded-lg border bg-background p-2 font-mono" /></label>
   <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground" type="submit">{t.create}</button>
  </form>
  {feedback&&<p className={`mt-3 text-sm ${isError?"text-red-500":"text-muted-foreground"}`} role={isError?"alert":"status"}>{feedback}</p>}
 </section>
}
