"use client"

// Staff directory and signed profile photos are fetched only by the signed-in
// browser through existing row-level security. Do not make the 128 MiB Worker
// instantiate this interactive tree during HTML streaming.
import dynamic from "next/dynamic"
import {activeUiLocale} from "@/lib/locale-preferences"
import type {ComponentProps} from "react"
import type {AdministrationPersonnelClient as Personnel} from "@/components/administration/administration-personnel-client"

type Props=ComponentProps<typeof Personnel>
const ClientPersonnel=dynamic<Props>(
 ()=>import("@/components/administration/administration-personnel-client").then(module=>module.AdministrationPersonnelClient),
 {ssr:false,loading:()=><main role="status" className="mx-auto max-w-5xl p-6 text-sm">{({nl:"Personeel laden…",fr:"Chargement du personnel…",en:"Loading staff…",de:"Personal wird geladen…"} as const)[activeUiLocale()]}</main>},
)
export function LazyAdministrationPersonnelClient(props:Props){
 return <ClientPersonnel {...props}/>
}
