import {MIGRATION_WRITES_ENABLED,sendOwnChatMessage} from "./operational-writes"

// Local, per-user, durable outbox. Chat is sensitive: never put pending text in
// public service-worker caches, localStorage or background sync requests
// without a confirmed active JWT. Server RPC deduplicates by operation UUID.
export type PendingText={
 id:string;uid:string;channelId:string;body:string;createdAt:number;
 attempts:number;lastError:string|null
}
const NAME="uptilldawn-modern-chat-outbox-v1"
const MAX_PER_USER=50
const EXPIRES_MS=7*86400_000

function open():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(NAME,1)
  request.onupgradeneeded=()=>{
   if(!request.result.objectStoreNames.contains("messages"))
    request.result.createObjectStore("messages",{keyPath:"id"})
  }
  request.onsuccess=()=>resolve(request.result)
  request.onerror=()=>reject(request.error)
 })
}
async function store<T>(mode:IDBTransactionMode,fn:(s:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await open()
 try{return await new Promise<T>((resolve,reject)=>{
  const tx=db.transaction("messages",mode)
  const request=fn(tx.objectStore("messages"))
  let value:T
  request.onsuccess=()=>{value=request.result}
  request.onerror=()=>reject(request.error)
  tx.oncomplete=()=>resolve(value)
  tx.onerror=()=>reject(tx.error)
  tx.onabort=()=>reject(tx.error||new Error("outbox_aborted"))
 })}finally{db.close()}
}
export async function pendingText(uid:string):Promise<PendingText[]>{
 const all=await store<PendingText[]>("readonly",s=>s.getAll())
 return all.filter(x=>x.uid===uid&&x.createdAt>Date.now()-EXPIRES_MS)
  .sort((a,b)=>a.createdAt-b.createdAt)
}
export async function enqueueText(uid:string,channelId:string,body:string):Promise<PendingText>{
 if(!MIGRATION_WRITES_ENABLED)throw new Error("migration_writes_not_enabled")
 const trimmed=body.trim()
 if(!trimmed||trimmed.length>4000)throw new Error("invalid_message")
 const all=await store<PendingText[]>("readonly",s=>s.getAll())
 // Delete stale outbox records on-device; never replay a week-old message.
 for(const stale of all.filter(x=>x.uid===uid&&x.createdAt<=Date.now()-EXPIRES_MS))
  await store("readwrite",s=>s.delete(stale.id))
 if((await pendingText(uid)).length>=MAX_PER_USER)throw new Error("outbox_full")
 const item:PendingText={id:crypto.randomUUID(),uid,channelId,body:trimmed,createdAt:Date.now(),attempts:0,lastError:null}
 await store("readwrite",s=>s.put(item))
 return item
}
let current:{uid:string;promise:Promise<number>}|null=null
export async function flushOwnText(uid:string):Promise<number>{
 if(!MIGRATION_WRITES_ENABLED||!navigator.onLine)return 0
 if(current){
  if(current.uid!==uid)throw new Error("offline_user_mismatch")
  return current.promise
 }
 const promise=(async()=>{
  let delivered=0
  for(const item of await pendingText(uid)){
   if(!navigator.onLine)break
   try{
    // verifyOwnSession in sendOwnChatMessage checks the currently logged-in
    // actor; server idempotency prevents duplicates on ambiguous timeouts.
    const {supabase}=await import("./supabase")
    const {data:{user}}=await supabase().auth.getUser()
    if(user?.id!==uid)throw new Error("offline_user_mismatch")
    await sendOwnChatMessage({operationId:item.id,channelId:item.channelId,body:item.body})
    await store("readwrite",s=>s.delete(item.id))
    delivered++
   }catch(error){
    if(error instanceof Error&&error.message==="offline_user_mismatch")throw error
    await store("readwrite",s=>s.put({...item,attempts:item.attempts+1,lastError:"retry_needed"}))
    break // bound backend load and preserve FIFO
   }
  }
  return delivered
 })()
 current={uid,promise}
 try{return await promise}finally{current=null}
}
export async function discardPendingText(uid:string,operationId:string){
 const match=(await pendingText(uid)).find(x=>x.id===operationId)
 if(!match)return false
 await store("readwrite",s=>s.delete(match.id))
 return true
}
export async function purgeOutboxUser(uid:string):Promise<void>{
 const items=await store<PendingText[]>("readonly",s=>s.getAll())
 for(const item of items.filter(x=>x.uid===uid))
  await store("readwrite",s=>s.delete(item.id))
}
