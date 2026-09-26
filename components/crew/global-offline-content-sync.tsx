'use client'

import {useEffect} from 'react'
import {createClient} from '@/lib/supabase/crew-client'
import {saveOfflineBriefings,saveOfflineTasks,type OfflineBriefing,type OfflineTask} from '@/lib/crew-offline-snapshot'

export function GlobalOfflineContentSync({userId}:{userId:string}){
 useEffect(()=>{
  if(!navigator.onLine)return
  const s=createClient()
  let cancelled=false
  void (async()=>{
   const [{data:briefings},{data:personal},{data:assignments}]=await Promise.all([
    s.from('briefings').select('id,title,body,version,event_id').order('created_at',{ascending:false}),
    s.from('personal_instructions').select('id,title,body,version,event_id').eq('user_id',userId).order('created_at',{ascending:false}),
    s.from('task_assignments').select('id,status,tasks(id,title,description,event_id,workplace_id)').eq('user_id',userId).order('created_at'),
   ])
   if(cancelled)return
   const briefingItems:OfflineBriefing[]=[
    ...(briefings||[]).map(row=>({...row,kind:'general' as const})),
    ...(personal||[]).map(row=>({...row,kind:'personal' as const})),
   ]
   const taskItems:OfflineTask[]=(assignments||[]).flatMap(row=>row.tasks?[{id:row.id,title:row.tasks.title,description:row.tasks.description,status:row.status,event_id:row.tasks.event_id,workplace_id:row.tasks.workplace_id}]:[])
   await Promise.all([saveOfflineBriefings(userId,briefingItems),saveOfflineTasks(userId,taskItems)])
  })().catch(()=>{})
  return()=>{cancelled=true}
 },[userId])
 return null
}
