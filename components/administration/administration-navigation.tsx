"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { SupportedUiLocale } from "@/lib/locale-preferences"
import { administrationModules, administrationCopy } from "@/lib/administration/modules"

export function AdministrationNavigation({locale}:{locale:SupportedUiLocale}){
 const pathname=usePathname()
 const t=administrationCopy[locale]
 return <nav aria-label={t.navigation} className="space-y-1">
  {administrationModules.map(item=>{
   const href=item.slug==="dashboard"?"/portals/administration":item.slug==="finance"?"/portals/administration/finance":"/portals/administration/modules/"+item.slug
   const active=pathname===href
   return <Link key={item.slug} href={href} aria-current={active?"page":undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 ${active?"bg-violet-600 text-white":"text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
    <span className="min-w-0 flex-1">{item.title[locale]}</span>
    <span aria-hidden="true" className="text-violet-400">→</span>
   </Link>
  })}
 </nav>
}
