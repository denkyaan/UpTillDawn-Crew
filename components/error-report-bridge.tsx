'use client'

import { useEffect,useState } from 'react'
import {activeUiLocale,LANGUAGE_APPLIED_EVENT} from '@/lib/locale-preferences'
import { ErrorReportButton } from '@/components/error-report-button'

type CapturedError={
  name:string
  message:string
  stack:string
  source:'runtime'|'promise'
}

export function ErrorReportBridge(){
  const [open,setOpen]=useState(false)
  const [expanded,setExpanded]=useState(false)
  const [locale,setLocale]=useState(()=>typeof window==='undefined'?'nl':activeUiLocale())
  const [captured,setCaptured]=useState<CapturedError|null>(null)

  useEffect(()=>{
    const applyLocale=()=>setLocale(activeUiLocale())
    queueMicrotask(applyLocale)
    window.addEventListener(LANGUAGE_APPLIED_EVENT,applyLocale)
    const onError=(event:ErrorEvent)=>{
      const error=event.error instanceof Error?event.error:null
      const message=(error?.message||event.message||'Onbekende runtimefout').trim()
      if(!message)return
      setCaptured({
        name:error?.name||'Error',
        message:message.slice(0,4000),
        stack:(error?.stack||'').slice(0,12000),
        source:'runtime',
      })
      setOpen(true)
    }
    const onRejection=(event:PromiseRejectionEvent)=>{
      const error=event.reason instanceof Error?event.reason:null
      const message=(error?.message||String(event.reason||'Onbekende fout in achtergrondactie')).trim()
      if(!message)return
      setCaptured({
        name:error?.name||'UnhandledPromiseRejection',
        message:message.slice(0,4000),
        stack:(error?.stack||'').slice(0,12000),
        source:'promise',
      })
      setOpen(true)
    }
    window.addEventListener('error',onError)
    window.addEventListener('unhandledrejection',onRejection)
    return()=>{
      window.removeEventListener(LANGUAGE_APPLIED_EVENT,applyLocale)
      window.removeEventListener('error',onError)
      window.removeEventListener('unhandledrejection',onRejection)
    }
  },[])

  if(!open||!captured)return null

  const label={nl:'Fout melden',en:'Report error',fr:'Signaler une erreur',de:'Fehler melden'}[locale]
  return <div className="pointer-events-none fixed top-16 right-4 z-[90] max-w-[calc(100vw-2rem)]">
    {!expanded?<button type="button" onClick={()=>setExpanded(true)} aria-expanded={false} data-no-translate className="pointer-events-auto rounded-lg border border-amber-500/50 bg-background/95 px-3 py-2 text-xs font-bold">{label}</button>:<div className="pointer-events-auto max-h-[70dvh] overflow-y-auto">
      <section className="w-[min(360px,calc(100vw-2rem))] space-y-3 rounded-2xl border bg-background/95 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-black">Fout melden</h2>
              <p className="text-xs text-muted-foreground">De AI-assistent analyseert het rapport op de achtergrond. Als makeractie nodig is, krijgt de maker automatisch een melding.</p>
            </div>
            <button type="button" aria-label="Foutrapport sluiten" data-no-translate onClick={()=>{setOpen(false);setExpanded(false);setCaptured(null)}} className="rounded-lg border px-2 py-1">×</button>
          </div>

          <div className="rounded-xl border border-amber-500/30 p-3 text-sm">
            <b>Gedetecteerde fout</b>
            <p className="mt-1 max-h-24 overflow-auto break-words text-muted-foreground">{captured.message}</p>
          </div>

          <ErrorReportButton
            errorMessage={captured.message}
            errorName={captured.name}
            stackTrace={captured.stack}
            source={captured.source}
            compact
          />
        </section></div>}
  </div>
}
