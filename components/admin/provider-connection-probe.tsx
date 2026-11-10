"use client"
import {useCallback,useEffect,useRef,useState} from "react"
import type {SupportedUiLocale} from "@/lib/locale-preferences"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT} from "@/lib/locale-preferences"
import type {ConnectionProvider,ConnectionState} from "@/lib/administration/provider-connection-check"

const copy={
 nl:{check:"Verbinding testen",working:"Beveiligde verbinding controleren…",connected:"Sleutel werkt · functies nog niet geactiveerd",not_configured:"Geheime instellingen ontbreken",unauthorized:"Provider weigert de sleutel",unavailable:"Verbindingscontrole niet gelukt",error:"Test kan momenteel niet worden uitgevoerd"},
 fr:{check:"Tester la connexion",working:"Vérification de la connexion…",connected:"Clé valide · fonctionnalités non activées",not_configured:"Configuration secrète manquante",unauthorized:"Le fournisseur refuse la clé",unavailable:"Connexion non vérifiée",error:"Test temporairement indisponible"},
 en:{check:"Test connection",working:"Checking secure credentials…",connected:"Key accepted · features not activated",not_configured:"Server configuration missing",unauthorized:"Provider rejected the key",unavailable:"Connection verification failed",error:"Cannot run verification right now"},
 de:{check:"Verbindung prüfen",working:"Sichere Verbindung wird geprüft…",connected:"Schlüssel gültig · Funktionen nicht aktiviert",not_configured:"Server-Konfiguration fehlt",unauthorized:"Anbieter lehnt Schlüssel ab",unavailable:"Verbindung konnte nicht bestätigt werden",error:"Test derzeit nicht möglich"}
} as const

export function ProviderConnectionProbe({provider,initialLocale}:{provider:ConnectionProvider;initialLocale:SupportedUiLocale}){
 const [locale,setLocale]=useState<SupportedUiLocale>(initialLocale)
 const [status,setStatus]=useState<ConnectionState|null>(null)
 const [busy,setBusy]=useState(false)
 const last=useRef(0)
 const inFlight=useRef(false)
 useEffect(()=>{const apply=()=>setLocale(activeUiLocale());apply();window.addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>window.removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 const check=useCallback(async(force=false)=>{
  // Prevent overlapping requests. A just-saved key must be checked even if a
  // manual test was run within the normal 12-second rate limit.
  if(inFlight.current||(!force&&Date.now()-last.current<12000))return
  inFlight.current=true;last.current=Date.now();setBusy(true);setStatus(null)
  try{
   const response=await fetch("/api/admin/provider-connection-check",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",cache:"no-store",body:JSON.stringify({provider})})
   if(!response.ok){setStatus("unavailable");return}
   const payload:unknown=await response.json()
   if(!payload||typeof payload!=="object"||!("status" in payload)){setStatus("unavailable");return}
   const state=payload.status
   if(state==="connected"||state==="not_configured"||state==="unauthorized"||state==="unavailable")setStatus(state)
   else setStatus("unavailable")
  }catch{setStatus("unavailable")}
  finally{inFlight.current=false;setBusy(false)}
 },[provider])
 useEffect(()=>{
  const onChanged=(event:Event)=>{
   if(!(event instanceof CustomEvent)||!event.detail||event.detail.provider!==provider)return
   if(event.detail.action==="removed"){setStatus("not_configured");last.current=0;return}
   if(event.detail.action==="saved")void check(true)
  }
  window.addEventListener("uptilldawn-integration-credentials-changed",onChanged)
  return()=>window.removeEventListener("uptilldawn-integration-credentials-changed",onChanged)
 },[provider,check])
 const t=copy[locale]
 return <div className="mt-3 space-y-2 border-t pt-3">
  <button type="button" onClick={()=>void check()} disabled={busy} className="min-h-11 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50">{busy?t.working:t.check}</button>
  {status&&<p role="status" aria-live="polite" className={"text-xs font-medium "+(status==="connected"?"text-green-600":"text-amber-600")}>{t[status]}</p>}
 </div>
}
