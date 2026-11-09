"use client"

import {useState} from "react"
import {useRouter} from "next/navigation"
import {MessageCirclePlus,Search,UserRound} from "lucide-react"
import {createClient} from "@/lib/supabase/crew-client"
import type {SupportedUiLocale} from "@/lib/locale-preferences"

type Member={id:string;full_name:string;portal_label:string;profile_photo_url:string|null}
const labels={
 nl:{title:"Privégesprek starten",intro:"Kies een lid van het promotieteam. Privégesprekken gebruiken dezelfde beveiligde chat als de andere portalen.",search:"Zoek teamlid…",empty:"Geen teamleden gevonden.",busy:"Gesprek openen…",error:"Privégesprek kon niet worden geopend.",open:"Chat starten"},
 fr:{title:"Démarrer une discussion privée",intro:"Choisissez un membre de l'équipe promotion. Les discussions privées utilisent la même messagerie sécurisée que les autres portails.",search:"Rechercher un membre…",empty:"Aucun membre trouvé.",busy:"Ouverture…",error:"Impossible d'ouvrir la conversation privée.",open:"Démarrer"},
 en:{title:"Start a private conversation",intro:"Choose a promotion team member. Private conversations use the same secure chat as the other portals.",search:"Find a teammate…",empty:"No team members found.",busy:"Opening conversation…",error:"Unable to open the private conversation.",open:"Start chat"},
 de:{title:"Privatchat starten",intro:"Wähle ein Mitglied des Promotionsteams. Privatchats nutzen die gleiche sichere Chatfunktion wie die anderen Portale.",search:"Teammitglied suchen…",empty:"Keine Teammitglieder gefunden.",busy:"Chat wird geöffnet…",error:"Privatchat konnte nicht geöffnet werden.",open:"Chat starten"}
} as const

export function PromotionPrivateChatStarter({locale,members,userId}:{locale:SupportedUiLocale;members:Member[];userId:string}){
 const router=useRouter()
 const [query,setQuery]=useState("")
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState("")
 const t=labels[locale]
 // The server-issued directory contains only accessible accounts. Do not
 // permit a manually entered user ID or infer private account membership.
 const candidates=members.filter(person=>person.id!==userId&&person.portal_label==="promotion"&&person.full_name.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale))).slice(0,100)
 async function open(user:string){
  if(busy||!candidates.some(person=>person.id===user))return
  setBusy(true);setError("")
  try{
   const {data,error:failure}=await createClient().rpc("upt_create_private_chat",{p_user:user})
   if(failure||!data)throw new Error("Private chat unavailable")
   router.push("/portals/promotion/chats?view=private&channel="+encodeURIComponent(data))
   router.refresh()
  }catch{setError(t.error)}finally{setBusy(false)}
 }
 return <section className="rounded-2xl border bg-card p-4" aria-label={t.title}>
  <div className="flex items-center gap-2"><MessageCirclePlus className="h-5 w-5 text-violet-400"/><h2 className="text-base font-bold">{t.title}</h2></div>
  <p className="mt-1 text-xs text-muted-foreground">{t.intro}</p>
  <label className="mt-3 flex items-center gap-2 rounded-xl border bg-background px-3 py-2"><Search aria-hidden="true" className="h-4 w-4 text-muted-foreground"/><input className="w-full min-w-0 bg-transparent text-sm outline-none" aria-label={t.search} placeholder={t.search} value={query} onChange={event=>setQuery(event.target.value)}/></label>
  <div className="mt-3 max-h-[48dvh] space-y-1 overflow-y-auto">
   {candidates.map(person=><button type="button" key={person.id} disabled={busy} onClick={()=>void open(person.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted disabled:opacity-40">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-violet-500/10"><UserRound className="h-5 w-5 text-violet-400"/></span>
    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{person.full_name}</span><span className="text-xs text-violet-400">{busy?t.busy:t.open}</span>
   </button>)}
   {!candidates.length&&<p className="p-3 text-xs text-muted-foreground">{t.empty}</p>}
  </div>
  {error&&<p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
 </section>
}
