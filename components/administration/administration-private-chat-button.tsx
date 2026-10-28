"use client"
import {useState} from "react"
import {useRouter} from "next/navigation"
import {MessageCircle} from "lucide-react"
import {createClient} from "@/lib/supabase/crew-client"

type Locale="nl"|"fr"|"en"|"de"
const labels={nl:{open:"Privéchat starten",error:"Privéchat kon niet worden geopend."},fr:{open:"Démarrer une discussion privée",error:"Impossible d'ouvrir la discussion privée."},en:{open:"Start private chat",error:"Could not open private chat."},de:{open:"Privatchat starten",error:"Privatchat konnte nicht geöffnet werden."}} as const
export function AdministrationPrivateChatButton({personId,locale}:{personId:string;locale:Locale}){
 const router=useRouter()
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState(false)
 async function open(){
  if(busy)return
  setBusy(true);setError(false)
  const db=createClient()
  const {data,error:failure}=await db.rpc("upt_create_private_chat",{p_user:personId})
  if(failure||!data){setError(true);setBusy(false);return}
  router.push("/portals/administration/chat?channel="+encodeURIComponent(data))
 }
 return <div className="mt-2"><button type="button" disabled={busy} onClick={()=>void open()} className="inline-flex items-center gap-1.5 text-sm text-violet-400 underline disabled:opacity-50"><MessageCircle className="h-4 w-4"/>{labels[locale].open}</button>{error&&<p role="alert" className="text-xs text-red-500">{labels[locale].error}</p>}</div>
}
