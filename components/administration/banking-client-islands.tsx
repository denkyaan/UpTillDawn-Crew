"use client"

// All five existing banking workspaces already use authenticated browser
// endpoints. Keep them intact and split their interactive trees out of the
// Cloudflare Free Server Components render; no bank credentials leave the
// existing server API and nothing posts a payment merely by opening a page.
import dynamic from "next/dynamic"
import type {SupportedUiLocale} from "@/lib/locale-preferences"
import {activeUiLocale} from "@/lib/locale-preferences"

type EventOption={id:string;name:string}
const Sepa=dynamic(()=>import("@/components/administration/sepa-export").then(m=>m.default),{ssr:false})
const BankStatements=dynamic(()=>import("@/components/administration/bank-statement-workspace").then(m=>m.default),{ssr:false})
const Settlements=dynamic(()=>import("@/components/administration/provider-bank-settlement-workspace").then(m=>m.default),{ssr:false})
const Transactions=dynamic(()=>import("@/components/administration/provider-transaction-workspace").then(m=>m.default),{ssr:false})
const Ponto=dynamic(()=>import("@/components/administration/ponto-bank-import").then(m=>m.default),{ssr:false})

export function BankingClientIslands({
 locale,allowPonto,events,
}:{locale:SupportedUiLocale;allowPonto:boolean;events:EventOption[]}){
 const loading=({nl:"Bankwerkruimtes laden…",fr:"Chargement des outils bancaires…",en:"Loading banking workspaces…",de:"Bankbereiche werden geladen…"} as const)[locale] ||
  ({nl:"Bankwerkruimtes laden…",fr:"Chargement des outils bancaires…",en:"Loading banking workspaces…",de:"Bankbereiche werden geladen…"} as const)[activeUiLocale()]
 return <div className="space-y-5">
  <p role="status" className="sr-only">{loading}</p>
  {allowPonto&&<Ponto initialLocale={locale}/>}
  <Sepa locale={locale}/>
  <BankStatements locale={locale}/>
  <Settlements locale={locale}/>
  <Transactions locale={locale} events={events}/>
 </div>
}
