"use client"

// Keep the existing full-featured AppLayout and its navigation, badges,
// offline workflow, chat and AI intact. The shared 23KB interactive component
// is browser-only: importing its complete icon/sidebar/navigation graph into
// EVERY authenticated Cloudflare Worker SSR render caused cross-portal CPU
// spikes on Workers Free. Authorization remains in the server layout BEFORE
// this component is returned (and independently within each protected page).
import dynamic from "next/dynamic"
import {createContext,useContext,type ReactNode} from "react"
import {activeUiLocale} from "@/lib/locale-preferences"

type Props={children:ReactNode}
// The route's authenticated server-rendered content must stay visible while
// the browser downloads the optional interactive navigation/chrome bundle.
const ShellChildrenContext=createContext<ReactNode>(null)
function ShellLoading(){
 const content=useContext(ShellChildrenContext)
 return <div data-shell-hydrating="true" className="min-h-screen">
  <p role="status" aria-live="polite" className="mx-auto max-w-7xl p-4 text-sm text-muted-foreground">{({nl:"Werkruimte laden…",fr:"Chargement de l’espace de travail…",en:"Loading workspace…",de:"Arbeitsbereich wird geladen…"} as const)[activeUiLocale()]}</p>
  <nav aria-label="Basisnavigatie tijdens laden" data-shell-fallback-navigation="true" className="mx-auto flex max-w-7xl flex-wrap gap-2 px-4 pb-3 text-sm">
   <a href="/" className="rounded-lg border px-3 py-2">Home</a>
   <a href="/events" className="rounded-lg border px-3 py-2">{({nl:"Evenementen",fr:"Événements",en:"Events",de:"Veranstaltungen"} as const)[activeUiLocale()]}</a>
   <a href="/chat" className="rounded-lg border px-3 py-2">Chat</a>
  </nav>
  {content}
 </div>
}
const ClientShell=dynamic<Props>(
 ()=>import("@/components/layout/app-layout").then(module=>module.AppLayout),
 {ssr:false,loading:ShellLoading},
)

export function LazyAppLayout({children}:Props){
 return <ShellChildrenContext.Provider value={children}><ClientShell>{children}</ClientShell></ShellChildrenContext.Provider>
}
