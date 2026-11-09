'use client'
import {useEffect,useRef,useState} from 'react'
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from '@/lib/locale-preferences'
import {humanizeAppError} from '@/lib/client-error-message'
import {importBriefingLocally} from '@/lib/briefing-local-import'
import {OfflineOcrPrepButton} from '@/components/crew/offline-ocr-prep-button'
import {generateCrewBriefingDraft,crewBriefingReview,type CrewBriefingEventContext} from '@/lib/crew-briefing-template'
const templateLabels={
 nl:{button:'Gebruik crewbriefing-sjabloon',confirm:'Bestaande titel en tekst vervangen door het crewbriefing-sjabloon?',success:'Sjabloon ingevuld. Vervang alle velden tussen [ ] door de juiste eventinformatie voordat je publiceert.',review:'Nog in te vullen velden',ready:'Briefing klaar voor controle',titleMissing:'Titel ontbreekt',bodyMissing:'Instructies ontbreken',importTitle:'titel',importBody:'instructies',importJoin:' en ',importDone:'geïmporteerd. Controleer de briefing voor opslaan.',importImages:'ingesloten afbeeldingen worden automatisch als bijlage opgeslagen. Controleer alles voor opslaan.',importEmpty:'Geen leesbare briefingtekst gevonden. Controleer het bestand of vul de briefing handmatig in.',importReading:'Bestand wordt gelezen…',importFailed:'Analyse mislukt.',importHeading:'Importeer briefing',importDescription:'Importeer offline op je toestel, zonder externe AI of API-sleutel. Controleer titel en instructies altijd voor opslaan.',importFormats:'PDF, DOCX, PPTX, XLSX, TXT, CSV, JPG, PNG of WEBP · maximaal 20 MB. Afbeeldingen in DOCX, PPTX en XLSX worden waar mogelijk automatisch als bijlage toegevoegd.',titlePlaceholder:'Titel'},
 fr:{button:'Utiliser le modèle de briefing',confirm:'Remplacer le titre et le texte existants par le modèle de briefing ?',success:'Modèle inséré. Remplacez tous les champs entre [ ] par les informations de l’événement avant publication.',review:'Champs à vérifier',ready:'Briefing prêt pour vérification',titleMissing:'Titre manquant',bodyMissing:'Instructions manquantes',importTitle:'titre',importBody:'instructions',importJoin:' et ',importDone:'importés. Vérifiez le briefing avant de l’enregistrer.',importImages:'images intégrées seront automatiquement ajoutées en pièces jointes. Vérifiez tout avant d’enregistrer.',importEmpty:'Aucun texte de briefing lisible trouvé. Vérifiez le fichier ou remplissez le briefing manuellement.',importReading:'Lecture du fichier en cours…',importFailed:'Échec de l’analyse.',importHeading:'Importer un briefing',importDescription:'Importez sur votre appareil, hors ligne et sans API d'IA externe. Vérifiez le titre et les instructions avant enregistrement.',importFormats:'PDF, DOCX, PPTX, XLSX, TXT, CSV, JPG, PNG ou WEBP · 20 Mo maximum. Les images des fichiers DOCX, PPTX et XLSX sont ajoutées en pièces jointes lorsque possible.',titlePlaceholder:'Titre'},
 en:{button:'Use crew briefing template',confirm:'Replace the existing title and text with the crew briefing template?',success:'Template inserted. Replace all fields in [ ] with the correct event information before publishing.',review:'Fields requiring review',ready:'Briefing ready for review',titleMissing:'Title missing',bodyMissing:'Instructions missing',importTitle:'title',importBody:'instructions',importJoin:' and ',importDone:'imported. Review the briefing before saving.',importImages:'embedded images will be automatically saved as attachments. Review everything before saving.',importEmpty:'No readable briefing text found. Check the file or complete the briefing manually.',importReading:'Reading file…',importFailed:'Analysis failed.',importHeading:'Import briefing',importDescription:'Import locally on your device, offline and without an external AI API. Always review the title and instructions before saving.',importFormats:'PDF, DOCX, PPTX, XLSX, TXT, CSV, JPG, PNG or WEBP · maximum 20 MB. Images in DOCX, PPTX and XLSX files are attached automatically when possible.',titlePlaceholder:'Title'},
 de:{button:'Crewbriefing-Vorlage verwenden',confirm:'Vorhandenen Titel und Text durch die Crewbriefing-Vorlage ersetzen?',success:'Vorlage eingefügt. Ersetzen Sie vor der Veröffentlichung alle Felder in [ ] durch die korrekten Eventinformationen.',review:'Zu prüfende Felder',ready:'Briefing bereit zur Prüfung',titleMissing:'Titel fehlt',bodyMissing:'Anweisungen fehlen',importTitle:'Titel',importBody:'Anweisungen',importJoin:' und ',importDone:'importiert. Prüfen Sie das Briefing vor dem Speichern.',importImages:'eingebettete Bilder werden automatisch als Anhänge gespeichert. Prüfen Sie alles vor dem Speichern.',importEmpty:'Kein lesbarer Briefingtext gefunden. Prüfen Sie die Datei oder füllen Sie das Briefing manuell aus.',importReading:'Datei wird gelesen…',importFailed:'Analyse fehlgeschlagen.',importHeading:'Briefing importieren',importDescription:'Auf diesem Gerät offline und ohne externe KI-API importieren. Titel und Anweisungen vor dem Speichern prüfen.',importFormats:'PDF, DOCX, PPTX, XLSX, TXT, CSV, JPG, PNG oder WEBP · maximal 20 MB. Bilder aus DOCX-, PPTX- und XLSX-Dateien werden nach Möglichkeit automatisch angehängt.',titlePlaceholder:'Titel'}
} as const
const ACCEPT='.pdf,.docx,.pptx,.xlsx,.txt,.csv,image/jpeg,image/png,image/webp'
export function BriefingAnalysisFields({defaultTitle='',defaultBody='',bodyPlaceholder='Algemene instructie',eventName,eventContexts=[],workplaceContexts=[]}:{defaultTitle?:string;defaultBody?:string;bodyPlaceholder?:string;eventName?:string;eventContexts?:Array<{id:string}&CrewBriefingEventContext>;workplaceContexts?:Array<{id:string;event_id:string;name:string}>}){
 const [locale,setLocale]=useState<SupportedUiLocale>('nl')
 useEffect(()=>{const apply=()=>setLocale(activeUiLocale());apply();window.addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>window.removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 const t=templateLabels[locale]
 const [title,setTitle]=useState(defaultTitle),[body,setBody]=useState(defaultBody),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),extractedRef=useRef<HTMLInputElement>(null)
 const review=crewBriefingReview(title,body)
 const unresolved=review.missing
 async function analyze(file:File){
  setBusy(true);setMessage(t.importReading);if(extractedRef.current)extractedRef.current.value=''
  try{
   // Every supported format is processed locally, including Office media.
   // No upload or paid AI service is needed for this import.
   const result=await importBriefingLocally(file,locale)
   if(!result.title?.trim()&&!result.instructions?.trim())throw new Error(t.importEmpty)
   if(result.title?.trim())setTitle(result.title)
   if(result.instructions?.trim())setBody(result.instructions)
   let extracted=0
   if(extractedRef.current&&result.images.length){
    const transfer=new DataTransfer()
    for(const image of result.images)transfer.items.add(image)
    extracted=transfer.files.length
    extractedRef.current.files=transfer.files
   }
   const importedParts=[result.title?.trim()?t.importTitle:null,result.instructions?.trim()?t.importBody:null].filter(Boolean).join(t.importJoin)
   setMessage(extracted?importedParts+" "+t.importDone+" "+extracted+" "+t.importImages:importedParts+" "+t.importDone)
  }catch(error){
   const result={error:error instanceof Error?error.message:null}
   setMessage(humanizeAppError(result.error||t.importFailed))
  }finally{setBusy(false)}
 }
 return <>
  <div className="grid gap-2 rounded-xl border border-dashed p-4">
   <div className="font-semibold">{t.importHeading}</div>
   <div className="text-xs text-muted-foreground">{t.importDescription}</div>
   <input name="briefing_document" type="file" accept={ACCEPT} disabled={busy} className="rounded-lg border bg-background p-2" onChange={event=>{const file=event.target.files?.[0];if(file)void analyze(file)}}/>
   <input ref={extractedRef} name="photos" type="file" multiple className="hidden" tabIndex={-1} aria-hidden="true"/>
   <span className="text-xs text-muted-foreground">{t.importFormats}</span>
   <OfflineOcrPrepButton locale={locale}/>
   {message&&<span className="text-xs">{message}</span>}
  </div>
  <button type="button" className="rounded-lg border px-3 py-2 text-sm font-semibold" onClick={event=>{if((title.trim()||body.trim())&&!window.confirm(t.confirm))return;const form=event.currentTarget.closest('form');const data=form?new FormData(form):null;const workplaceId=String(data?.get('workplace_id')||'');const selectedEventId=String(data?.get('event_id')||'');const workplace=workplaceContexts.find(item=>item.id===workplaceId&&(!selectedEventId||item.event_id===selectedEventId));const eventId=selectedEventId||workplace?.event_id||'';const context=eventContexts.find(item=>item.id===eventId);const draft=generateCrewBriefingDraft({...context,name:context?.name||(!selectedEventId?eventName:undefined),workplace:workplace?.name});setTitle(draft.title);setBody(draft.body);setMessage(t.success)}}>{t.button}</button>
  <input name="title" required placeholder={t.titlePlaceholder} className="border bg-background p-3" value={title} onChange={event=>setTitle(event.target.value)}/>
  <textarea name="body" required placeholder={bodyPlaceholder} className="min-h-28 border bg-background p-3" value={body} onChange={event=>setBody(event.target.value)}/>
  {(title.trim()||body.trim())&&<div role="status" aria-live="polite" className={`rounded-lg border p-3 text-sm ${review.ready?'border-emerald-500/40 bg-emerald-500/10':'border-amber-500/40 bg-amber-500/10'}`}> <strong>{review.ready?t.ready:t.review}</strong>{!review.ready&&<ul className="mt-2 list-disc pl-5">{review.issues.includes('title')&&<li>{t.titleMissing}</li>}{review.issues.includes('body')&&<li>{t.bodyMissing}</li>}{unresolved.map(item=><li key={item}>{item}</li>)}</ul>}</div>}
 </>
}
