'use client'

import {useEffect} from 'react'
import {createClient} from '@/lib/supabase/crew-client'
import {loadOfflineDocuments,replaceOfflineDocuments,saveOfflineBriefings,saveOfflineBrowseData,saveOfflineEmergency,saveOfflineOperationalData,saveOfflineTasks,type OfflineBriefing,type OfflineChecklist,type OfflineDocument,type OfflineEmergencyInfo,type OfflineEvent,type OfflineIncident,type OfflineInventoryIssue,type OfflineInventoryItem,type OfflineShift,type OfflineTask,type OfflineWorkplace} from '@/lib/crew-offline-snapshot'

export function GlobalOfflineContentSync({userId}:{userId:string}){
 useEffect(()=>{
  if(!navigator.onLine)return
  const s=createClient()
  let cancelled=false
  void (async()=>{
   const [{data:briefings},{data:personal},{data:assignments},{data:emergency},{data:documents},{data:eventMemberships},{data:workplaces},{data:shifts},{data:incidents},{data:checklists},{data:checklistItems},{data:inventoryItems},{data:inventoryIssues}]=await Promise.all([
    s.from('briefings').select('id,title,body,version,event_id').order('created_at',{ascending:false}),
    s.from('personal_instructions').select('id,title,body,version,event_id').eq('user_id',userId).order('created_at',{ascending:false}),
    s.from('task_assignments').select('id,status,tasks(id,title,description,event_id,workplace_id)').eq('user_id',userId).order('created_at'),
    s.from('event_emergency_information').select('event_id,emergency_number,first_aid_contact,security_contact,assembly_point,procedure,updated_at,events(name,address)').order('updated_at',{ascending:false}),
    s.from('event_documents').select('id,event_id,kind,title,description,file_name,mime_type,storage_path,updated_at,events(name)').eq('offline_critical',true).eq('is_active',true).order('updated_at',{ascending:false}),
    s.from('event_members').select('event_id,events(id,name,address,start_at,end_at,status)').eq('user_id',userId),
    s.from('workplaces').select('id,event_id,name,description').eq('is_active',true).order('sort_order'),
    s.from('shifts').select('id,event_id,workplace_id,role_name,scheduled_start,scheduled_end,status,response_status').eq('user_id',userId).order('scheduled_start'),
    s.from('incidents').select('id,event_id,workplace_id,message,status,created_at,acknowledged_at,resolved_at,escalated_at').order('created_at',{ascending:false}).limit(100),
    s.from('operational_checklists').select('id,event_id,workplace_id,kind,title,description,status,completed_at').order('created_at',{ascending:false}),
    s.from('checklist_items').select('id,checklist_id,label,required,requires_photo,completed_at').order('sort_order'),
    s.from('inventory_items').select('id,event_id,workplace_id,name,category,available_quantity,issued_quantity,damaged_quantity,missing_quantity').eq('is_active',true).order('name'),
    s.from('inventory_issues').select('id,item_id,user_id,outstanding_quantity,issued_at').gt('outstanding_quantity',0).order('issued_at',{ascending:false}),
   ])
   if(cancelled)return
   const briefingItems:OfflineBriefing[]=[
    ...(briefings||[]).map(row=>({...row,kind:'general' as const})),
    ...(personal||[]).map(row=>({...row,kind:'personal' as const})),
   ]
   const taskItems:OfflineTask[]=(assignments||[]).flatMap(row=>row.tasks?[{id:row.id,title:row.tasks.title,description:row.tasks.description,status:row.status,event_id:row.tasks.event_id,workplace_id:row.tasks.workplace_id}]:[])
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
   await Promise.all([saveOfflineBriefings(userId,briefingItems),saveOfflineTasks(userId,taskItems),saveOfflineEmergency(userId,emergencyItems),saveOfflineBrowseData(userId,eventItems,workplaceItems,shiftItems),saveOfflineOperationalData(userId,incidentItems,checklistModels,inventoryModels,issueModels),replaceOfflineDocuments(userId,offlineDocuments)])
  })().catch(()=>{})
  return()=>{cancelled=true}
 },[userId])
 return null
}
