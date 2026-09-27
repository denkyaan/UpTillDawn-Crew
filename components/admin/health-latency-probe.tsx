'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/crew-client'

type Probe={latencyMs:number;status:'healthy'|'degraded'|'unavailable'}|null

export function HealthLatencyProbe(){
  const [probe,setProbe]=useState<Probe>(null)
  useEffect(()=>{
    let cancelled=false
    const s=createClient()
    void (async()=>{
      const started=performance.now()
      const {error}=await s.rpc('upt_admin_system_health')
      const latencyMs=Math.max(0,Math.round(performance.now()-started))
      if(cancelled)return
      setProbe({
        latencyMs,
        status:error?'unavailable':latencyMs>2000?'unavailable':latencyMs>1000?'degraded':'healthy',
      })
    })()
    return()=>{cancelled=true}
  },[])

  const status=probe?.status
  const label=!probe?'METEN…':status==='healthy'?'GEZOND':status==='degraded'?'AANDACHT':'PROBLEEM'
  const style=!probe
    ?'border-muted-foreground/30 text-muted-foreground'
    :status==='healthy'
      ?'border-emerald-500/50 text-emerald-600'
      :status==='degraded'
        ?'border-amber-500/50 text-amber-600'
        :'border-red-500/50 text-red-600'

  return <div className="space-y-3 rounded-2xl border p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold">Database & API</h2>
        <p className="text-sm text-muted-foreground">Live round-trip naar de admin health-RPC.</p>
      </div>
      <span className={'rounded-full border px-2 py-1 text-xs font-black '+style}>{label}</span>
    </div>
    <div className="rounded-xl border p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">RPC latency</p>
      <p className="mt-1 text-2xl font-black">{probe?probe.latencyMs+' ms':'—'}</p>
      <p className="mt-1 text-xs text-muted-foreground">{!probe?'Probe wordt uitgevoerd':probe.latencyMs>1000?'Boven de 1000 ms SLO-grens':'Binnen de 1000 ms SLO-grens'}</p>
    </div>
  </div>
}
