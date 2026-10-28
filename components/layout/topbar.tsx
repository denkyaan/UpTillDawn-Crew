"use client"
import { useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { useAuth,useDisplayName } from "@/lib/providers"
import { signOut } from "@/lib/actions/auth"
import { disablePushNotifications } from "@/lib/push-client"

export function Topbar({notificationMissed=0}:{notificationMissed?:number}){
 const name=useDisplayName()
 const {roles,isAdmin}=useAuth()
 const [loggingOut,startLogout]=useTransition()
 const roleLabel=roles.includes("admin")?"Beheerder":roles.includes("responsible_lead")?"Verantwoordelijke":"Personeel"

 return <header className="flex min-h-16 min-w-0 items-center justify-between gap-2 border-b bg-card px-3 sm:gap-3 sm:px-4">
  <Link href={isAdmin?"/admin":"/"} className="flex min-w-0 shrink items-center gap-2 font-black">
   <Image src="/up-till-dawn-mark.webp" alt="UP TILL DAWN" width={30} height={30} className="h-[30px] w-[30px] rounded-lg object-cover lg:hidden" priority />
   <span className="hidden min-[390px]:inline truncate">Up Till Dawn</span>
  </Link>
  <div className="flex min-w-0 shrink-0 items-center gap-2 text-[12px] sm:gap-3 sm:text-sm">
   <span className="hidden sm:inline">{name} · {roleLabel}</span>
   <Link href="/notifications" className="relative inline-flex items-center gap-1">
    <span className="hidden sm:inline">Meldingen</span><span className="sm:hidden" aria-label="Meldingen">🔔</span>
    {notificationMissed>0&&<span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black leading-none text-white">{notificationMissed>99?"99+":notificationMissed}</span>}
   </Link>
   <Link href="/settings" className="hidden sm:inline">Profiel</Link>
   <button
    type="button"
    disabled={loggingOut}
    onClick={()=>startLogout(async()=>{
      await disablePushNotifications().catch(()=>{})
      await signOut()
    })}
    className="rounded-lg border px-2 py-1.5 text-[11px] disabled:opacity-50 sm:p-2 sm:text-sm"
   >{loggingOut?"…":"Uitloggen"}</button>
  </div>
 </header>
}
