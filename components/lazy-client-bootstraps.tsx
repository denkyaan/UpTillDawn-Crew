"use client"

import dynamic from "next/dynamic"

// Local-first bootstraps: translate on the user's device, manage offline
// queues/IndexedDB and push subscriptions in the PWA. Never evaluate their
// large runtime dictionaries, OCR-like parsers or service-worker code during
// authenticated Cloudflare Worker SSR.
//
// Both remain mounted for every route, including the login screen. Only
// module evaluation moves to the browser; no user-facing feature is removed.
const ClientLocaleSync=dynamic(
 ()=>import("@/components/locale-sync").then(module=>module.LocaleSync),
 {ssr:false},
)
const ClientPwaRegister=dynamic(
 ()=>import("@/components/pwa-register").then(module=>module.PwaRegister),
 {ssr:false},
)

export function LazyClientBootstraps(){
 return <><ClientLocaleSync/><ClientPwaRegister/></>
}
