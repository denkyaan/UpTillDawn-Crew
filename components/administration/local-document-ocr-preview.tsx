"use client"

import {useRef,useState} from "react"
import type {ChangeEvent} from "react"
import {FileScan,Copy,CheckCheck,ShieldCheck} from "lucide-react"
import type {SupportedUiLocale} from "@/lib/locale-preferences"
import {recognizeLocally,isSupportedLocalOcrLanguage,type LocalOcrLang,type LocalOcrResult} from "@/lib/administration/local-document-ocr"

const copy={
 nl:{
  title:"Factuur of bon lezen · lokaal op je toestel",
  intro:"Geen Cloudmersive, API-sleutel of upload. Open een foto of PDF. Tekstherkenning gebeurt op dit toestel; de OCR-software en taalbestanden worden via UpTillDawn geladen.",
  file:"Factuur, bon of PDF (JPG, PNG of PDF · max. 5 MB)",language:"Taal document",start:"Document lokaal lezen",busy:"Document verwerken…",
  reading_pdf:"PDF lokaal lezen…",loading:"OCR-engine laden…",recognizing:"Tekst herkennen…",
  result:"Gevonden tekst · controle verplicht",pages:"Pagina's",copy:"Kopieer tekst",copied:"Gekopieerd",
  error:"Lokaal lezen mislukt. Probeer een scherpe foto of een PDF met selecteerbare tekst.",
  invalid:"Kies een geldige JPG, PNG of PDF van maximaal 5 MB.",
  tooMany:"Deze PDF bevat meer dan 12 pagina's. Splits het document in kleinere bestanden.",
  empty:"Er werd geen leesbare tekst gevonden. Probeer een betere foto of vul de gegevens handmatig in.",
  note:"Controleer factuurnummer, leverancier, btw, bedragen en regels altijd tegen het origineel. Er wordt niets automatisch geboekt of aan voorraad toegevoegd.",
  privacy:"Privéverwerking: bestanden verlaten je browser niet. Eerste gebruik kan een download van OCR-taalbestanden via UpTillDawn vereisen."
 },
 fr:{
  title:"Lire une facture ou un reçu · sur cet appareil",
  intro:"Sans Cloudmersive, clé API ni téléversement. Ouvrez une image ou un PDF. La reconnaissance se fait sur cet appareil avec les fichiers OCR servis par UpTillDawn.",
  file:"Facture, reçu ou PDF (JPG, PNG ou PDF · 5 Mo max.)",language:"Langue du document",start:"Lire localement",busy:"Traitement…",
  reading_pdf:"Lecture locale du PDF…",loading:"Chargement du moteur OCR…",recognizing:"Reconnaissance du texte…",
  result:"Texte trouvé · vérification obligatoire",pages:"Pages",copy:"Copier le texte",copied:"Copié",
  error:"Lecture locale impossible. Essayez une photo plus nette ou un PDF contenant du texte sélectionnable.",
  invalid:"Choisissez une image JPG, PNG ou un PDF de 5 Mo maximum.",
  tooMany:"Ce PDF contient plus de 12 pages. Divisez-le en fichiers plus petits.",
  empty:"Aucun texte lisible trouvé. Essayez une meilleure photo ou saisissez les données manuellement.",
  note:"Vérifiez toujours le numéro, le fournisseur, la TVA, les montants et les lignes avec l'original. Aucune écriture comptable ni entrée en stock automatique.",
  privacy:"Traitement privé : les fichiers ne quittent pas le navigateur. Le premier usage peut télécharger les ressources OCR depuis UpTillDawn."
 },
 en:{
  title:"Read invoice or receipt · on this device",
  intro:"No Cloudmersive, API key or document upload. Open an image or PDF. Recognition happens on your device with OCR assets served by UpTillDawn.",
  file:"Invoice, receipt or PDF (JPG, PNG or PDF · max 5 MB)",language:"Document language",start:"Read document locally",busy:"Processing…",
  reading_pdf:"Reading PDF locally…",loading:"Loading OCR engine…",recognizing:"Recognizing text…",
  result:"Extracted text · review required",pages:"Pages",copy:"Copy text",copied:"Copied",
  error:"Local recognition failed. Try a clearer photo or a PDF containing selectable text.",
  invalid:"Select a valid JPG, PNG or PDF file up to 5 MB.",
  tooMany:"This PDF exceeds 12 pages. Split it into smaller files.",
  empty:"No readable text was found. Try a better photo or enter the details manually.",
  note:"Verify invoice number, supplier, VAT, amounts and line items against the original. Nothing is automatically posted to accounting or inventory.",
  privacy:"Private processing: files stay in your browser. First use may require downloading OCR language assets from UpTillDawn."
 },
 de:{
  title:"Rechnung oder Beleg lesen · auf diesem Gerät",
  intro:"Ohne Cloudmersive, API-Schlüssel oder Datei-Upload. Foto oder PDF öffnen. Die Texterkennung erfolgt auf dem Gerät mit OCR-Dateien von UpTillDawn.",
  file:"Rechnung, Beleg oder PDF (JPG, PNG oder PDF · max. 5 MB)",language:"Dokumentsprache",start:"Dokument lokal lesen",busy:"Verarbeitung…",
  reading_pdf:"PDF lokal lesen…",loading:"OCR-Engine laden…",recognizing:"Texterkennung…",
  result:"Erkannter Text · Prüfung erforderlich",pages:"Seiten",copy:"Text kopieren",copied:"Kopiert",
  error:"Lokales Lesen fehlgeschlagen. Ein schärferes Foto oder PDF mit auswählbarem Text versuchen.",
  invalid:"Gültige JPG-, PNG- oder PDF-Datei bis 5 MB wählen.",
  tooMany:"Dieses PDF hat mehr als 12 Seiten. In kleinere Dateien aufteilen.",
  empty:"Kein lesbarer Text gefunden. Besseres Foto versuchen oder Daten manuell eingeben.",
  note:"Rechnungsnummer, Lieferant, MwSt., Beträge und Positionen mit Original vergleichen. Keine automatische Buchung oder Lageränderung.",
  privacy:"Private Verarbeitung: Dateien verlassen den Browser nicht. Beim ersten Mal werden eventuell OCR-Dateien von UpTillDawn geladen."
 }
} as const

export default function LocalDocumentOcrPreview({locale}:{locale:SupportedUiLocale}){
 const t=copy[locale]
 const [file,setFile]=useState<File|null>(null)
 const [language,setLanguage]=useState<LocalOcrLang>("nld")
 const [busy,setBusy]=useState(false)
 const [progress,setProgress]=useState(0)
 const [phase,setPhase]=useState<"loading"|"reading_pdf"|"recognizing">("loading")
 const [error,setError]=useState("")
 const [result,setResult]=useState<LocalOcrResult|null>(null)
 const [copied,setCopied]=useState(false)
 const revision=useRef(0)
 function changeFile(event:ChangeEvent<HTMLInputElement>){
  revision.current+=1
  setFile(event.target.files?.[0]??null)
  setResult(null);setBusy(false);setProgress(0);setError("");setCopied(false)
 }
 async function start(){
  if(busy)return
  if(!file||file.size<8||file.size>5*1024*1024){setError(t.invalid);return}
  const run=++revision.current
  setBusy(true);setError("");setProgress(0);setPhase("loading");setResult(null);setCopied(false)
  try{
   const value=await recognizeLocally(file,language,(amount,state)=>{
    if(run!==revision.current)return
    setProgress(Math.round(Math.max(0,Math.min(1,amount))*100))
    if(state==="loading"||state==="reading_pdf"||state==="recognizing")setPhase(state)
   },()=>run!==revision.current)
   if(run===revision.current)setResult(value)
  }catch(e){
   if(run===revision.current){
    const reason=e instanceof Error?e.message:""
    if(reason!=="local_ocr_cancelled")setError(reason==="local_ocr_pdf_pages_exceeded"?t.tooMany:reason==="local_ocr_no_text"?t.empty:reason.includes("invalid")||reason.includes("unsupported")?t.invalid:t.error)
   }
  }finally{if(run===revision.current)setBusy(false)}
 }
 function selectLanguage(value:string){
  if(!isSupportedLocalOcrLanguage(value))return
  revision.current+=1;setLanguage(value);setResult(null);setError("");setCopied(false);setBusy(false)
 }
 return <section aria-label={t.title} className="space-y-3 rounded-2xl border bg-card p-5">
  <div className="flex items-center gap-2"><FileScan className="h-5 w-5 text-violet-400"/><h2 className="text-lg font-bold">{t.title}</h2></div>
  <p className="text-sm text-muted-foreground">{t.intro}</p>
  <div className="grid gap-3 sm:grid-cols-2">
   <label className="grid gap-1 text-sm">{t.file}<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={changeFile} className="min-w-0 rounded-lg border bg-background p-2 text-xs"/></label>
   <label className="grid gap-1 text-sm">{t.language}<select value={language} onChange={event=>selectLanguage(event.target.value)} className="rounded-lg border bg-background p-2"><option value="nld">Nederlands</option><option value="fra">Français</option><option value="eng">English</option><option value="deu">Deutsch</option></select></label>
  </div>
  <button type="button" onClick={()=>void start()} disabled={!file||busy} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy?t.busy:t.start}</button>
  {busy&&<div role="status" className="space-y-1 text-sm text-muted-foreground">
   <p>{phase==="reading_pdf"?t.reading_pdf:phase==="recognizing"?t.recognizing:t.loading} {progress}%</p>
   <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-violet-500 transition-all" style={{width:progress+"%"}}/></div>
  </div>}
  {error&&<p role="alert" className="text-sm text-red-500">{error}</p>}
  {result&&<div className="space-y-2 rounded-xl border p-3">
   <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{t.result}</strong><span className="text-xs text-muted-foreground">{t.pages}: {result.pages}</span></div>
   <textarea readOnly data-no-translate aria-label={t.result} value={result.text} rows={10} className="w-full resize-y rounded-lg border bg-background p-3 text-xs"/>
   <button type="button" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" onClick={()=>{void navigator.clipboard.writeText(result.text).then(()=>setCopied(true)).catch(()=>setCopied(false))}}>{copied?<CheckCheck className="h-4 w-4"/>:<Copy className="h-4 w-4"/>}{copied?t.copied:t.copy}</button>
  </div>}
  <p className="text-xs text-amber-500">{t.note}</p>
  <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0"/>{t.privacy}</p>
 </section>
}
