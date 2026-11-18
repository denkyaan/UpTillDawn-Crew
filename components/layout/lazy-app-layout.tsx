"use client"

// Keep the existing full-featured AppLayout and its navigation, badges,
// offline workflow, chat and AI intact. The shared 23KB interactive component
// is browser-only: importing its complete icon/sidebar/navigation graph into
// EVERY authenticated Cloudflare Worker SSR render caused cross-portal CPU
// spikes on Workers Free. Authorization remains in the server layout BEFORE
// this component is returned (and independently within each protected page).
import dynamic from "next/dynamic"
import type {ReactNode} from "react"
import {activeUiLocale} from "@/lib/locale-preferences"

type Props={children:ReactNode}
const ClientShell=dynamic<Props>(
 ()=>import("@/components/layout/app-layout").then(module=>module.AppLayout),
 {ssr:false,loading:()=><div role="status" aria-live="polite" className="mx-auto max-w-7xl p-4 text-sm text-muted-foreground">{({nl:"Werkruimte laden…",fr:"Chargement de l’espace de travail…",en:"Loading workspace…",de:"Arbeitsbereich wird geladen…"} as const)[activeUiLocale()]}</div>},
)

export function LazyAppLayout({children}:Props){
 return <ClientShell>{children}</ClientShell>
}
