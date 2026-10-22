"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { SupportedUiLocale } from "@/lib/locale-preferences"
import { administrationModules, administrationCopy } from "@/lib/administration/modules"

export function AdministrationNavigation({locale}:{locale:SupportedUiLocale}){
 const pathname=usePathname()
 const t=administrationCopy[locale]
 return <nav aria-label={t.navigation} className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
  {administrationModules.map(item=>{
   const href=item.slug==="dashboard"?"/portals/administration":item.slug==="finance"?"/portals/administration/finance":"/portals/administration/modules/"+item.slug
   const active=pathname===href
   return <Link key={item.slug} href={href} aria-current={active?"page":undefined} className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 ${active?"border-violet-500 bg-violet-500/15 text-violet-300":"border-border bg-card/70 text-foreground hover:border-violet-500/60 hover:bg-violet-500/10"}`}>
    <span className="min-w-0 flex-1">{item.title[locale]}</span>
    <span aria-hidden="true" className="text-violet-400">→</span>
   </Link>
  })}
 </nav>
}
