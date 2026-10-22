import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { requestUiLocale } from "@/lib/server-locale"
import { administrationModules, administrationCopy } from "@/lib/administration/modules"
import { getCurrentUser } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/crew-server"
import { canOpenPortal, type PortalAssignment } from "@/lib/portal-access"

export default async function AdministrationModulePage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params
 const module=administrationModules.find(item=>item.slug===slug&&slug!=="dashboard"&&slug!=="finance")
 if(!module)notFound()
 const current=await getCurrentUser()
 if(!current)redirect("/login")
 if(!current.approved||Boolean(current.account_blocked))redirect("/portals")
 const supabase=await createClient()
 const {data,error}=await supabase.rpc("upt_my_portal_assignments")
 if(error&&!current.isAdmin)redirect("/portals")
 if(!current.isAdmin&&!canOpenPortal("administration",(data??[]) as PortalAssignment[],{approved:current.approved,blocked:current.account_blocked===true}))redirect("/portals")
 const locale=await requestUiLocale()
 const t=administrationCopy[locale]
 return <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-8">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <Link href="/portals/administration" className="text-sm font-semibold text-violet-400 hover:underline">← {t.back}</Link>
   <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{t.phase}</span>
  </div>
  <header className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-card to-card p-6 sm:p-10">
   <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">{t.workspace}</p>
   <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{module.title[locale]}</h1>
   <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">{t.preview}</p>
  </header>
  <section aria-label={t.readOnly} className="rounded-2xl border border-dashed border-border bg-card p-6 sm:p-10">
   <p className="font-semibold">{t.readOnly}</p>
   <p className="mt-2 text-sm leading-7 text-muted-foreground">{t.preview}</p>
   {slug==="invoices"||slug==="documents"||slug==="banking"?<Link href="/portals/administration/finance" className="mt-5 inline-flex rounded-xl border border-violet-500/40 px-4 py-3 text-sm font-semibold text-violet-400 hover:bg-violet-500/10">{t.openFinance} →</Link>:null}
  </section>
 </main>
}
