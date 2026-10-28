"use client"
import {useEffect,useState} from "react"
import {createClient} from "@/lib/supabase/crew-client"
import {UserRound} from "lucide-react"

type Member={id:string;full_name:string;portal_label:string}
type Locale="nl"|"fr"|"en"|"de"
type Seen={user_id:string;last_seen_at:string}
const labels={nl:["Online","Afwezig","Offline","Nog niet actief","geleden"],fr:["En ligne","Absent","Hors ligne","Pas encore actif","plus tôt"],en:["Online","Away","Offline","Not yet active","ago"],de:["Online","Abwesend","Offline","Noch nicht aktiv","zuvor"]} as const
export function PromotionStaffList({members,photos,locale,empty}:{members:Member[];photos:Record<string,string>;locale:Locale;empty:string}){
 const [lastSeen,setLastSeen]=useState<Record<string,string>>({})
 const [clock,setClock]=useState(0)
 useEffect(()=>{
  const db=createClient();let mounted=true
  async function refresh(){
   if(document.visibilityState!=="visible")return
   await db.rpc("upt_promotion_presence_ping" as never)
   const {data}=await db.rpc("upt_promotion_presence" as never)
   if(mounted){setLastSeen(Object.fromEntries(((data||[]) as Seen[]).map(p=>[p.user_id,p.last_seen_at])));setClock(Date.now())}
  }
  void refresh()
  const interval=window.setInterval(()=>void refresh(),60000)
  document.addEventListener("visibilitychange",refresh)
  return()=>{mounted=false;clearInterval(interval);document.removeEventListener("visibilitychange",refresh)}
 },[])
 const minutes=(id:string)=>lastSeen[id]&&clock?Math.max(0,Math.floor((clock-Date.parse(lastSeen[id]))/60000)):null
 const rank=(id:string)=>{const m=minutes(id);return m===null?3:m<3?0:m<15?1:2}
 const sorted=[...members].sort((a,b)=>rank(a.id)-rank(b.id)||a.full_name.localeCompare(b.full_name,locale))
 const words=labels[locale]
 return <div className="divide-y rounded-2xl border bg-card">{sorted.map(person=>{
  const m=minutes(person.id),r=rank(person.id)
  const ago=m===null?"":m<60?`${m} min ${words[4]}`:`${Math.floor(m/60)} u ${words[4]}`
  return <div key={person.id} className="flex items-center gap-3 p-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-400">{photos[person.id]?<img src={photos[person.id]} alt="" className="h-full w-full rounded-full object-cover"/>:<UserRound className="h-5 w-5"/>}</span><div className="min-w-0"><p className="truncate font-semibold">{person.full_name}</p><p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden="true" className={`h-2 w-2 rounded-full ${r===0?"bg-green-500":r===1?"bg-amber-500":"bg-red-500"}`}/>{words[r]}{ago?` · ${ago}`:""}</p></div></div>
 })}{!members.length&&<p className="p-4 text-sm text-muted-foreground">{empty}</p>}</div>
}
