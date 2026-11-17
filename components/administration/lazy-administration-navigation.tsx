"use client"

// Preserve the exact Administration navigation and its role-scoped links.
// Its many icons and interactive subtab menus must not consume Cloudflare Free
// SSR memory in every protected page request.
import dynamic from "next/dynamic"
import {activeUiLocale} from "@/lib/locale-preferences"
import type {ComponentProps} from "react"
import type {AdministrationNavigation as Navigation} from "@/components/administration/administration-navigation"

type Props=ComponentProps<typeof Navigation>
const ClientNavigation=dynamic<Props>(
 ()=>import("@/components/administration/administration-navigation").then(module=>module.AdministrationNavigation),
 {ssr:false,loading:()=><nav role="status" aria-label={({nl:"Administratienavigatie laden",fr:"Chargement de la navigation administrative",en:"Loading administration navigation",de:"Verwaltungsnavigation wird geladen"} as const)[activeUiLocale()]} className="fixed inset-x-0 bottom-0 z-[65] h-[68px] border-t bg-card pb-[env(safe-area-inset-bottom)] lg:sticky lg:top-0 lg:inset-x-auto lg:rounded-xl"/>},
)
export function LazyAdministrationNavigation(props:Props){
 return <ClientNavigation {...props}/>
}
