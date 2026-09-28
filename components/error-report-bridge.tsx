'use client'

import { useEffect,useState } from 'react'
import { ErrorReportButton } from '@/components/error-report-button'

type CapturedError={
  name:string
  message:string
  stack:string
  source:'runtime'|'promise'
}

export function ErrorReportBridge(){
  const [open,setOpen]=useState(false)
  const [manual,setManual]=useState('')
  const [captured,setCaptured]=useState<CapturedError|null>(null)

  useEffect(()=>{
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
      window.removeEventListener('error',onError)
      window.removeEventListener('unhandledrejection',onRejection)
    }
  },[])

  const message=captured?.message||manual.trim()
  const source=captured?.source||'manual'

  return <div className="fixed bottom-24 left-4 z-[90] max-w-[calc(100vw-2rem)]">
    {!open
      ? <button type="button" onClick={()=>setOpen(true)} className="rounded-xl border bg-background/95 px-3 py-2 text-xs font-bold shadow-lg backdrop-blur">
          Fout melden
        </button>
      : <section className="w-[min(360px,calc(100vw-2rem))] space-y-3 rounded-2xl border bg-background/95 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-black">Fout rapporteren</h2>
              <p className="text-xs text-muted-foreground">De AI-assistent analyseert het rapport op de achtergrond. Als makeractie nodig is, krijgt de maker automatisch een melding.</p>
            </div>
            <button type="button" aria-label="Foutrapport sluiten" data-no-translate onClick={()=>{setOpen(false);setCaptured(null)}} className="rounded-lg border px-2 py-1">×</button>
          </div>

          {captured
            ? <div className="rounded-xl border border-amber-500/30 p-3 text-sm">
                <b>Gedetecteerde fout</b>
                <p className="mt-1 max-h-24 overflow-auto break-words text-muted-foreground">{captured.message}</p>
                <button type="button" onClick={()=>setCaptured(null)} className="mt-2 text-xs underline">Andere fout beschrijven</button>
              </div>
            : <textarea
                value={manual}
                onChange={event=>setManual(event.target.value)}
                maxLength={4000}
                rows={4}
                placeholder="Wat ging er fout? Beschrijf wat je deed en wat je verwachtte."
                className="w-full rounded-xl border bg-background p-3 text-sm"
              />}

          {message
            ? <ErrorReportButton
                errorMessage={message}
                errorName={captured?.name||'UserReportedError'}
                stackTrace={captured?.stack||''}
                source={source}
                compact
              />
            : <p className="text-xs text-muted-foreground">Beschrijf de fout om ze te kunnen melden.</p>}
        </section>}
  </div>
}
