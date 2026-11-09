import {PromotionChatsClient} from "@/components/promotion/promotion-chats-client"
import SharedChatPage from "@/app/(app)/chat/page"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {requestUiLocale} from "@/lib/server-locale"
import Image from "next/image"
import Link from "next/link"
import {redirect} from "next/navigation"

export const dynamic="force-dynamic"
export default async function PromotionChats({searchParams}:{searchParams?:Promise<{view?:string;channel?:string}>}){
 const params=searchParams?await searchParams:{}
 const privateView=params.view==="private"
 const current=await getCurrentUser()
 if(!current)redirect("/login")
 const locale=await requestUiLocale()
 const db=await createClient()
 const {data,error:directoryError}=await db.rpc("upt_promotion_directory" as never)
 const directoryRows=(data||[]) as {id:string;full_name:string;profile_photo_url:string|null}[]
 const names=Object.fromEntries(directoryRows.map(x=>[x.id,x.full_name]))
 const photos:Record<string,string>={}
 await Promise.all(directoryRows.filter(person=>person.profile_photo_url).map(async person=>{
  const {data:signed}=await db.storage.from("profile-photos").createSignedUrl(person.profile_photo_url!,3600)
  if(signed?.signedUrl)photos[person.id]=signed.signedUrl
 }))
 return <main className="mx-auto flex min-w-0 max-w-4xl flex-col gap-3 px-3 pb-24 pt-3 sm:gap-4 sm:p-8">
 <Link href="/portals/promotion" className="inline-flex text-sm text-violet-400 hover:underline">{({nl:"← Terug naar promotie",fr:"← Retour à la promotion",en:"← Back to promotion",de:"← Zurück zur Promotion"} as const)[locale]}</Link>
 <header className="flex items-center gap-3"><Image src="/up-till-dawn-mark.webp" alt="Up Till Dawn" width={48} height={48} className="rounded-full"/><h1 className="text-xl font-bold sm:text-2xl">{({nl:"Promotiechats",fr:"Discussions promotion",en:"Promotion chats",de:"Promotion-Chats"} as const)[locale]}</h1></header>
 {directoryError&&<p role="alert" className="rounded-xl border border-amber-500/50 p-3 text-sm">{({nl:"De namenlijst kon niet worden geladen. Sommige afzenders worden mogelijk zonder naam weergegeven.",fr:"La liste des noms est indisponible. Certains expéditeurs peuvent apparaître sans nom.",en:"The member directory is unavailable. Some senders may appear without names.",de:"Das Mitgliederverzeichnis ist nicht verfügbar. Einige Absender werden möglicherweise ohne Namen angezeigt."} as const)[locale]}</p>}
 <nav className="grid grid-cols-2 gap-2" aria-label={({nl:"Gesprekstype",fr:"Type de conversation",en:"Conversation type",de:"Gesprächstyp"} as const)[locale]}>
  <Link href="/portals/promotion/chats" aria-current={!privateView?"page":undefined} className={`rounded-xl border px-3 py-3 text-center text-sm font-semibold ${!privateView?"border-violet-500 bg-violet-500/10 text-violet-400":"text-muted-foreground"}`}>{({nl:"Groepsgesprekken",fr:"Conversations de groupe",en:"Group chats",de:"Gruppenchats"} as const)[locale]}</Link>
  <Link href="/portals/promotion/chats?view=private" aria-current={privateView?"page":undefined} className={`rounded-xl border px-3 py-3 text-center text-sm font-semibold ${privateView?"border-violet-500 bg-violet-500/10 text-violet-400":"text-muted-foreground"}`}>{({nl:"Privégesprekken",fr:"Discussions privées",en:"Private chats",de:"Privatchats"} as const)[locale]}</Link>
 </nav>
 {privateView?<SharedChatPage promotionOnly searchParams={Promise.resolve({channel:params.channel})}/>:<PromotionChatsClient locale={locale} userId={current.id} isAdmin={current.realIsAdmin||current.isOwner} names={names} photos={photos}/>}
 </main>
}
