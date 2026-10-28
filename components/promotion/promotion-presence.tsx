"use client"
import {useEffect,useState} from "react"
import {createClient} from "@/lib/supabase/client"

type Locale="nl"|"fr"|"en"|"de"
type Presence={user_id:string;last_seen_at:string}
const labels={
 nl:{online:"Online",away:"Afwezig",offline:"Offline",unknown:"Nog niet actief",ago:"geleden"},
 fr:{online:"En ligne",away:"Absent",offline:"Hors ligne",unknown:"Pas encore actif",ago:"plus tôt"},
 en:{online:"Online",away:"Away",offline:"Offline",unknown:"Not yet active",ago:"ago"},
 de:{online:"Online",away:"Abwesend",offline:"Offline",unknown:"Noch nicht aktiv",ago:"zuvor"}
} as const
export function PromotionPresence({userId,locale}:{userId:string;locale:Locale}){
 const [seen,setSeen]=useState<string|null>(null)
 const [now,setNow]=useState(Date.now())
 useEffect(()=>{
  const db=createClient()
  let active=true
  async function refresh(){
   if(document.visibilityState!=="visible")return
   await db.rpc("upt_promotion_presence_ping" as never)
   const {data}=await db.rpc("upt_promotion_presence" as never)
   if(active){const person=((data||[]) as Presence[]).find(p=>p.user_id===userId);setSeen(person?.last_seen_at||null);setNow(Date.now())}
  }
  void refresh()
  const timer=window.setInterval(()=>void refresh(),60000)
  document.addEventListener("visibilitychange",refresh)
  return()=>{active=false;window.clearInterval(timer);document.removeEventListener("visibilitychange",refresh)}
 },[userId])
 const mins=seen?Math.max(0,Math.floor((now-Date.parse(seen))/60000)):null
 const status=mins===null?"unknown":mins<3?"online":mins<15?"away":"offline"
 const color=status==="online"?"bg-green-500":status==="away"?"bg-amber-500":"bg-red-500"
 const l=labels[locale]
 const elapsed=mins===null?"":mins<60?`${mins} min ${l.ago}`:`${Math.floor(mins/60)} u ${l.ago}`
 return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden="true" className={`h-2 w-2 rounded-full ${color}`}/>{l[status]}{elapsed?` · ${elapsed}`:""}</span>
}
