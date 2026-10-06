'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/providers'
import { queued, queuedUploads, synchronize, type QueuedOperation, type QueuedUpload } from '@/lib/crew-queue'
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from '@/lib/locale-preferences'

const t=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])

export function QueueStatus() {
  const { user } = useAuth()
  const [ops, setOps] = useState<QueuedOperation[]>([])
  const [uploads, setUploads] = useState<QueuedUpload[]>([])
  const [online,setOnline]=useState(()=>typeof navigator==='undefined'?true:navigator.onLine)
  const [syncing,setSyncing]=useState(false)
  const [lastSynced,setLastSynced]=useState<number|null>(null)
  const [l,setL]=useState<SupportedUiLocale>(()=>typeof window==='undefined'?'nl':activeUiLocale())

  useEffect(()=>{const f=()=>setL(activeUiLocale());addEventListener(LANGUAGE_APPLIED_EVENT,f);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,f)},[])
  useEffect(() => {
    if (!user) return
    const id = user.id
    let alive = true
    const refresh = () => {
      void Promise.all([queued(id), queuedUploads(id)]).then(([nextOps, nextUploads]) => {
        if (!alive) return
        setOps(nextOps)
        setUploads(nextUploads)
      }).catch(() => {})
    }
    const sync = () => {
      if(!navigator.onLine)return
      setSyncing(true)
      void synchronize(id).then(()=>{if(alive)setLastSynced(Date.now())}).catch(()=>{}).finally(()=>{if(alive)setSyncing(false)})
    }
    const onOnline=()=>{setOnline(true);sync()}
    const onOffline=()=>setOnline(false)
    refresh()
    sync()
    window.addEventListener('crew-queue-change', refresh)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const timer = setInterval(sync, 30000)
    return () => {
      alive = false
      clearInterval(timer)
      window.removeEventListener('crew-queue-change', refresh)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [user])

  const total = ops.length + uploads.length
  const hasError = ops.some(x => x.error) || uploads.some(x => x.error)
  if (!total&&online&&!syncing) return null

  const state=!online?'offline':hasError?'error':syncing?'syncing':total?'pending':'synced'
  const label={
    offline:t(l,'OFFLINE · acties blijven veilig op dit toestel','OFFLINE · actions stay safely on this device','HORS LIGNE · les actions restent sur cet appareil','OFFLINE · Aktionen bleiben sicher auf diesem Gerät'),
    error:t(l,'SYNCHRONISATIE VEREIST CONTROLE','SYNC NEEDS ATTENTION','LA SYNCHRONISATION NÉCESSITE UN CONTRÔLE','SYNCHRONISIERUNG MUSS GEPRÜFT WERDEN'),
    syncing:t(l,'SYNCHRONISEREN…','SYNCING…','SYNCHRONISATION…','SYNCHRONISIERUNG…'),
    pending:t(l,'WACHT OP SYNCHRONISATIE','WAITING TO SYNC','EN ATTENTE DE SYNCHRONISATION','WARTET AUF SYNCHRONISIERUNG'),
    synced:t(l,'GESYNCHRONISEERD','SYNCED','SYNCHRONISÉ','SYNCHRONISIERT'),
  }[state]

  return <aside role="status" data-sync-state={state} className="border-b border-amber-400/30 bg-amber-950 p-3 text-sm text-amber-100">
    <b>{label}</b>
    {total>0&&<span className="ml-2">{t(l,`${ops.length} actie(s) en ${uploads.length} bestand(en) wachten op bevestiging.`,`${ops.length} action(s) and ${uploads.length} file(s) await confirmation.`,`${ops.length} action(s) et ${uploads.length} fichier(s) attendent confirmation.`,`${ops.length} Aktion(en) und ${uploads.length} Datei(en) warten auf Bestätigung.`)}</span>}
    {hasError && <p>{t(l,'Niets wordt stilzwijgend verwijderd. Open details om het probleem op te lossen.','Nothing is silently discarded. Open details to resolve the problem.','Rien n’est supprimé silencieusement. Ouvrez les détails pour résoudre le problème.','Nichts wird stillschweigend verworfen. Öffne die Details, um das Problem zu lösen.')}</p>}
    {lastSynced&&!total&&<span className="ml-2 text-xs opacity-80">{new Date(lastSynced).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>}
    {online&&total>0&&<button disabled={syncing} className="ml-3 underline disabled:opacity-50" onClick={() => user && (()=>{setSyncing(true);void synchronize(user.id).then(()=>setLastSynced(Date.now())).finally(()=>setSyncing(false))})()}>{t(l,'Opnieuw proberen','Retry','Réessayer','Erneut versuchen')}</button>}
    <Link href="/sync" className="ml-3 underline">{t(l,'Details / probleem oplossen','Details / resolve issue','Détails / résoudre','Details / Problem lösen')}</Link>
  </aside>
}