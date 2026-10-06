'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/crew-client'

const DEFAULT_TABLES = ['work_sessions','break_sessions','check_ins','check_outs','incidents','task_assignments','shifts','responsible_assignments'] as const

export function RealtimeRefresh({tables=DEFAULT_TABLES as readonly string[],debounceMs=250}:{tables?:readonly string[];debounceMs?:number}){
 const router=useRouter()
 const timer=useRef<number|null>(null)
 useEffect(()=>{
  const supabase=createClient()
  const channel=supabase.channel(`ui-refresh-${Math.random().toString(36).slice(2)}`)
  const refresh=()=>{
   if(timer.current!==null)window.clearTimeout(timer.current)
   timer.current=window.setTimeout(()=>{if(document.visibilityState==='visible')router.refresh()},debounceMs)
  }
  for(const table of tables) channel.on('postgres_changes',{event:'*',schema:'public',table},refresh)
  channel.subscribe()
  return()=>{
   if(timer.current!==null)window.clearTimeout(timer.current)
   void supabase.removeChannel(channel)
  }
 },[debounceMs,router,tables])
 return null
}
