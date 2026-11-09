"use client"

import {useState} from "react"
import type {ChangeEvent} from "react"
import {FileScan,Copy,CheckCheck} from "lucide-react"
import type {SupportedUiLocale} from "@/lib/locale-preferences"

type OcrPreview={text:string;pages:number;confidence:number|null;reviewRequired:true}
const copy={
 nl:{title:"Factuur of bon herkennen (OCR)",intro:"Upload een PDF of foto. Alleen na het aanklikken van Herkennen wordt het bestand veilig naar de externe OCR-provider Cloudmersive gestuurd. Controleer altijd de originele factuur.",file:"Factuurfoto of PDF (PNG, JPG of PDF, max. 5 MB)",language:"Taal document",start:"Tekst herkennen",busy:"Bezig met herkennen…",result:"Herkende tekst — controle verplicht",pages:"Pagina's",copy:"Tekst kopiëren",copied:"Gekopieerd",error:"OCR mislukt of provider niet verbonden. Controleer het bestand en de Cloudmersive-instellingen.",note:"Deze tekst is een voorstel, geen boekhoudkundige of inventarisboeking. Gebruik de bestaande conceptfactuur en CSV-controle voor bedragen en regels. De voorraad wordt niet automatisch gewijzigd."},
 fr:{title:"Reconnaissance de facture ou reçu (OCR)",intro:"Téléversez un PDF ou une photo. Le fichier est transmis à Cloudmersive uniquement après votre demande de reconnaissance. Vérifiez toujours le document original.",file:"Photo ou PDF (PNG, JPG ou PDF, 5 Mo max.)",language:"Langue du document",start:"Reconnaître le texte",busy:"Reconnaissance en cours…",result:"Texte reconnu — vérification obligatoire",pages:"Pages",copy:"Copier le texte",copied:"Copié",error:"OCR indisponible ou prestataire non configuré. Vérifiez le fichier et la configuration Cloudmersive.",note:"Ce texte est une proposition, pas une écriture comptable ni une entrée en stock. Vérifiez les montants et les lignes dans le brouillon et le CSV existants. Aucun stock n'est modifié automatiquement."},
 en:{title:"Recognize invoice or receipt (OCR)",intro:"Upload a PDF or photo. The file is sent to external provider Cloudmersive only after you click Recognize. Always verify the original invoice.",file:"Invoice photo or PDF (PNG, JPG or PDF, max 5 MB)",language:"Document language",start:"Recognize text",busy:"Recognizing…",result:"Recognized text — review required",pages:"Pages",copy:"Copy text",copied:"Copied",error:"OCR failed or provider is not connected. Check the file and Cloudmersive settings.",note:"This text is a suggestion, not an accounting or inventory entry. Review the draft invoice and use the existing validated CSV import for amounts and lines. Stock is never updated automatically."},
 de:{title:"Rechnung oder Beleg erkennen (OCR)",intro:"PDF oder Foto hochladen. Erst nach Klick auf Erkennen wird die Datei an Cloudmersive übertragen. Das Original immer prüfen.",file:"Rechnungsfoto oder PDF (PNG, JPG oder PDF, max. 5 MB)",language:"Dokumentsprache",start:"Text erkennen",busy:"Erkennung läuft…",result:"Erkannter Text — Prüfung erforderlich",pages:"Seiten",copy:"Text kopieren",copied:"Kopiert",error:"OCR fehlgeschlagen oder Anbieter nicht verbunden. Datei und Cloudmersive-Einstellungen prüfen.",note:"Dieser Text ist nur ein Vorschlag, keine Buchung und kein Lagerzugang. Beträge und Positionen im Entwurf und geprüften CSV-Import überprüfen. Der Lagerbestand wird nicht automatisch verändert."}
} as const

export default function CloudmersiveOcrPreview({locale}:{locale:SupportedUiLocale}){
 const t=copy[locale]
 const [file,setFile]=useState<File|null>(null)
 const [language,setLanguage]=useState("NLD")
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState(false)
 const [result,setResult]=useState<OcrPreview|null>(null)
 const [copied,setCopied]=useState(false)
 function onFile(event:ChangeEvent<HTMLInputElement>){
  setFile(event.target.files?.[0]??null);setResult(null);setError(false);setCopied(false)
 }
 async function recognize(){
  if(!file||file.size===0||file.size>5*1024*1024||busy){setError(true);return}
  setBusy(true);setError(false);setResult(null);setCopied(false)
  const data=new FormData()
  data.set("file",file);data.set("language",language)
  try{
   const response=await fetch("/api/administration/ocr",{method:"POST",body:data,cache:"no-store"})
   const json:unknown=await response.json()
   if(!response.ok||!json||typeof json!=="object"||!('text' in json)||
      typeof json.text!=="string"||!('reviewRequired' in json)||json.reviewRequired!==true)throw new Error("ocr_failed")
   const value=json as OcrPreview
   setResult(value)
  }catch{setError(true)}finally{setBusy(false)}
 }
 return <section className="space-y-3 rounded-2xl border bg-card p-5" aria-label={t.title}>
  <div className="flex items-center gap-2"><FileScan className="h-5 w-5 text-violet-400"/><h2 className="text-lg font-bold">{t.title}</h2></div>
  <p className="text-sm text-muted-foreground">{t.intro}</p>
  <div className="grid gap-3 sm:grid-cols-2">
   <label className="grid gap-1 text-sm">{t.file}<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={onFile} className="min-w-0 rounded-lg border bg-background p-2 text-xs"/></label>
   <label className="grid gap-1 text-sm">{t.language}<select value={language} onChange={e=>setLanguage(e.target.value)} className="rounded-lg border bg-background p-2"><option value="NLD">Nederlands</option><option value="FRA">Français</option><option value="ENG">English</option><option value="DEU">Deutsch</option></select></label>
  </div>
  <button type="button" onClick={()=>void recognize()} disabled={!file||busy} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy?t.busy:t.start}</button>
  {error&&<p role="alert" className="text-sm text-red-500">{t.error}</p>}
  {result&&<div className="space-y-2 rounded-xl border p-3">
   <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{t.result}</strong><span className="text-xs text-muted-foreground">{t.pages}: {result.pages}</span></div>
   <textarea readOnly data-no-translate aria-label={t.result} value={result.text} rows={10} className="w-full resize-y rounded-lg border bg-background p-3 text-xs"/>
   <button type="button" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" onClick={()=>{void navigator.clipboard.writeText(result.text).then(()=>setCopied(true)).catch(()=>setCopied(false))}}>{copied?<CheckCheck className="h-4 w-4"/>:<Copy className="h-4 w-4"/>}{copied?t.copied:t.copy}</button>
  </div>}
  <p className="text-xs text-amber-500">{t.note}</p>
 </section>
}
