'use client'

import {useEffect} from 'react'
import {createClient} from '@/lib/supabase/crew-client'
import {boundedQueries} from '@/lib/administration/bounded-queries'
import {loadOfflineDocuments,replaceOfflineDocuments,saveOfflineBriefings,saveOfflineBrowseData,saveOfflineEmergency,saveOfflineOperationalData,saveOfflineTasks,saveOfflineKnowledge,saveOfflineGuestlistAndSales,type OfflineBriefing,type OfflineChecklist,type OfflineDocument,type OfflineEmergencyInfo,type OfflineEvent,type OfflineGuestlistEntry,type OfflineIncident,type OfflineInventoryIssue,type OfflineInventoryItem,type OfflineKnowledgeArticle,type OfflineSaleItem,type OfflineShift,type OfflineTask,type OfflineWorkplace} from '@/lib/crew-offline-snapshot'

export function GlobalOfflineContentSync({userId}:{userId:string}){
 useEffect(()=>{
  const s=createClient()
  let cancelled=false
  let syncing=false
  // IndexedDB offline snapshots are shared between tabs in one browser
  // profile. Share ONLY per-user timing metadata (never private snapshot
  // content) so 4 tabs of one account do not repeat 16 RLS reads each.
  const syncKey='upt-offline:last-success:'+userId
  const attemptKey='upt-offline:last-attempt:'+userId
  const reconnectKey='upt-offline:last-reconnect:'+userId
  const leaseKey='upt-offline:active-sync:'+userId
  const readTimestamp=(key:string)=>{
   for(const kind of ['localStorage','sessionStorage'] as const){
    try{
     const value=Number(window[kind].getItem(key))
     if(Number.isFinite(value)&&value>0&&value<=Date.now())return value
    }catch{/* private/blocked storage: use the other store or in-memory fallback */}
   }
   return 0
  }
  const writeTimestamp=(key:string,value:number)=>{
   try{window.localStorage.setItem(key,String(value));return}catch{/* shared storage unavailable */}
   try{window.sessionStorage.setItem(key,String(value))}catch{/* in-memory fallback */}
  }
  const readLastSuccess=()=>readTimestamp(syncKey)
  const readLastAttempt=()=>readTimestamp(attemptKey)
  let lastSyncedAt=readLastSuccess()
  let lastAttemptAt=readLastAttempt()
  let activeLease:string|null=null
  const acquireLease=()=>{
   try{
    const raw=window.localStorage.getItem(leaseKey)
    const expires=Number(raw?.split(':')[0])
    if(Number.isFinite(expires)&&expires>Date.now())return false
    const value=String(Date.now()+3*60_000)+':'+crypto.randomUUID()
    window.localStorage.setItem(leaseKey,value)
    if(window.localStorage.getItem(leaseKey)!==value)return false
    activeLease=value
   }catch{
    // Never block offline support on storage permission; each tab still
    // uses its own in-memory sync guard and one-minute attempt backoff.
   }
   return true
  }
  const releaseLease=()=>{
   if(!activeLease)return
   try{
    if(window.localStorage.getItem(leaseKey)===activeLease)
     window.localStorage.removeItem(leaseKey)
   }catch{/* storage unavailable */}
   activeLease=null
  }
  // Stable per-user jitter prevents 30 phones opening/updating the app at an
  // event from running sixteen Supabase reads in the same second.
  const staggerMs=[...userId].reduce((hash,char)=>((hash*31+char.charCodeAt(0))>>>0),0)%48_000
  const syncOfflineContent=async({force=false}:{force?:boolean}={})=>{
   if(cancelled||syncing||!navigator.onLine||document.visibilityState!=='visible')return
   const now=Date.now()
   // Re-read shared timestamps on every attempt: another tab may have
   // completed a snapshot since this component was mounted.
   lastSyncedAt=Math.max(lastSyncedAt,readLastSuccess())
   lastAttemptAt=Math.max(lastAttemptAt,readLastAttempt())
   // Normal background work uses a shared one-minute failure backoff.
   // An actual reconnect still forces refresh once per browser profile;
   // multiple same-user tabs cannot each force sixteen reads on that event.
   if(!force&&(now-lastSyncedAt<15*60_000||now-lastAttemptAt<60_000))return
   if(force&&now-readTimestamp(reconnectKey)<60_000)return
   if(!acquireLease())return
   syncing=true
   lastAttemptAt=now
   writeTimestamp(attemptKey,lastAttemptAt)
   if(force)writeTimestamp(reconnectKey,now)
   try{
   // A stalled Supabase/PostgREST gateway must not leave all sixteen
   // background snapshot reads in flight for minutes. Preserve the existing
   // IndexedDB snapshot and backoff on failure; healthy requests are unchanged.
   const snapshotSignal=AbortSignal.timeout(12_000)
   const snapshotResults=await boundedQueries([
    s.from('briefings').select('id,title,body,version,event_id').order('created_at',{ascending:false}).abortSignal(snapshotSignal),
    s.from('personal_instructions').select('id,title,body,version,event_id').eq('user_id',userId).order('created_at',{ascending:false}).abortSignal(snapshotSignal),
    s.from('task_assignments').select('id,status,tasks(id,title,description,event_id,workplace_id)').eq('user_id',userId).order('created_at').abortSignal(snapshotSignal),
    s.from('event_emergency_information').select('event_id,emergency_number,first_aid_contact,security_contact,assembly_point,procedure,updated_at,events(name,address)').order('updated_at',{ascending:false}).abortSignal(snapshotSignal),
    s.from('event_documents').select('id,event_id,kind,title,description,file_name,mime_type,storage_path,updated_at,events(name)').eq('offline_critical',true).eq('is_active',true).order('updated_at',{ascending:false}).abortSignal(snapshotSignal),
    s.from('event_members').select('event_id,events(id,name,address,start_at,end_at,status)').eq('user_id',userId).abortSignal(snapshotSignal),
    s.from('workplaces').select('id,event_id,name,description').eq('is_active',true).order('sort_order').abortSignal(snapshotSignal),
    s.from('shifts').select('id,event_id,workplace_id,role_name,scheduled_start,scheduled_end,status,response_status').eq('user_id',userId).order('scheduled_start').abortSignal(snapshotSignal),
    s.from('incidents').select('id,event_id,workplace_id,message,status,created_at,acknowledged_at,resolved_at,escalated_at').order('created_at',{ascending:false}).limit(100).abortSignal(snapshotSignal),
    s.from('operational_checklists').select('id,event_id,workplace_id,kind,title,description,status,completed_at').order('created_at',{ascending:false}).abortSignal(snapshotSignal),
    s.from('checklist_items').select('id,checklist_id,label,required,requires_photo,completed_at').order('sort_order').abortSignal(snapshotSignal),
    s.from('inventory_items').select('id,event_id,workplace_id,name,category,available_quantity,issued_quantity,damaged_quantity,missing_quantity').eq('is_active',true).order('name').abortSignal(snapshotSignal),
    s.from('inventory_issues').select('id,item_id,user_id,outstanding_quantity,issued_at').gt('outstanding_quantity',0).order('issued_at',{ascending:false}).abortSignal(snapshotSignal),
    s.from('knowledge_articles').select('id,event_id,workplace_id,category,title,body,updated_at').eq('offline_critical',true).eq('is_published',true).order('updated_at',{ascending:false}).abortSignal(snapshotSignal),
    s.from('event_guestlist_entries').select('id,event_id,name,entry_type,spots_total,spots_checked_in,notes').eq('is_active',true).order('name').abortSignal(snapshotSignal),
    s.from('inventory_items').select('id,event_id,workplace_id,name,sale_category,sale_price_cents,available_quantity').eq('is_active',true).eq('sale_enabled',true).gt('available_quantity',0).order('name').abortSignal(snapshotSignal),
   ],2)
   // An intermittent network/RLS error must NEVER overwrite working offline
   // data with an empty snapshot. Retry at the next safe sync opportunity.
   if(cancelled||document.visibilityState!=='visible'||
      snapshotResults.some(result=>Boolean(result.error)))return
   const [{data:briefings},{data:personal},{data:assignments},{data:emergency},{data:documents},{data:eventMemberships},{data:workplaces},{data:shifts},{data:incidents},{data:checklists},{data:checklistItems},{data:inventoryItems},{data:inventoryIssues},{data:knowledge},{data:guestlistRows},{data:saleRows}]=snapshotResults
   const briefingItems:OfflineBriefing[]=[
    ...(briefings||[]).map(row=>({...row,kind:'general' as const})),
    ...(personal||[]).map(row=>({...row,kind:'personal' as const})),
   ]
   const taskItems:OfflineTask[]=(assignments||[]).flatMap(row=>row.tasks?.event_id?[{id:row.id,title:row.tasks.title,description:row.tasks.description,status:row.status,event_id:row.tasks.event_id,workplace_id:row.tasks.workplace_id}]:[])
   const emergencyItems:OfflineEmergencyInfo[]=(emergency||[]).map(row=>({event_id:row.event_id,event_name:row.events?.name||'Evenement',event_address:row.events?.address||'',emergency_number:row.emergency_number,first_aid_contact:row.first_aid_contact,security_contact:row.security_contact,assembly_point:row.assembly_point,procedure:row.procedure,updated_at:row.updated_at}))
   const eventItems:OfflineEvent[]=(eventMemberships||[]).flatMap(row=>row.events?[{id:row.events.id,name:row.events.name,address:row.events.address,start_at:row.events.start_at,end_at:row.events.end_at,status:row.events.status}]:[])
   const eventIds=new Set(eventItems.map(item=>item.id))
   const workplaceItems:OfflineWorkplace[]=(workplaces||[]).filter(row=>eventIds.has(row.event_id)).map(row=>({id:row.id,event_id:row.event_id,name:row.name,description:row.description}))
   const shiftItems:OfflineShift[]=(shifts||[]).map(row=>({id:row.id,event_id:row.event_id,workplace_id:row.workplace_id,role_name:row.role_name,scheduled_start:row.scheduled_start,scheduled_end:row.scheduled_end,status:row.status,response_status:row.response_status}))
   const incidentItems:OfflineIncident[]=(incidents||[]).filter(row=>Boolean(row.event_id)&&eventIds.has(row.event_id!)).map(row=>({id:row.id,event_id:row.event_id!,workplace_id:row.workplace_id,message:row.message,status:row.status,created_at:row.created_at,acknowledged_at:row.acknowledged_at,resolved_at:row.resolved_at,escalated_at:row.escalated_at}))
   const visibleChecklists=(checklists||[]).filter(row=>eventIds.has(row.event_id))
   const checklistIds=new Set(visibleChecklists.map(row=>row.id))
   const checklistItemRows=(checklistItems||[]).filter(row=>checklistIds.has(row.checklist_id))
   const checklistModels:OfflineChecklist[]=visibleChecklists.map(row=>({id:row.id,event_id:row.event_id,workplace_id:row.workplace_id,kind:row.kind,title:row.title,description:row.description,status:row.status,completed_at:row.completed_at,items:checklistItemRows.filter(item=>item.checklist_id===row.id).map(item=>({id:item.id,label:item.label,required:item.required,requires_photo:item.requires_photo,completed_at:item.completed_at}))}))
   const inventoryModels:OfflineInventoryItem[]=(inventoryItems||[]).filter(row=>eventIds.has(row.event_id)).map(row=>({id:row.id,event_id:row.event_id,workplace_id:row.workplace_id,name:row.name,category:row.category,available_quantity:row.available_quantity,issued_quantity:row.issued_quantity,damaged_quantity:row.damaged_quantity,missing_quantity:row.missing_quantity}))
   const inventoryIds=new Set(inventoryModels.map(row=>row.id))
   const issueModels:OfflineInventoryIssue[]=(inventoryIssues||[]).filter(row=>inventoryIds.has(row.item_id)).map(row=>({id:row.id,item_id:row.item_id,user_id:row.user_id,outstanding_quantity:row.outstanding_quantity,issued_at:row.issued_at}))
   const knowledgeModels:OfflineKnowledgeArticle[]=(knowledge||[]).filter(row=>row.event_id===null||eventIds.has(row.event_id)).map(row=>({id:row.id,event_id:row.event_id,workplace_id:row.workplace_id,category:row.category,title:row.title,body:row.body,updated_at:row.updated_at}))
   const guestlistModels:OfflineGuestlistEntry[]=(guestlistRows||[]).filter(row=>eventIds.has(row.event_id)).map(row=>({id:row.id,event_id:row.event_id,name:row.name,entry_type:row.entry_type,spots_total:row.spots_total,spots_checked_in:row.spots_checked_in,notes:row.notes}))
   const saleModels:OfflineSaleItem[]=(saleRows||[]).filter(row=>eventIds.has(row.event_id)).map(row=>({id:row.id,event_id:row.event_id,workplace_id:row.workplace_id,name:row.name,sale_category:row.sale_category,sale_price_cents:row.sale_price_cents,available_quantity:row.available_quantity}))
   const existingDocuments=await loadOfflineDocuments(userId)
   const existingById=new Map(existingDocuments.map(document=>[document.id,document]))
   const offlineDocuments:OfflineDocument[]=[]
   for(const row of documents||[]){
    const previous=existingById.get(row.id)
    let blob=previous?.updated_at===row.updated_at&&previous.storage_path===row.storage_path?previous.blob:null
    if(!blob){
     const {data:file,error:fileError}=await s.storage.from('work-media').download(row.storage_path)
     if(fileError||!file)continue
     blob=file
    }
    offlineDocuments.push({key:userId+':'+row.id,userId,id:row.id,event_id:row.event_id,event_name:row.events?.name||'Evenement',kind:row.kind,title:row.title,description:row.description,file_name:row.file_name,mime_type:row.mime_type,storage_path:row.storage_path,updated_at:row.updated_at,blob})
   }
   await Promise.all([saveOfflineBriefings(userId,briefingItems),saveOfflineTasks(userId,taskItems),saveOfflineEmergency(userId,emergencyItems),saveOfflineBrowseData(userId,eventItems,workplaceItems,shiftItems),saveOfflineOperationalData(userId,incidentItems,checklistModels,inventoryModels,issueModels),saveOfflineKnowledge(userId,knowledgeModels),saveOfflineGuestlistAndSales(userId,guestlistModels,saleModels),replaceOfflineDocuments(userId,offlineDocuments)])
   lastSyncedAt=Date.now()
   writeTimestamp(syncKey,lastSyncedAt)
   }finally{
    releaseLease()
    syncing=false
   }
  }
  let reconnectTimer:number|undefined
  const onOnline=()=>{
   if(reconnectTimer!==undefined)window.clearTimeout(reconnectTimer)
   // A reconnect must refresh offline data, but not stampede a recovering
   // Supabase database with every device at exactly the same instant.
   reconnectTimer=window.setTimeout(()=>{
    reconnectTimer=undefined
    void syncOfflineContent({force:true}).catch(()=>{})
   },500+staggerMs)
  }
  const onVisible=()=>{if(document.visibilityState==='visible')void syncOfflineContent().catch(()=>{})}
  window.addEventListener('online',onOnline)
  document.addEventListener('visibilitychange',onVisible)
  // Existing online pages remain immediately usable. Stagger only the
  // noncritical offline copy, preserving the original 3-outgoing-request cap.
  const initialSync=window.setTimeout(()=>{
   if(document.visibilityState==='visible')void syncOfflineContent().catch(()=>{})
  },10_000+staggerMs)
  const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void syncOfflineContent().catch(()=>{})},15*60*1000)
  return()=>{
   cancelled=true
   window.clearTimeout(initialSync)
   if(reconnectTimer!==undefined)window.clearTimeout(reconnectTimer)
   window.removeEventListener('online',onOnline)
   document.removeEventListener('visibilitychange',onVisible)
   window.clearInterval(timer)
  }
 },[userId])
 return null
}
