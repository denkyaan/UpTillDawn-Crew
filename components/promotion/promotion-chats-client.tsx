"use client"
import {useCallback,useEffect,useState} from "react"
import {createClient} from "@/lib/supabase/crew-client"
import {Send} from "lucide-react"

type Room="general"|"announcements"
type Message={id:string;room:Room;sender_id:string;body:string;created_at:string}
type Locale="nl"|"fr"|"en"|"de"
const copy={
 nl:{general:"Algemeen",announcements:"Aankondigingen",send:"Versturen",placeholder:"Schrijf een bericht…",readonly:"Alleen admins kunnen aankondigingen plaatsen.",error:"Bericht kon niet worden verzonden.",load:"Berichten konden niet worden geladen.",empty:"Nog geen berichten."},
 fr:{general:"Général",announcements:"Annonces",send:"Envoyer",placeholder:"Écrire un message…",readonly:"Seuls les admins peuvent publier des annonces.",error:"Envoi impossible.",load:"Impossible de charger les messages.",empty:"Aucun message."},
 en:{general:"General",announcements:"Announcements",send:"Send",placeholder:"Write a message…",readonly:"Only admins can post announcements.",error:"Message could not be sent.",load:"Messages could not be loaded.",empty:"No messages yet."},
 de:{general:"Allgemein",announcements:"Ankündigungen",send:"Senden",placeholder:"Nachricht schreiben…",readonly:"Nur Admins können Ankündigungen veröffentlichen.",error:"Nachricht konnte nicht gesendet werden.",load:"Nachrichten konnten nicht geladen werden.",empty:"Noch keine Nachrichten."}
} as const
export function PromotionChatsClient({locale,userId,isAdmin,names}:{locale:Locale;userId:string;isAdmin:boolean;names:Record<string,string>}){
 const [room,setRoom]=useState<Room>("general")
 const [messages,setMessages]=useState<Message[]>([])
 const [body,setBody]=useState("")
 const [error,setError]=useState("")
 const [busy,setBusy]=useState(false)
 const l=copy[locale]
 const load=useCallback(async()=>{
  const db=createClient()
  const {data,error:failure}=await db.from("promotion_chat_messages" as never).select("id,room,sender_id,body,created_at").eq("room",room).order("created_at",{ascending:false}).limit(100)
  if(failure){setError(l.load);return}
  setMessages(((data||[]) as unknown as Message[]).reverse())
 },[room,l.load])
 useEffect(()=>{
  const initial=window.setTimeout(()=>void load(),0)
  const interval=window.setInterval(()=>{if(document.visibilityState==="visible")void load()},10000)
  return()=>{clearTimeout(initial);clearInterval(interval)}
 },[load])
 async function send(){
  const message=body.trim()
  if(!message||busy||(room==="announcements"&&!isAdmin))return
  setBusy(true);setError("")
  const db=createClient()
  const {error:failure}=await db.from("promotion_chat_messages" as never).insert({room,sender_id:userId,body:message} as never)
  if(failure)setError(l.error)
  else {setBody("");await load()}
  setBusy(false)
 }
 return <section className="space-y-4">
 <div className="grid grid-cols-2 gap-2">{(["general","announcements"] as Room[]).map(r=><button key={r} type="button" onClick={()=>{setRoom(r);setMessages([]);setError("")}} className={`rounded-xl border p-3 font-semibold ${room===r?"border-violet-500 bg-violet-500/10 text-violet-400":"border-border"}`}>{l[r]}</button>)}</div>
 <div className="h-[55vh] min-h-72 space-y-3 overflow-y-auto rounded-xl border bg-card p-3" aria-live="polite">{messages.map(m=><article key={m.id} className={`max-w-[90%] rounded-xl p-3 text-sm ${m.sender_id===userId?"ml-auto bg-violet-500/15":"bg-muted"}`}><p className="mb-1 text-xs font-semibold">{names[m.sender_id]||m.sender_id.slice(0,8)}</p><p className="whitespace-pre-wrap break-words">{m.body}</p><time className="mt-1 block text-right text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString(locale)}</time></article>)}{!messages.length&&<p className="text-sm text-muted-foreground">{l.empty}</p>}</div>
 {error&&<p role="alert" className="text-sm text-red-500">{error}</p>}
 {room==="announcements"&&!isAdmin?<p className="text-sm text-muted-foreground">{l.readonly}</p>:<form onSubmit={e=>{e.preventDefault();void send()}} className="flex gap-2"><input aria-label={l.placeholder} value={body} onChange={e=>setBody(e.target.value)} maxLength={4000} placeholder={l.placeholder} className="min-w-0 flex-1 rounded-xl border bg-background p-3"/><button disabled={!body.trim()||busy} type="submit" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 text-white disabled:opacity-50"><Send className="h-4 w-4"/>{l.send}</button></form>}
 </section>
}
