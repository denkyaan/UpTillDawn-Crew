'use client'
import {useEffect,useRef,useState} from 'react'
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from '@/lib/locale-preferences'
import {humanizeAppError} from '@/lib/client-error-message'
import {generateCrewBriefingDraft,crewBriefingReview,type CrewBriefingEventContext} from '@/lib/crew-briefing-template'
const templateLabels={
 nl:{button:'Gebruik crewbriefing-sjabloon',confirm:'Bestaande titel en tekst vervangen door het crewbriefing-sjabloon?',success:'Sjabloon ingevuld. Vervang alle velden tussen [ ] door de juiste eventinformatie voordat je publiceert.',review:'Nog in te vullen velden',ready:'Briefing klaar voor controle',titleMissing:'Titel ontbreekt',bodyMissing:'Instructies ontbreken',importTitle:'titel',importBody:'instructies',importJoin:' en ',importDone:'geïmporteerd. Controleer de briefing voor opslaan.',importImages:'ingesloten afbeeldingen worden automatisch als bijlage opgeslagen. Controleer alles voor opslaan.',importEmpty:'Geen leesbare briefingtekst gevonden. Controleer het bestand of vul de briefing handmatig in.',importReading:'Bestand wordt gelezen…',importFailed:'Analyse mislukt.'},
 fr:{button:'Utiliser le modèle de briefing',confirm:'Remplacer le titre et le texte existants par le modèle de briefing ?',success:'Modèle inséré. Remplacez tous les champs entre [ ] par les informations de l’événement avant publication.',review:'Champs à vérifier',ready:'Briefing prêt pour vérification',titleMissing:'Titre manquant',bodyMissing:'Instructions manquantes',importTitle:'titre',importBody:'instructions',importJoin:' et ',importDone:'importés. Vérifiez le briefing avant de l’enregistrer.',importImages:'images intégrées seront automatiquement ajoutées en pièces jointes. Vérifiez tout avant d’enregistrer.',importEmpty:'Aucun texte de briefing lisible trouvé. Vérifiez le fichier ou remplissez le briefing manuellement.',importReading:'Lecture du fichier en cours…',importFailed:'Échec de l’analyse.'},
 en:{button:'Use crew briefing template',confirm:'Replace the existing title and text with the crew briefing template?',success:'Template inserted. Replace all fields in [ ] with the correct event information before publishing.',review:'Fields requiring review',ready:'Briefing ready for review',titleMissing:'Title missing',bodyMissing:'Instructions missing',importTitle:'title',importBody:'instructions',importJoin:' and ',importDone:'imported. Review the briefing before saving.',importImages:'embedded images will be automatically saved as attachments. Review everything before saving.',importEmpty:'No readable briefing text found. Check the file or complete the briefing manually.',importReading:'Reading file…',importFailed:'Analysis failed.'},
 de:{button:'Crewbriefing-Vorlage verwenden',confirm:'Vorhandenen Titel und Text durch die Crewbriefing-Vorlage ersetzen?',success:'Vorlage eingefügt. Ersetzen Sie vor der Veröffentlichung alle Felder in [ ] durch die korrekten Eventinformationen.',review:'Zu prüfende Felder',ready:'Briefing bereit zur Prüfung',titleMissing:'Titel fehlt',bodyMissing:'Anweisungen fehlen',importTitle:'Titel',importBody:'Anweisungen',importJoin:' und ',importDone:'importiert. Prüfen Sie das Briefing vor dem Speichern.',importImages:'eingebettete Bilder werden automatisch als Anhänge gespeichert. Prüfen Sie alles vor dem Speichern.',importEmpty:'Kein lesbarer Briefingtext gefunden. Prüfen Sie die Datei oder füllen Sie das Briefing manuell aus.',importReading:'Datei wird gelesen…',importFailed:'Analyse fehlgeschlagen.'}
} as const
const ACCEPT='.pdf,.docx,.pptx,.xlsx,.txt,.csv,image/jpeg,image/png,image/webp'
type ExtractedImage={name:string;mimeType:string;base64:string}
function decodedFile(image:ExtractedImage){const binary=atob(image.base64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new File([bytes],image.name,{type:image.mimeType})}
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
   const analysisForm=new FormData();analysisForm.set('file',file)
   const mediaForm=new FormData();mediaForm.set('file',file)
   const [analysisResponse,mediaResponse]=await Promise.all([fetch('/api/briefing-analyze',{method:'POST',body:analysisForm}),fetch('/api/briefing-extract-media',{method:'POST',body:mediaForm})])
   const result=await analysisResponse.json() as {title?:string;instructions?:string;error?:string};if(!analysisResponse.ok)throw new Error(humanizeAppError(result.error||t.importFailed));if(!result.title?.trim()&&!result.instructions?.trim())throw new Error(t.importEmpty);if(result.title?.trim())setTitle(result.title);if(result.instructions?.trim())setBody(result.instructions)
   let extracted=0
   if(mediaResponse.ok&&extractedRef.current){const media=await mediaResponse.json() as {images?:ExtractedImage[]};const transfer=new DataTransfer();for(const image of media.images||[])transfer.items.add(decodedFile(image));extracted=transfer.files.length;extractedRef.current.files=transfer.files}
   const importedParts=[result.title?.trim()?t.importTitle:null,result.instructions?.trim()?t.importBody:null].filter(Boolean).join(t.importJoin);setMessage(extracted?`${importedParts} ${t.importDone} ${extracted} ${t.importImages}`:`${importedParts} ${t.importDone}`)
  }catch(error){setMessage(humanizeAppError(error))}finally{setBusy(false)}
 }
 return <>
  <div className="grid gap-2 rounded-xl border border-dashed p-4">
   <div className="font-semibold">Importeer briefing</div>
   <div className="text-xs text-muted-foreground">Importeer een bestaand briefingbestand. De titel en algemene instructies worden automatisch uitgelezen en ingevuld.</div>
   <input name="briefing_document" type="file" accept={ACCEPT} disabled={busy} className="rounded-lg border bg-background p-2" onChange={event=>{const file=event.target.files?.[0];if(file)void analyze(file)}}/>
   <input ref={extractedRef} name="photos" type="file" multiple className="hidden" tabIndex={-1} aria-hidden="true"/>
   <span className="text-xs text-muted-foreground">PDF, DOCX, PPTX, XLSX, TXT, CSV, JPG, PNG of WEBP · maximaal 20 MB. Afbeeldingen in DOCX, PPTX en XLSX worden waar mogelijk automatisch als bijlage toegevoegd.</span>
   {message&&<span className="text-xs">{message}</span>}
  </div>
  <button type="button" className="rounded-lg border px-3 py-2 text-sm font-semibold" onClick={event=>{if((title.trim()||body.trim())&&!window.confirm(t.confirm))return;const form=event.currentTarget.closest('form');const data=form?new FormData(form):null;const workplaceId=String(data?.get('workplace_id')||'');const selectedEventId=String(data?.get('event_id')||'');const workplace=workplaceContexts.find(item=>item.id===workplaceId&&(!selectedEventId||item.event_id===selectedEventId));const eventId=selectedEventId||workplace?.event_id||'';const context=eventContexts.find(item=>item.id===eventId);const draft=generateCrewBriefingDraft({...context,name:context?.name||(!selectedEventId?eventName:undefined),workplace:workplace?.name});setTitle(draft.title);setBody(draft.body);setMessage(t.success)}}>{t.button}</button>
  <input name="title" required placeholder="Titel" className="border bg-background p-3" value={title} onChange={event=>setTitle(event.target.value)}/>
  <textarea name="body" required placeholder={bodyPlaceholder} className="min-h-28 border bg-background p-3" value={body} onChange={event=>setBody(event.target.value)}/>
  {(title.trim()||body.trim())&&<div role="status" aria-live="polite" className={`rounded-lg border p-3 text-sm ${review.ready?'border-emerald-500/40 bg-emerald-500/10':'border-amber-500/40 bg-amber-500/10'}`}> <strong>{review.ready?t.ready:t.review}</strong>{!review.ready&&<ul className="mt-2 list-disc pl-5">{review.issues.includes('title')&&<li>{t.titleMissing}</li>}{review.issues.includes('body')&&<li>{t.bodyMissing}</li>}{unresolved.map(item=><li key={item}>{item}</li>)}</ul>}</div>}
 </>
}
