"use client"
import {useState} from "react"
import type {SupportedUiLocale} from "@/lib/locale-preferences"
import {prepareOfflineOcr} from "@/lib/offline-ocr-precache"
import type {LocalOcrLang} from "@/lib/administration/local-document-ocr"

const copy={
 nl:{button:"OCR offline voorbereiden",busy:"OCR-bestanden lokaal opslaan…",ready:"OCR-bestanden opgeslagen voor offline gebruik. De browser kan deze bij opslagtekort verwijderen.",error:"Offline voorbereiding mislukt. Controleer je verbinding en vrije opslagruimte.",language:"OCR-taal"},
 fr:{button:"Préparer l'OCR hors ligne",busy:"Enregistrement des fichiers OCR…",ready:"Fichiers OCR enregistrés pour une utilisation hors ligne. Le navigateur peut les supprimer si l'espace manque.",error:"Préparation hors ligne impossible. Vérifiez la connexion et l'espace disponible.",language:"Langue OCR"},
 en:{button:"Prepare OCR for offline use",busy:"Saving OCR files locally…",ready:"OCR files saved for offline use. Browser storage cleanup can still remove them.",error:"Offline preparation failed. Check your connection and free storage.",language:"OCR language"},
 de:{button:"OCR offline vorbereiten",busy:"OCR-Dateien lokal speichern…",ready:"OCR-Dateien für Offline-Nutzung gespeichert. Bei Speichermangel kann der Browser sie entfernen.",error:"Offline-Vorbereitung fehlgeschlagen. Verbindung und Speicherplatz prüfen.",language:"OCR-Sprache"}
} as const

export function OfflineOcrPrepButton({locale}:{locale:SupportedUiLocale}){
 const t=copy[locale]
 const languageByLocale:Record<SupportedUiLocale,LocalOcrLang>={nl:"nld",fr:"fra",en:"eng",de:"deu"}
 const [busy,setBusy]=useState(false)
 const [ready,setReady]=useState(false)
 const [error,setError]=useState(false)
 const [progress,setProgress]=useState(0)
 async function start(){
  if(busy)return
  setBusy(true);setReady(false);setError(false);setProgress(0)
  try{
   await prepareOfflineOcr(languageByLocale[locale],(done,total)=>setProgress(Math.round(done*100/total)))
   setReady(true)
  }catch{setError(true)}
  finally{setBusy(false)}
 }
 return <div className="flex flex-wrap items-center gap-2 text-xs">
  <button type="button" disabled={busy} onClick={()=>void start()} className="rounded-lg border px-3 py-2 font-semibold disabled:opacity-50">{busy?t.busy:t.button}</button>
  {busy&&<span role="status">{progress}%</span>}
  {ready&&<span role="status" className="text-emerald-600">{t.ready}</span>}
  {error&&<span role="alert" className="text-amber-600">{t.error}</span>}
 </div>
}
