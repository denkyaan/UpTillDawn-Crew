import {redirect} from "next/navigation"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {requestUiLocale} from "@/lib/server-locale"
import {Users,UserRound} from "lucide-react"
/* eslint-disable @next/next/no-img-element */

export const dynamic="force-dynamic"
type Member={id:string;full_name:string;profile_photo_url:string|null;portal_label:string}
const copy={
 nl:{heading:"Promotiepersoneel",promotion:"Promotie",events:"Evenementenpersoneel",empty:"Geen goedgekeurde teamleden gevonden.",other:"Andere personeelsleden (ook evenementenrol)",status:"Activiteitsstatus is nog niet beschikbaar."},
 fr:{heading:"Équipe promotion",promotion:"Promotion",events:"Équipe événements",empty:"Aucun membre approuvé.",other:"Autres membres (rôle événementiel)",status:"Le statut de présence n'est pas encore disponible."},
 en:{heading:"Promotion team",promotion:"Promotion",events:"Event staff",empty:"No approved team members found.",other:"Other staff (event role)",status:"Presence status is not available yet."},
 de:{heading:"Promotionsteam",promotion:"Promotion",events:"Eventpersonal",empty:"Keine genehmigten Teammitglieder gefunden.",other:"Weitere Mitarbeitende (Eventrolle)",status:"Anwesenheitsstatus ist noch nicht verfügbar."}
} as const
export default async function PromotionStaff(){
 const current=await getCurrentUser()
 if(!current)redirect("/login")
 const locale=await requestUiLocale()
 const db=await createClient()
 const {data,error}=await db.rpc("upt_promotion_directory" as never)
 const rows=(error?[]:(data??[])) as Member[]
 const photos:Record<string,string>={}
 await Promise.all(rows.filter(x=>x.profile_photo_url).map(async x=>{const {data}=await db.storage.from("profile-photos").createSignedUrl(x.profile_photo_url!,3600);if(data?.signedUrl)photos[x.id]=data.signedUrl}))
 const groups=[{label:copy[locale].promotion,items:rows.filter(x=>x.portal_label==="promotion")},{label:copy[locale].other,items:rows.filter(x=>x.portal_label==="events")}]
 return <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
 <header className="space-y-2"><h1 className="flex items-center gap-3 text-2xl font-bold"><Users className="h-6 w-6 text-violet-400"/>{copy[locale].heading}</h1><p className="text-sm text-muted-foreground">{copy[locale].status}</p></header>
 {error&&<p role="alert" className="rounded-xl border border-amber-500/50 p-4 text-sm">{copy[locale].empty}</p>}
 {groups.map(group=><section key={group.label} className="space-y-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group.label} · {group.items.length}</h2><div className="divide-y rounded-2xl border bg-card">{group.items.map(person=><div key={person.id} className="flex items-center gap-3 p-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-400">{photos[person.id]?<img src={photos[person.id]} alt="" className="h-full w-full rounded-full object-cover"/>:<UserRound className="h-5 w-5"/>}</span><div className="min-w-0"><p className="truncate font-semibold">{person.full_name}</p><p className="text-xs text-muted-foreground">{group.label}</p></div></div>)}{!group.items.length&&<p className="p-4 text-sm text-muted-foreground">{copy[locale].empty}</p>}</div></section>)}
 </main>
}
