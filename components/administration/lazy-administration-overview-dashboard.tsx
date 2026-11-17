"use client"

// Administration's live overview is browser-authenticated through existing
// Supabase RLS. Keep its full interactive work pulse available, but prevent
// the 23KB client dashboard from being rendered inside every Worker SSR
// request; this changes only the rendering boundary, not data or permissions.
import dynamic from "next/dynamic"
import {activeUiLocale} from "@/lib/locale-preferences"
import type {ComponentProps} from "react"
import type {AdministrationOverviewDashboard as OverviewComponent} from "@/components/administration/administration-overview-dashboard"

type Props=ComponentProps<typeof OverviewComponent>
const ClientOverview=dynamic<Props>(
 ()=>import("@/components/administration/administration-overview-dashboard").then(module=>module.AdministrationOverviewDashboard),
 {ssr:false,loading:()=><main role="status" className="mx-auto max-w-6xl p-6 text-sm text-muted-foreground">{({nl:"Administratief werkcentrum laden…",fr:"Chargement du centre administratif…",en:"Loading administration work center…",de:"Verwaltungsübersicht wird geladen…"} as const)[activeUiLocale()]}</main>},
)
export function LazyAdministrationOverviewDashboard(props:Props){
 return <ClientOverview {...props}/>
}
