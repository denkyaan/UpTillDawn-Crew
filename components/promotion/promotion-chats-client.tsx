/* eslint-disable @next/next/no-img-element */
"use client"

import {useCallback,useEffect,useRef,useState} from "react"
import {createClient} from "@/lib/supabase/crew-client"
import {Send,MessagesSquare,Megaphone,CornerUpLeft,CheckCheck,X} from "lucide-react"
import {LANGUAGE_APPLIED_EVENT,activeUiLocale,type SupportedUiLocale} from "@/lib/locale-preferences"

type Room="general"|"announcements"
type Message={id:string;room:Room;sender_id:string;body:string;created_at:string;reply_to_message_id:string|null}
type Reader={user_id:string;full_name:string;read_at:string}
type Locale=SupportedUiLocale
const copy={
 nl:{general:"Algemeen",announcements:"Aankondigingen",send:"Versturen",placeholder:"Schrijf een bericht…",readonly:"Alleen admins kunnen aankondigingen plaatsen.",error:"Bericht kon niet worden verzonden.",load:"Berichten konden niet worden geladen.",empty:"Nog geen berichten.",loading:"Berichten laden…",yours:"Jij",inputHint:"Enter = nieuwe regel · verstuur met de knop.",reply:"Antwoorden",replyTo:"Antwoord op",cancel:"Antwoord annuleren",readers:"Gelezen door",noneRead:"Nog geen leesbevestigingen.",readerError:"Leesbevestigingen konden niet worden geladen.",close:"Sluiten",unread:"ongelezen",replyMissing:"Ouder bericht"},
 fr:{general:"Général",announcements:"Annonces",send:"Envoyer",placeholder:"Écrire un message…",readonly:"Seuls les admins peuvent publier des annonces.",error:"Envoi impossible.",load:"Impossible de charger les messages.",empty:"Aucun message.",loading:"Chargement des messages…",yours:"Vous",inputHint:"Entrée = nouvelle ligne · envoyez avec le bouton.",reply:"Répondre",replyTo:"Réponse à",cancel:"Annuler la réponse",readers:"Lu par",noneRead:"Aucune confirmation de lecture.",readerError:"Impossible de charger les accusés de lecture.",close:"Fermer",unread:"non lus",replyMissing:"Ancien message"},
 en:{general:"General",announcements:"Announcements",send:"Send",placeholder:"Write a message…",readonly:"Only admins can post announcements.",error:"Message could not be sent.",load:"Messages could not be loaded.",empty:"No messages yet.",loading:"Loading messages…",yours:"You",inputHint:"Enter = new line · use the send button.",reply:"Reply",replyTo:"Reply to",cancel:"Cancel reply",readers:"Read by",noneRead:"No read receipts yet.",readerError:"Unable to load read receipts.",close:"Close",unread:"unread",replyMissing:"Earlier message"},
 de:{general:"Allgemein",announcements:"Ankündigungen",send:"Senden",placeholder:"Nachricht schreiben…",readonly:"Nur Admins können Ankündigungen veröffentlichen.",error:"Nachricht konnte nicht gesendet werden.",load:"Nachrichten konnten nicht geladen werden.",empty:"Noch keine Nachrichten.",loading:"Nachrichten werden geladen…",yours:"Du",inputHint:"Enter = neue Zeile · mit der Schaltfläche senden.",reply:"Antworten",replyTo:"Antwort auf",cancel:"Antwort abbrechen",readers:"Gelesen von",noneRead:"Noch keine Lesebestätigungen.",readerError:"Lesebestätigungen konnten nicht geladen werden.",close:"Schließen",unread:"ungelesen",replyMissing:"Ältere Nachricht"}
} as const

export function PromotionChatsClient({locale,userId,isAdmin,names,photos={}}:{locale:Locale;userId:string;isAdmin:boolean;names:Record<string,string>;photos?:Record<string,string>}){
 const [uiLocale,setUiLocale]=useState(locale)
 const [room,setRoom]=useState<Room>("general")
 const [messages,setMessages]=useState<Message[]>([])
 const [body,setBody]=useState("")
 const [error,setError]=useState("")
 const [busy,setBusy]=useState(false)
 const [loaded,setLoaded]=useState(false)
 const [loadFailed,setLoadFailed]=useState(false)
 const [replyTo,setReplyTo]=useState<Message|null>(null)
 const [readersMessage,setReadersMessage]=useState<string|null>(null)
 const [readers,setReaders]=useState<Reader[]>([])
 const [readersBusy,setReadersBusy]=useState(false)
 const [readersError,setReadersError]=useState(false)
 const [unread,setUnread]=useState<Record<Room,number>>({general:0,announcements:0})
 const sequence=useRef(0)
 const viewportRef=useRef<HTMLDivElement>(null)
 const followLatest=useRef(true)
 const sending=useRef(false)
 const l=copy[uiLocale]
 const timeLocale=uiLocale==="nl"?"nl-BE":uiLocale==="fr"?"fr-BE":uiLocale==="en"?"en-GB":"de-DE"

 useEffect(()=>{
  const apply=()=>setUiLocale(activeUiLocale())
  apply()
  addEventListener(LANGUAGE_APPLIED_EVENT,apply)
  return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)
 },[])

 useEffect(()=>{
  const viewport=viewportRef.current
  if(viewport&&followLatest.current)viewport.scrollTop=viewport.scrollHeight
 },[messages,room])

 const refreshUnread=useCallback(async()=>{
  try{
   const {data,error:failure}=await createClient().rpc("upt_promotion_chat_unread_counts" as never)
   if(failure)return
   const next:{general:number;announcements:number}={general:0,announcements:0}
   for(const record of (data??[]) as {room:Room;unread_count:number}[]){
    if(record.room==="general"||record.room==="announcements")next[record.room]=Math.max(0,Number(record.unread_count)||0)
   }
   setUnread(next)
  }catch{}
 },[])

 const load=useCallback(async()=>{
  const current=++sequence.current
  try{
   const db=createClient()
   const {data,error:failure}=await db.from("promotion_chat_messages" as never).select("id,room,sender_id,body,created_at,reply_to_message_id").eq("room",room).order("created_at",{ascending:false}).limit(100)
   if(current!==sequence.current)return
   if(failure){setLoadFailed(true);setError(l.load);return}
   setLoadFailed(false);setLoaded(true);setError("")
   setMessages(((data||[]) as unknown as Message[]).reverse())
   if(document.visibilityState==="visible"){
    void db.rpc("upt_promotion_chat_mark_read" as never,{p_room:room} as never).then(()=>void refreshUnread())
   }
  }catch{
   if(current!==sequence.current)return
   setLoadFailed(true);setError(l.load)
  }
 },[room,l.load,refreshUnread])

 useEffect(()=>{
  const initial=window.setTimeout(()=>{void load();void refreshUnread()},0)
  const interval=window.setInterval(()=>{if(document.visibilityState==="visible"){void load();void refreshUnread()}},10000)
  const onVisible=()=>{if(document.visibilityState==="visible"){void load();void refreshUnread()}}
  document.addEventListener("visibilitychange",onVisible)
  const activeSequence=sequence
  return()=>{activeSequence.current++;clearTimeout(initial);clearInterval(interval);document.removeEventListener("visibilitychange",onVisible)}
 },[load,refreshUnread])

 async function showReaders(messageId:string){
  setReadersMessage(messageId);setReaders([]);setReadersBusy(true);setReadersError(false)
  try{
   const {data,error:failure}=await createClient().rpc("upt_promotion_chat_readers" as never,{p_message:messageId} as never)
   if(failure)throw failure
   setReaders((data??[]) as Reader[])
  }catch{setReadersError(true)}finally{setReadersBusy(false)}
 }

 async function send(){
  const message=body.trim()
  if(!message||sending.current||(room==="announcements"&&!isAdmin))return
  sending.current=true
  setBusy(true);setError("")
  const submittedRoom=room
  const replyId=replyTo?.room===submittedRoom?replyTo.id:null
  try{
   const db=createClient()
   const {error:failure}=await db.from("promotion_chat_messages" as never).insert({room:submittedRoom,sender_id:userId,body:message,reply_to_message_id:replyId} as never)
   if(failure){setError(l.error);return}
   setBody("")
   setReplyTo(null)
   followLatest.current=true
   await load()
  }catch{
   setError(l.error)
  }finally{
   sending.current=false
   setBusy(false)
  }
 }
 function chooseRoom(next:Room){
  if(sending.current)return
  sequence.current++;followLatest.current=true
  setRoom(next);setMessages([]);setLoaded(false);setLoadFailed(false);setError("")
  setReplyTo(null);setReadersMessage(null)
 }
 const messageById=new Map(messages.map(message=>[message.id,message]))
 return <section aria-label={l.general+" / "+l.announcements} className="flex h-[calc(100dvh-21rem-env(safe-area-inset-bottom))] min-h-[18rem] min-w-0 flex-col overflow-hidden rounded-2xl border bg-background shadow-sm sm:h-[min(70dvh,690px)]">
  <div className="shrink-0 border-b bg-card/70 p-2">
   <div className="grid grid-cols-2 gap-2">
    {(["general","announcements"] as Room[]).map(r=>{
     const Icon=r==="general"?MessagesSquare:Megaphone
     return <button key={r} data-promotion-room={r} type="button" disabled={busy} onClick={()=>{if(sending.current)return;chooseRoom(r)}} aria-pressed={room===r} className={`flex min-w-0 items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors disabled:opacity-50 sm:text-sm ${room===r?"border-violet-500 bg-violet-500/10 text-violet-400":"border-border text-muted-foreground"}`}>
      <Icon className="h-4 w-4 shrink-0"/><span className="min-w-0 break-words text-center">{l[r]}</span>{unread[r]>0&&<span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] text-white" aria-label={l.unread}>{unread[r]>99?"99+":unread[r]}</span>}
     </button>
    })}
   </div>
  </div>
  <div ref={viewportRef} onScroll={event=>{const el=event.currentTarget;followLatest.current=el.scrollHeight-el.scrollTop-el.clientHeight<96}} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite" aria-relevant="additions text">
   {!loaded&&!loadFailed&&<p role="status" className="py-8 text-center text-sm text-muted-foreground">{l.loading}</p>}
   {!messages.length&&loaded&&!loadFailed&&<p className="py-8 text-center text-sm text-muted-foreground">{l.empty}</p>}
   {messages.map(m=>{
    const mine=m.sender_id===userId
    const name=mine?l.yours:names[m.sender_id]||m.sender_id.slice(0,8)
    const initials=name.split(/\s+/).filter(Boolean).map(part=>part[0]).join("").slice(0,2).toUpperCase()
    const target=m.reply_to_message_id?messageById.get(m.reply_to_message_id):null
    return <article key={m.id} data-promotion-message={m.id} className={`flex items-end gap-2 ${mine?"justify-end":"justify-start"}`}>
     {!mine&&<span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-[10px] font-bold">{photos[m.sender_id]?<img src={photos[m.sender_id]} alt="" className="h-full w-full object-cover"/>:initials}</span>}
     <div className="flex max-w-[82%] min-w-0 flex-col gap-1">
      {!mine&&<p className="px-1 text-xs font-semibold text-muted-foreground">{name}</p>}
      <div className={`rounded-2xl px-3.5 py-2.5 shadow-sm ${mine?"rounded-br-md bg-violet-600 text-white":"rounded-bl-md border bg-card"}`}>
       {m.reply_to_message_id&&<button type="button" onClick={()=>document.getElementById("promotion-msg-"+m.reply_to_message_id)?.scrollIntoView({behavior:"smooth",block:"center"})} className={`mb-2 block w-full rounded-lg border-l-4 px-2 py-1.5 text-left text-xs ${mine?"border-white/70 bg-white/10":"border-violet-500 bg-muted/40"}`}><span className="font-bold">{l.replyTo} {target?names[target.sender_id]||l.yours:l.replyMissing}</span><span className="block max-w-full truncate opacity-80">{target?.body??l.replyMissing}</span></button>}
       <p id={"promotion-msg-"+m.id} data-no-translate className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p>
       <div className={`mt-1.5 flex flex-wrap items-center justify-end gap-2 text-[10px] ${mine?"text-white/75":"text-muted-foreground"}`}>
        <time dateTime={m.created_at}>{new Date(m.created_at).toLocaleTimeString(timeLocale,{hour:"2-digit",minute:"2-digit"})}</time>
        {(room==="general"||isAdmin)&&<button type="button" onClick={()=>{setReplyTo(m);}} className="inline-flex items-center gap-0.5 font-semibold underline"><CornerUpLeft className="h-3 w-3"/>{l.reply}</button>}
        {mine&&<button type="button" onClick={()=>void showReaders(m.id)} className="inline-flex items-center gap-0.5 font-semibold underline"><CheckCheck className="h-3 w-3"/>{l.readers}</button>}
       </div>
      </div>
     </div>
    </article>
   })}
  </div>
  <div className="shrink-0 border-t bg-background p-3">
   {readersMessage&&<div className="mb-2 rounded-xl border bg-card p-3 text-xs">
    <div className="flex items-center justify-between gap-2"><strong>{l.readers}</strong><button type="button" aria-label={l.close} onClick={()=>setReadersMessage(null)}><X className="h-4 w-4"/></button></div>
    {readersBusy?<p className="mt-2 text-muted-foreground">{l.loading}</p>:readersError?<p role="alert" className="mt-2 text-red-500">{l.readerError}</p>:readers.length?<ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">{readers.map(person=><li key={person.user_id} className="flex justify-between gap-3"><span className="min-w-0 truncate">{person.full_name}</span><time dateTime={person.read_at} className="shrink-0 text-muted-foreground">{new Date(person.read_at).toLocaleTimeString(timeLocale,{hour:"2-digit",minute:"2-digit"})}</time></li>)}</ul>:<p className="mt-2 text-muted-foreground">{l.noneRead}</p>}
   </div>}
   {error&&<p role="alert" className="mb-2 text-xs text-red-500">{error}</p>}
   {replyTo&&<div className="mb-2 flex items-center justify-between gap-2 rounded-xl border bg-card p-2 text-xs"><div className="min-w-0"><p className="font-bold">{l.replyTo} {names[replyTo.sender_id]||l.yours}</p><p className="truncate text-muted-foreground">{replyTo.body}</p></div><button type="button" aria-label={l.cancel} onClick={()=>setReplyTo(null)}><X className="h-4 w-4"/></button></div>}
   {room==="announcements"&&!isAdmin?<p className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">{l.readonly}</p>:<form onSubmit={e=>{e.preventDefault();void send()}} className="flex items-end gap-2">
    <textarea rows={2} aria-label={l.placeholder} value={body} onChange={e=>setBody(e.target.value)} maxLength={4000} placeholder={l.placeholder} className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border bg-card px-4 py-3 text-sm"/>
    <button data-action="promotion-chat-send" aria-label={l.send} disabled={!body.trim()||busy} type="submit" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white disabled:opacity-40"><Send className="h-5 w-5"/></button>
   </form>}
   {(room==="general"||isAdmin)&&<p className="mt-1 text-center text-[10px] text-muted-foreground">{l.inputHint}</p>}
  </div>
 </section>
}
