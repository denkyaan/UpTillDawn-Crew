import {withReadBudget} from "../lib/request-budget"
import {useEffect,useRef,useState,type FormEvent} from "react"
import {useSession} from "../lib/session"
import {loadChatList,type ChatRow} from "../lib/queries"
import {useRead} from "../lib/use-read"
import {useLocale} from "../lib/use-locale"
import {loadChannelMessages,type ChatMessage} from "../lib/chat-messages"
import {MIGRATION_WRITES_ENABLED,markOwnChatRead} from "../lib/operational-writes"
import {enqueueText,flushOwnText,pendingText,discardPendingText,type PendingText} from "../lib/chat-outbox"
import {supabase} from "../lib/supabase"

function MessageHistory({channelId,uid,revision}:{channelId:string;uid:string;revision:number}){
 const [messages,setMessages]=useState<ChatMessage[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState(false)
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null)
 useEffect(()=>{
  let active=true
  const db=supabase()
  let controller:AbortController|null=null
  setMessages([]);setError(false);setLoading(true)
  const load=async()=>{
   controller?.abort()
   const next=new AbortController()
   controller=next
   const deadline=setTimeout(()=>next.abort(),12000)
   try{
    const rows=await withReadBudget(next.signal,()=>loadChannelMessages(channelId,next.signal))
    if(!active)return
    setMessages(rows);setError(false);setLoading(false)
    if(MIGRATION_WRITES_ENABLED)
     void markOwnChatRead(channelId).catch(()=>{})
   }catch{if(active&&controller===next){setError(true);setLoading(false)}}
   finally{clearTimeout(deadline)}
  }
  void load()
  const channel=db.channel("modern-read-chat:"+channelId)
   .on("postgres_changes",{
     event:"*",schema:"public",table:"messages",filter:"channel_id=eq."+channelId
   },()=>{
    if(timer.current)clearTimeout(timer.current)
    timer.current=setTimeout(()=>{timer.current=null;if(active)void load()},850)
   }).subscribe()
  return()=>{
   active=false;controller?.abort()
   if(timer.current)clearTimeout(timer.current)
   void db.removeChannel(channel)
  }
 },[channelId,revision])
 return <section className="card" aria-live="polite" aria-busy={loading}>
  {loading&&<p role="status">Loading messages…</p>}
  {error&&<p role="alert" className="error">Message history is unavailable. Existing messages were not deleted.</p>}
  {!loading&&!error&&messages.length===0&&<p className="muted">No messages in this channel.</p>}
  <ul className="list">{messages.map(message=><li key={message.id}>
   <div className="row"><small className="muted">{message.sender_id===uid?"You":(message.sender_id?.slice(0,8)||"System")}</small>
    <time className="muted" dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time></div>
   {message.moderated_at?<p className="muted">Message moderated</p>:<p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{message.body||""}</p>}
  </li>)}</ul>
 </section>
}
function Composer({channelId,uid,onUpdated}:{channelId:string;uid:string;onUpdated:()=>void}){
 const [body,setBody]=useState("")
 const [busy,setBusy]=useState(false)
 const [status,setStatus]=useState("")
 const [pending,setPending]=useState<PendingText[]>([])
 const refresh=async()=>setPending(await pendingText(uid).catch(()=>[]))
 useEffect(()=>{
  void refresh()
  const online=()=>void flushOwnText(uid).then(()=>refresh()).catch(()=>{})
  addEventListener("online",online)
  return()=>removeEventListener("online",online)
 },[uid])
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(busy||!body.trim()||!MIGRATION_WRITES_ENABLED)return
  setBusy(true);setStatus("")
  try{
   // Queueing != sending. Retain the message if network/DB fails.
   const queuedItem=await enqueueText(uid,channelId,body)
   setBody("")
   const delivered=await flushOwnText(uid)
   const remaining=await pendingText(uid)
   setPending(remaining)
   if(delivered>0)onUpdated()
   // Other queued messages may succeed while THIS message still fails.
   const thisSent=!remaining.some(item=>item.id===queuedItem.id)
   setStatus(thisSent?"Sent":"Saved on this device. Retry when connected.")
  }catch{setStatus("Could not queue this message. No delivery was claimed.")}
  finally{setBusy(false)}
 }
 async function retry(){
  setBusy(true)
  try{
   const delivered=await flushOwnText(uid)
   const remaining=await pendingText(uid)
   setPending(remaining)
   if(delivered>0)onUpdated()
   setStatus(remaining.length===0?"All queued messages sent":delivered>0?"Some messages still queued locally":"Messages still queued locally.")
  }catch{setStatus("Offline account check failed. Nothing sent.")}
  finally{setBusy(false)}
 }
 if(!MIGRATION_WRITES_ENABLED)return <p className="muted">Message sending and read receipts are disabled until migration parity tests pass.</p>
 return <div className="card">
  <form onSubmit={e=>void submit(e)}>
   <label>New message
    <textarea style={{width:"100%",minHeight:"85px"}} maxLength={4000} required
     value={body} onChange={e=>setBody(e.target.value)} placeholder="Write a message…"/>
   </label>
   <button className="primary" disabled={busy||!body.trim()}>Send</button>
  </form>
  {status&&<p role="status">{status}</p>}
  {pending.length>0&&<section aria-label="Offline queued messages"><div className="row"><strong>{pending.length} queued locally</strong>
   <button disabled={busy} onClick={()=>void retry()}>Retry delivery</button></div>
   <ul className="list">{pending.map(item=><li key={item.id} className="row"><span>{item.channelId===channelId?"This channel":"Another channel"} · {new Date(item.createdAt).toLocaleString()}</span>
    <button disabled={busy} onClick={()=>void discardPendingText(uid,item.id).then(()=>refresh())}>Discard</button>
   </li>)}</ul></section>}
 </div>
}
export default function Chats(){
 const {identity}=useSession(),{t}=useLocale()
 const uid=identity!.id
 const list=useRead(uid,"chat-list",loadChatList)
 const [selected,setSelected]=useState<string>("")
 const [revision,setRevision]=useState(0)
 const channels=list.data||[]
 const active=channels.find(ch=>ch.id===selected)||channels[0]
 const selectedId=active?.id||null
 return <><div className="row"><h1>{t.chat}</h1><button className="primary" onClick={list.refresh}>{t.refresh}</button></div>
 {list.stale&&<p className="notice" role="status">{t.offline}</p>}
 {list.error&&<p className="error" role="alert">{t.unavailable}</p>}
 {list.loading&&<p role="status">{t.loading}</p>}
 {!list.loading&&channels.length===0&&<p>{t.noData}</p>}
 <div className="grid">
  <nav className="card" aria-label="Available chat channels">
   <h2>Channels</h2>
   <ul className="list">{channels.map(ch=><li key={ch.id}>
    <button className={ch.id===selectedId?"primary":""} aria-current={ch.id===selectedId?"page":undefined}
     onClick={()=>setSelected(ch.id)}>{ch.name||ch.kind} <small>({ch.kind})</small></button>
   </li>)}</ul>
  </nav>
  {selectedId&&<div>
   <h2>{active?.name||"Channel"}</h2>
   <MessageHistory key={selectedId} channelId={selectedId} uid={uid} revision={revision}/>
   <Composer key={uid+":"+selectedId} uid={uid} channelId={selectedId} onUpdated={()=>setRevision(v=>v+1)}/>
  </div>}
 </div>
 <p className="muted">The full chat translation, photo attachments, read receipt images and moderated admin tooling have not yet reached parity.</p>
 </>
}
