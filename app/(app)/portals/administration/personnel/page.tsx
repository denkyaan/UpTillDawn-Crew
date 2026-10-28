import {createClient} from "@/lib/supabase/crew-server"
import {requestUiLocale} from "@/lib/server-locale"
import {getCurrentUser} from "@/lib/actions/auth"
import {redirect} from "next/navigation"
import Image from "next/image"
import Link from "next/link"

export const dynamic="force-dynamic"
export default async function AdministrationPersonnel(){
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 const locale=await requestUiLocale()
 const s=await createClient()
 const {data,error}=await s.rpc("upt_crew_directory")
 const members=(data||[]).sort((a,b)=>(a.full_name||"").localeCompare(b.full_name||"",locale))
 const photos:Record<string,string>={}
 await Promise.all(members.filter(m=>m.profile_photo_url).map(async m=>{const {data:photo}=await s.storage.from("profile-photos").createSignedUrl(m.profile_photo_url!,3600);if(photo?.signedUrl)photos[m.id]=photo.signedUrl}))
 const title=({nl:"Personeel",fr:"Personnel",en:"Staff",de:"Personal"} as const)[locale]
 const empty=({nl:"Geen goedgekeurde medewerkers gevonden.",fr:"Aucun membre approuvé.",en:"No approved staff found.",de:"Keine genehmigten Mitarbeitenden gefunden."} as const)[locale]
 return <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8"><h1 className="text-2xl font-bold">{title} · {members.length}</h1>
 {error?<p role="alert">{empty}</p>:<div className="grid gap-3 sm:grid-cols-2">{members.map(m=><article key={m.id} className="flex items-center gap-3 rounded-xl border bg-card p-4">
 <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-violet-500/10">{photos[m.id]?<Image src={photos[m.id]} alt="" fill sizes="48px" unoptimized className="object-cover"/>:<span className="grid h-full place-items-center font-semibold">{(m.full_name||"?").slice(0,1)}</span>}</div>
 <div className="min-w-0"><p className="truncate font-semibold">{m.full_name}</p>{m.phone_number&&<a className="text-sm text-violet-400 underline" href={`tel:${m.phone_number}`}>{m.phone_number}</a>}<p><Link href="/portals/administration/chat" className="text-xs text-muted-foreground underline">{({nl:"Chat openen",fr:"Ouvrir le chat",en:"Open chat",de:"Chat öffnen"} as const)[locale]}</Link></p></div>
 </article>)}{!members.length&&<p>{empty}</p>}</div>}</main>
}
