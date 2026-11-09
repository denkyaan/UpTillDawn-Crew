"use client"
import {useCallback,useEffect,useRef,useState} from "react"
import {createClient} from "@/lib/supabase/crew-client"
import {Send,MessagesSquare, Megaphone} from "lucide-react"

type Room="general"|"announcements"
type Message={id:string;room:Room;sender_id:string;body:string;created_at:string}
type Locale="nl"|"fr"|"en"|"de"
const copy={
 nl:{general:"Algemeen",announcements:"Aankondigingen",send:"Versturen",placeholder:"Schrijf een bericht…",readonly:"Alleen admins kunnen aankondigingen plaatsen.",error:"Bericht kon niet worden verzonden.",load:"Berichten konden niet worden geladen.",empty:"Nog geen berichten.",loading:"Berichten laden…",yours:"Jij",inputHint:"Enter = nieuwe regel · verstuur met de knop."},
 fr:{general:"Général",announcements:"Annonces",send:"Envoyer",placeholder:"Écrire un message…",readonly:"Seuls les admins peuvent publier des annonces.",error:"Envoi impossible.",load:"Impossible de charger les messages.",empty:"Aucun message.",loading:"Chargement des messages…",yours:"Vous",inputHint:"Entrée = nouvelle ligne · envoyez avec le bouton."},
 en:{general:"General",announcements:"Announcements",send:"Send",placeholder:"Write a message…",readonly:"Only admins can post announcements.",error:"Message could not be sent.",load:"Messages could not be loaded.",empty:"No messages yet.",loading:"Loading messages…",yours:"You",inputHint:"Enter = new line · use the send button."},
 de:{general:"Allgemein",announcements:"Ankündigungen",send:"Senden",placeholder:"Nachricht schreiben…",readonly:"Nur Admins können Ankündigungen veröffentlichen.",error:"Nachricht konnte nicht gesendet werden.",load:"Nachrichten konnten nicht geladen werden.",empty:"Noch keine Nachrichten.",loading:"Nachrichten werden geladen…",yours:"Du",inputHint:"Enter = neue Zeile · mit der Schaltfläche senden."}
} as const
export function PromotionChatsClient({locale,userId,isAdmin,names}:{locale:Locale;userId:string;isAdmin:boolean;names:Record<string,string>}){
 const [room,setRoom]=useState<Room>("general")
 const [messages,setMessages]=useState<Message[]>([])
 const [body,setBody]=useState("")
 const [error,setError]=useState("")
 const [busy,setBusy]=useState(false)
 const [loaded,setLoaded]=useState(false)
 const [loadFailed,setLoadFailed]=useState(false)
 const sequence=useRef(0)
 const viewportRef=useRef<HTMLDivElement>(null)
 const followLatest=useRef(true)
 const sending=useRef(false)
 const l=copy[locale]
 useEffect(()=>{
  const viewport=viewportRef.current
  if(viewport&&followLatest.current)viewport.scrollTop=viewport.scrollHeight
 },[messages,room])
 const timeLocale=locale==="nl"?"nl-BE":locale==="fr"?"fr-BE":locale==="en"?"en-GB":"de-DE"

 const load=useCallback(async()=>{
  const current=++sequence.current
  try{
   const db=createClient()
   const {data,error:failure}=await db.from("promotion_chat_messages" as never).select("id,room,sender_id,body,created_at").eq("room",room).order("created_at",{ascending:false}).limit(100)
   if(current!==sequence.current)return
   if(failure){setLoadFailed(true);setError(l.load);return}
   setLoadFailed(false);setLoaded(true);setError("")
   setMessages(((data||[]) as unknown as Message[]).reverse())
  }catch{
   if(current!==sequence.current)return
   setLoadFailed(true);setError(l.load)
  }
 },[room,l.load])
 useEffect(()=>{
  const initial=window.setTimeout(()=>void load(),0)
  const interval=window.setInterval(()=>{if(document.visibilityState==="visible")void load()},10000)
  const activeSequence=sequence
  return()=>{activeSequence.current++;clearTimeout(initial);clearInterval(interval)}
 },[load])
 async function send(){
  const message=body.trim()
  if(!message||sending.current||(room==="announcements"&&!isAdmin))return
  sending.current=true
  setBusy(true);setError("")
  const submittedRoom=room

  try{
   const db=createClient()
   const {error:failure}=await db.from("promotion_chat_messages" as never).insert({room:submittedRoom,sender_id:userId,body:message} as never)
   if(failure){setError(l.error);return}
   setBody("")
   await load()
  }catch{
   setError(l.error)
  }finally{
   sending.current=false
   setBusy(false)
  }
 }
 return <section aria-label={l.general+" / "+l.announcements} className="flex h-[calc(100dvh-21rem-env(safe-area-inset-bottom))] min-h-[18rem] min-w-0 flex-col overflow-hidden rounded-2xl border bg-background shadow-sm sm:h-[min(70dvh,690px)]">
  <div className="shrink-0 border-b bg-card/70 p-2">
   <div className="grid grid-cols-2 gap-2">
    {(["general","announcements"] as Room[]).map(r=>{
     const Icon=r==="general"?MessagesSquare:Megaphone
     return <button key={r} data-promotion-room={r} type="button" disabled={busy} onClick={()=>{if(sending.current)return;sequence.current++;followLatest.current=true;setRoom(r);setMessages([]);setLoaded(false);setLoadFailed(false);setError("")}} aria-pressed={room===r} className={`flex min-w-0 items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors disabled:opacity-50 sm:text-sm ${room===r?"border-violet-500 bg-violet-500/10 text-violet-400":"border-border text-muted-foreground"}`}>
      <Icon className="h-4 w-4 shrink-0"/><span className="min-w-0 break-words text-center">{l[r]}</span>
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
    return <article key={m.id} data-promotion-message={m.id} className={`flex items-end gap-2 ${mine?"justify-end":"justify-start"}`}>
     {!mine&&<span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted text-[10px] font-bold">{initials}</span>}
     <div className="flex max-w-[82%] min-w-0 flex-col gap-1">
      {!mine&&<p className="px-1 text-xs font-semibold text-muted-foreground">{name}</p>}
      <div className={`rounded-2xl px-3.5 py-2.5 shadow-sm ${mine?"rounded-br-md bg-violet-600 text-white":"rounded-bl-md border bg-card"}`}>
       <p data-no-translate className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p>
       <time dateTime={m.created_at} className={`mt-1.5 block text-right text-[10px] ${mine?"text-white/75":"text-muted-foreground"}`}>{new Date(m.created_at).toLocaleTimeString(timeLocale,{hour:"2-digit",minute:"2-digit"})}</time>
      </div>
     </div>
    </article>
   })}
  </div>
  <div className="shrink-0 border-t bg-background p-3">
   {error&&<p role="alert" className="mb-2 text-xs text-red-500">{error}</p>}
   {room==="announcements"&&!isAdmin?<p className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">{l.readonly}</p>:<form onSubmit={e=>{e.preventDefault();void send()}} className="flex items-end gap-2">
    <textarea rows={2} aria-label={l.placeholder} value={body} onChange={e=>setBody(e.target.value)} maxLength={4000} placeholder={l.placeholder} className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border bg-card px-4 py-3 text-sm"/>
    <button data-action="promotion-chat-send" aria-label={l.send} disabled={!body.trim()||busy} type="submit" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white disabled:opacity-40"><Send className="h-5 w-5"/></button>
   </form>}
   {room==="general"||isAdmin?<p className="mt-1 text-center text-[10px] text-muted-foreground">{l.inputHint}</p>:null}
  </div>
 </section>
}
