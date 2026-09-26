'use client'

export type OfflineOperationsSnapshot = {
  version: 1
  userId: string
  savedAt: number
  events: Array<{ id: string; name: string }>
  workplaces: Array<{ id: string; event_id: string; name: string }>
  shifts: Array<{id:string;event_id:string;workplace_id:string;role_name:string|null;scheduled_start:string;scheduled_end:string}>
  activeSession:{id:string;event_id:string;shift_id:string|null;started_at:string}|null
  activeBreak:{id:string;work_session_id:string;started_at:string}|null
  checkins:Array<{event_id:string;workplace_id:string;status:string}>
}

export type OfflineContentSnapshot={
  userId:string
  savedAt:number
  briefings:Array<{id:string;title:string;body:string;version:number;event_id:string;kind:'general'|'personal'}>
  tasks:Array<{id:string;title:string;description:string|null;status:string;event_id:string;workplace_id:string|null}>
}

function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('uptilldawn-offline-shell',2)
    request.onupgradeneeded=()=>{
      const db=request.result
      if(!db.objectStoreNames.contains('snapshots'))db.createObjectStore('snapshots',{keyPath:'userId'})
      if(!db.objectStoreNames.contains('content'))db.createObjectStore('content',{keyPath:'userId'})
      if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'})
    }
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>reject(request.error)
  })
}

export async function saveOperationsSnapshot(snapshot:OfflineOperationsSnapshot){
  const db=await openDb()
  try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['snapshots','meta'],'readwrite');tx.objectStore('snapshots').put(snapshot);tx.objectStore('meta').put({key:'activeUserId',value:snapshot.userId});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}
}

export async function saveOfflineContent(snapshot:OfflineContentSnapshot){
  const db=await openDb()
  try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['content','meta'],'readwrite');tx.objectStore('content').put(snapshot);tx.objectStore('meta').put({key:'activeUserId',value:snapshot.userId});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}
}

export async function clearOfflineIdentity(){
  const db=await openDb()
  try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('meta','readwrite');tx.objectStore('meta').delete('activeUserId');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}
}
