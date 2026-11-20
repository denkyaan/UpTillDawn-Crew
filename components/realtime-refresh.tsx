'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/crew-client'

const MIN_REFRESH_INTERVAL_MS=8000

const DEFAULT_TABLES = ['work_sessions','break_sessions','check_ins','check_outs','incidents','task_assignments','shifts','responsible_assignments'] as const

export function RealtimeRefresh({tables=DEFAULT_TABLES as readonly string[],debounceMs=1000}:{tables?:readonly string[];debounceMs?:number}){
 const router=useRouter()
 const timer=useRef<number|null>(null)
 const lastRefresh=useRef(0)
 useEffect(()=>{
  const supabase=createClient()
  const channel=supabase.channel(`ui-refresh-${Math.random().toString(36).slice(2)}`)
  const refresh=()=>{
   if(timer.current!==null)window.clearTimeout(timer.current)
   // One operational event can update several tables. Coalesce the changes
   // and cap refreshes so each open Admin tab does not render the full Next
   // dashboard repeatedly on the Cloudflare Workers Free 10 ms CPU tier.
   const cooldown=Math.max(0,MIN_REFRESH_INTERVAL_MS-(Date.now()-lastRefresh.current))
   timer.current=window.setTimeout(()=>{
    timer.current=null
    if(document.visibilityState!=='visible')return
    lastRefresh.current=Date.now()
    router.refresh()
   },Math.max(debounceMs,cooldown))
  }
  const onVisibility=()=>{if(document.visibilityState==='visible')refresh()}
  for(const table of tables) channel.on('postgres_changes',{event:'*',schema:'public',table},refresh)
  channel.subscribe()
  document.addEventListener('visibilitychange',onVisibility)
  return()=>{
   if(timer.current!==null)window.clearTimeout(timer.current)
   document.removeEventListener('visibilitychange',onVisibility)
   void supabase.removeChannel(channel)
  }
 },[debounceMs,router,tables])
 return null
}
