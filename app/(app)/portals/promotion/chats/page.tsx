import SharedChatPage from "@/app/(app)/chat/page"
import {getCurrentUser} from "@/lib/actions/auth"
import {requestUiLocale} from "@/lib/server-locale"
import Image from "next/image"
import Link from "next/link"
import {redirect} from "next/navigation"

export const dynamic="force-dynamic"
export default async function PromotionChats({searchParams}:{searchParams?:Promise<{view?:string;channel?:string}>}){
 const params=searchParams?await searchParams:{}
 const current=await getCurrentUser()
 if(!current)redirect("/login")
 const locale=await requestUiLocale()
 return <main className="mx-auto flex min-w-0 max-w-4xl flex-col gap-3 px-3 pb-24 pt-3 sm:gap-4 sm:p-8">
  <Link href="/portals/promotion" className="inline-flex text-sm text-violet-400 hover:underline">{({nl:"← Terug naar promotie",fr:"← Retour à la promotion",en:"← Back to promotion",de:"← Zurück zur Promotion"} as const)[locale]}</Link>
  <header className="flex items-center gap-3"><Image src="/up-till-dawn-mark.webp" alt="Up Till Dawn" width={48} height={48} className="rounded-full"/><h1 className="text-xl font-bold sm:text-2xl">{({nl:"Algemene chat promotie",fr:"Chat général promotion",en:"General promotion chat",de:"Allgemeiner Promotion-Chat"} as const)[locale]}</h1></header>
  <SharedChatPage promotionOnly searchParams={Promise.resolve({channel:params.channel})}/>
 </main>
}