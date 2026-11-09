"use client"

import {useRef,useState,type ChangeEvent} from "react"
import {useRouter} from "next/navigation"
import {invoiceCsvHeader,validateInvoiceLinesCsv} from "@/lib/administration/invoice-line-csv"
import type {SupportedUiLocale} from "@/lib/locale-preferences"

type Draft={id:string;label:string}
const translations={
 nl:{title:"Factuurregels in één keer importeren",intro:"Importeer genormaliseerde CSV-regels in een bestaande EUR-conceptfactuur. De regels worden toegevoegd, niet vervangen. Controleer alle bedragen en de originele factuur vóór goedkeuring. Dit is geen OCR.",document:"Conceptfactuur",choose:"Selecteer een concept",file:"CSV met factuurregels (max. 100 KB, 100 regels)",template:"Download voorbeeld-CSV",preview:"Voorvertoning",count:"Regels",net:"Berekend exclusief btw",tax:"Berekende btw",description:"Omschrijving",quantity:"Aantal",price:"Eenheidsprijs",vat:"Btw %",submit:"Regels toevoegen aan concept",busy:"Importeren…",saved:"Nieuwe regels toegevoegd",skipped:"Identiek bestand eerder geïmporteerd: geen dubbele regels",invalid:"CSV ongeldig. Controleer de kolommen en aangegeven rijnummers.",failed:"Import geweigerd. De factuur en regels zijn niet gedeeltelijk gewijzigd.",empty:"Maak eerst een EUR-aankoop- of verkoopfactuur als concept.",note:"Voorraad wordt pas geboekt na aparte Admin-goedkeuring en ontvangstregistratie.",confirm:"Deze gevalideerde regels toevoegen aan het geselecteerde concept?",loading:"Bestand lezen…"},
 fr:{title:"Importer les lignes de facture en une fois",intro:"Importez un CSV normalisé dans un brouillon de facture EUR. Les lignes sont ajoutées, sans remplacer les autres. Vérifiez la facture originale et les montants avant approbation. Ce n’est pas de l’OCR.",document:"Brouillon de facture",choose:"Choisir un brouillon",file:"CSV de lignes (100 Ko, 100 lignes max.)",template:"Télécharger le modèle CSV",preview:"Aperçu",count:"Lignes",net:"Net calculé",tax:"TVA calculée",description:"Description",quantity:"Quantité",price:"Prix unitaire",vat:"TVA %",submit:"Ajouter les lignes au brouillon",busy:"Importation…",saved:"Nouvelles lignes ajoutées",skipped:"Fichier identique déjà importé : aucun doublon",invalid:"CSV invalide. Vérifiez les colonnes et les numéros de lignes.",failed:"Import refusé. Aucune modification partielle de la facture.",empty:"Créez d’abord un brouillon de facture d’achat ou de vente EUR.",note:"Le stock est mis à jour uniquement après approbation et réception distinctes par Admin.",confirm:"Ajouter les lignes vérifiées au brouillon choisi ?",loading:"Lecture du fichier…"},
 en:{title:"Import invoice lines in bulk",intro:"Import normalized CSV rows into an existing EUR invoice draft. Rows append; they never replace existing lines. Verify the original invoice and amounts before approval. This is not OCR.",document:"Invoice draft",choose:"Select a draft",file:"Invoice lines CSV (max 100 KB, 100 rows)",template:"Download example CSV",preview:"Preview",count:"Rows",net:"Calculated net",tax:"Calculated VAT",description:"Description",quantity:"Quantity",price:"Unit price",vat:"VAT %",submit:"Add lines to draft",busy:"Importing…",saved:"New lines added",skipped:"Identical file already imported: no duplicated lines",invalid:"Invalid CSV. Check columns and flagged row numbers.",failed:"Import refused. Invoice and lines were not partially changed.",empty:"Create a EUR purchase or sales invoice draft first.",note:"Inventory changes only after separate Admin approval and receipt recording.",confirm:"Append these validated rows to the selected invoice draft?",loading:"Reading file…"},
 de:{title:"Rechnungspositionen gesammelt importieren",intro:"Normierte CSV-Positionen in einen bestehenden EUR-Rechnungsentwurf übernehmen. Positionen werden ergänzt, nicht ersetzt. Originalrechnung und Beträge vor Freigabe prüfen. Keine OCR-Erkennung.",document:"Rechnungsentwurf",choose:"Entwurf auswählen",file:"CSV mit Rechnungspositionen (max. 100 KB, 100 Zeilen)",template:"CSV-Beispiel herunterladen",preview:"Vorschau",count:"Positionen",net:"Berechneter Nettobetrag",tax:"Berechnete MwSt.",description:"Beschreibung",quantity:"Menge",price:"Stückpreis",vat:"MwSt. %",submit:"Positionen ergänzen",busy:"Importiere…",saved:"Neue Positionen ergänzt",skipped:"Identische Datei bereits importiert: keine doppelten Positionen",invalid:"Ungültige CSV. Spalten und Zeilennummern prüfen.",failed:"Import abgelehnt. Rechnung und Positionen wurden nicht teilweise geändert.",empty:"Zuerst EUR-Einkaufs- oder Verkaufsrechnungsentwurf erstellen.",note:"Bestandsänderungen erfordern gesonderte Admin-Freigabe und Wareneingang.",confirm:"Diese geprüften Positionen zum gewählten Entwurf hinzufügen?",loading:"Datei wird gelesen…"}
} as const

const template=invoiceCsvHeader+"\n\"Merchandising T-shirts\",10,12.50,21\n\"Venue supplies\",2,45.00,21\n"
export default function InvoiceLineCsvImport({locale,drafts}:{locale:SupportedUiLocale;drafts:Draft[]}){
 const t=translations[locale],router=useRouter()
 const inputRef=useRef<HTMLInputElement|null>(null),revision=useRef(0)
 const [documentId,setDocumentId]=useState("")
 const [file,setFile]=useState<File|null>(null)
 const [csv,setCsv]=useState<string|null>(null)
 const [reading,setReading]=useState(false),[busy,setBusy]=useState(false)
 const [requestId,setRequestId]=useState("")
 const [message,setMessage]=useState("")
 const preview=csv===null?null:validateInvoiceLinesCsv(csv)
 const money=(cents:number)=>new Intl.NumberFormat(locale==='en'?'en-BE':locale==='de'?'de-BE':locale==='fr'?'fr-BE':'nl-BE',{style:'currency',currency:'EUR'}).format(cents/100)
 async function selectedFile(event:ChangeEvent<HTMLInputElement>){
  const next=event.target.files?.[0],id=++revision.current
  setFile(null);setCsv(null);setMessage("");setRequestId("");setReading(false)
  if(!next)return
  if(next.size===0||next.size>100_000||!next.name.toLowerCase().endsWith(".csv")){
   setMessage(t.invalid);return
  }
  setReading(true)
  try{
   const contents=await next.text()
   if(id===revision.current){setFile(next);setCsv(contents);setRequestId(crypto.randomUUID())}
  }catch{if(id===revision.current)setMessage(t.invalid)}
  finally{if(id===revision.current)setReading(false)}
 }
 async function submit(){
  if(!documentId||!file||!requestId||!preview?.rows.length||preview.errors.length||busy)return
  if(!window.confirm(t.confirm))return
  setBusy(true);setMessage("")
  const form=new FormData()
  form.set("documentId",documentId);form.set("requestId",requestId);form.set("file",file)
  try{
   const response=await fetch("/api/administration/finance/invoice-lines/import",{method:"POST",body:form})
   const result=await response.json().catch(()=>({}))
   if(!response.ok||!Number.isSafeInteger(result.inserted)||!Number.isSafeInteger(result.skipped)){
    setMessage(t.failed);return
   }
   setMessage(result.inserted?t.saved+": "+result.inserted:t.skipped)
   revision.current++;setFile(null);setCsv(null);setRequestId("")
   if(inputRef.current)inputRef.current.value=""
   router.refresh()
  }catch{setMessage(t.failed)}finally{setBusy(false)}
 }
 return <section className="space-y-3 rounded-2xl border bg-card p-5" aria-label={t.title}>
  <h2 className="text-lg font-bold">{t.title}</h2>
  <p className="text-sm text-muted-foreground">{t.intro}</p>
  {!drafts.length?<p role="status" className="text-sm">{t.empty}</p>:<>
   <label className="grid gap-1 text-sm">{t.document}
    <select value={documentId} onChange={e=>{setDocumentId(e.target.value);setRequestId(csv?crypto.randomUUID():"");setMessage("")}} className="rounded-lg border bg-background p-2">
     <option value="">{t.choose}</option>
     {drafts.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
    </select>
   </label>
   <label className="grid gap-1 text-sm">{t.file}
    <input ref={inputRef} type="file" accept=".csv,text/csv" disabled={busy} onChange={selectedFile} className="max-w-full rounded-lg border p-2"/>
   </label>
   <a className="inline-flex text-sm text-violet-400 underline" href={"data:text/csv;charset=utf-8,"+encodeURIComponent(template)} download="invoice-lines-example.csv">{t.template}</a>
   {reading&&<p role="status" className="text-sm">{t.loading}</p>}
   {preview&&<div className="space-y-2 rounded-lg border p-3 text-sm" role="status">
    {preview.errors.length?<p role="alert">{t.invalid} ({preview.errors.slice(0,15).map(e=>e.line).join(", ")})</p>:<>
     <p className="font-semibold">{t.preview}: {t.count} {preview.rows.length} · {t.net}: {money(preview.netCents)} · {t.tax}: {money(preview.taxCents)}</p>
     <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead><tr><th className="p-2">{t.description}</th><th className="p-2">{t.quantity}</th><th className="p-2">{t.price}</th><th className="p-2">{t.vat}</th></tr></thead>
      <tbody>{preview.rows.slice(0,5).map((row,i)=><tr key={i} className="border-t"><td className="p-2">{row.description}</td><td className="p-2">{row.quantity}</td><td className="p-2">{row.unitPrice}</td><td className="p-2">{row.vatRate}</td></tr>)}</tbody></table></div>
    </>}
   </div>}
   <button type="button" disabled={!documentId||!file||!preview?.rows.length||Boolean(preview.errors.length)||busy||reading} onClick={()=>void submit()} className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?t.busy:t.submit}</button>
  </>}
  {message&&<p role="status" className="text-sm">{message}</p>}
  <p className="text-xs text-muted-foreground">{t.note}</p>
 </section>
}
