// Only short-lived, user-scoped operational READ snapshots are cached.
// Finance, sessions, auth tokens, bank data and other sensitive material are
// deliberately NEVER included in this local cache.
type CacheKey="events"|"tasks"|"chat-list"
const DB_NAME="uptilldawn-modern-readonly-v1"
const MAX_AGE_MS=12*60*60*1000
type Stored<T>={key:string;savedAt:number;value:T}
const keyOf=(uid:string,kind:CacheKey)=>uid+":"+kind
function open():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,1)
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("snapshots"))req.result.createObjectStore("snapshots",{keyPath:"key"})}
  req.onsuccess=()=>resolve(req.result)
  req.onerror=()=>reject(req.error)
 })
}
export async function readSnapshot<T>(uid:string,kind:CacheKey):Promise<T|null>{
 if(!globalThis.indexedDB)return null
 const db=await open()
 try{return await new Promise<T|null>((resolve,reject)=>{
  const tx=db.transaction("snapshots","readonly")
  const request=tx.objectStore("snapshots").get(keyOf(uid,kind))
  request.onsuccess=()=>{const row=request.result as Stored<T>|undefined;resolve(row&&Date.now()-row.savedAt<MAX_AGE_MS?row.value:null)}
  request.onerror=()=>reject(request.error)
 })}finally{db.close()}
}
export async function writeSnapshot<T>(uid:string,kind:CacheKey,value:T):Promise<void>{
 if(!globalThis.indexedDB)return
 const db=await open()
 try{await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction("snapshots","readwrite")
  tx.objectStore("snapshots").put({key:keyOf(uid,kind),savedAt:Date.now(),value})
  tx.oncomplete=()=>resolve()
  tx.onerror=()=>reject(tx.error)
 })}finally{db.close()}
}
export async function purgeSnapshotUser(uid:string):Promise<void>{
 if(!globalThis.indexedDB)return
 const db=await open()
 try{await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction("snapshots","readwrite")
  for(const kind of ["events","tasks","chat-list"] as const)tx.objectStore("snapshots").delete(keyOf(uid,kind))
  tx.oncomplete=()=>resolve()
  tx.onerror=()=>reject(tx.error)
 })}finally{db.close()}
}
