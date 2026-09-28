'use client'

import { useCallback,useEffect,useState } from 'react'
import { createClient } from '@/lib/supabase/crew-client'

type ErrorSource='boundary'|'runtime'|'promise'|'manual'|'api'
const TERMINAL_STATUSES=new Set(['auto_resolved','needs_maker','resolved','failed','dismissed'])
const isTerminal=(status:string)=>TERMINAL_STATUSES.has(status)

type ReportState={
  id:string
  status:string
  ai_category:string|null
  ai_severity:string|null
  ai_summary:string|null
  ai_user_message:string|null
  auto_action:string
  maker_action_required:boolean
  updated_at:string
  resolved_at:string|null
}

export function ErrorReportButton({
  errorMessage,
  errorName='Error',
  stackTrace='',
  source='manual',
  onRetry,
  compact=false,
}:{
  errorMessage:string
  errorName?:string
  stackTrace?:string
  source?:ErrorSource
  onRetry?:()=>void
  compact?:boolean
}){
  const [busy,setBusy]=useState(false)
  const [reportId,setReportId]=useState<string|null>(null)
  const [report,setReport]=useState<ReportState|null>(null)
  const [message,setMessage]=useState('')
  const refresh=useCallback(async(id:string)=>{
    const response=await fetch('/api/error-reports?id='+encodeURIComponent(id),{cache:'no-store'})
    const payload=await response.json().catch(()=>null) as {report?:ReportState;error?:string}|null
    if(response.ok&&payload?.report){
      setReport(payload.report)
      if(payload.report.ai_user_message)setMessage(payload.report.ai_user_message)
      if(isTerminal(payload.report.status))setBusy(false)
    }
  },[])

  useEffect(()=>{
    if(!reportId)return
    const s=createClient()
    const channel=s.channel('error-report:'+reportId)
      .on('postgres_changes',{
        event:'UPDATE',
        schema:'public',
        table:'user_error_reports',
        filter:'id=eq.'+reportId,
      },payload=>{
        const next=payload.new as ReportState
        setReport(next)
        if(next.ai_user_message)setMessage(next.ai_user_message)
        if(isTerminal(next.status))setBusy(false)
      })
      .subscribe()

    const timer=window.setInterval(()=>{
      void refresh(reportId)
    },2500)

    return()=>{
      window.clearInterval(timer)
      void s.removeChannel(channel)
    }
  },[reportId,refresh])


  async function submit(){
    if(busy)return
    setBusy(true);setMessage('Fout wordt gemeld…');setReport(null)
    try{
      const route=window.location.pathname+window.location.search
      const response=await fetch('/api/error-reports',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          route,
          errorName,
          errorMessage,
          stackTrace,
          source,
          clientContext:{
            online:navigator.onLine,
            language:navigator.language,
            viewport:{width:window.innerWidth,height:window.innerHeight},
            standalone:window.matchMedia('(display-mode: standalone)').matches,
          },
        }),
      })
      const payload=await response.json().catch(()=>null) as {id?:string;message?:string;error?:string}|null
      if(!response.ok||!payload?.id){
        setMessage(payload?.error||'Foutrapport kon niet worden verzonden.')
        setBusy(false)
        return
      }
      setReportId(payload.id)
      setMessage(payload.message||'Fout gemeld. De AI-assistent bekijkt dit nu op de achtergrond.')
      void refresh(payload.id)
    }catch{
      setMessage('Foutrapport kon niet worden verzonden.')
      setBusy(false)
    }
  }

  const action=report?.auto_action
  const canApply=report?.status==='auto_resolved'&&(action==='reload'||(action==='retry'&&Boolean(onRetry)))

  useEffect(()=>{
    if(!report||report.status!=='auto_resolved')return
    if(action!=='reload'&&action!=='retry')return
    if(action==='retry'&&!onRetry)return
    const key='upt-error-auto-action:'+report.id
    if(sessionStorage.getItem(key)==='done')return
    sessionStorage.setItem(key,'done')
    const timer=window.setTimeout(()=>{
      if(action==='retry'&&onRetry)onRetry()
      else if(action==='reload')window.location.reload()
    },700)
    return()=>window.clearTimeout(timer)
  },[action,onRetry,report])

  return <div className={compact?'space-y-2':'space-y-3'}>
    <button
      type="button"
      onClick={()=>void submit()}
      disabled={busy&&!report?.status}
      className={compact
        ? 'rounded-lg border border-amber-500/50 px-3 py-2 text-sm font-bold'
        : 'rounded-xl border border-amber-500/50 px-4 py-3 font-bold'}
    >
      {busy&&!report?'MELDEN…':reportId?'OPNIEUW MELDEN':'FOUT MELDEN'}
    </button>

    {message&&<div className="rounded-xl border p-3 text-sm">
      <p className="whitespace-pre-wrap">{message}</p>
      {report?.maker_action_required&&<p className="mt-2 font-semibold text-amber-500">De maker is automatisch op de hoogte gebracht.</p>}
      {canApply&&<button
        type="button"
        onClick={()=>{
          if(action==='retry'&&onRetry)onRetry()
          else if(action==='reload')window.location.reload()
        }}
        className="mt-3 rounded-lg bg-violet-600 px-3 py-2 font-bold text-white"
      >AI-OPLOSSING TOEPASSEN</button>}
    </div>}
  </div>
}
