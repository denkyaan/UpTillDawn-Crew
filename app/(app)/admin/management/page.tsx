import Link from "next/link"
import {requestUiLocale} from "@/lib/server-locale"
import {redirect} from "next/navigation"
import {getCurrentUser} from "@/lib/actions/auth"

export const dynamic="force-dynamic"

const copy0={nl:copy0[locale],fr:"Décisions et contrôles de l’organisation.",en:"Decisions and organizational controls.",de:"Entscheidungen und Organisationskontrollen."} as const
const copy1={nl:copy1[locale],fr:"Approbations du personnel",en:"Staff approvals",de:"Personal-Freigaben"} as const
const copy2={nl:copy2[locale],fr:"Heures et corrections",en:"Hours and time corrections",de:"Arbeitszeiten und Korrekturen"} as const
const copy3={nl:copy3[locale],fr:"Plannings et services",en:"Rosters and shifts",de:"Dienstpläne und Schichten"} as const
const copy4={nl:copy4[locale],fr:"Gestion de l’organisation",en:"Organization management",de:"Organisationsverwaltung"} as const
const copy5={nl:copy5[locale],fr:"Fonctions opérationnelles gérées par Admin.",en:"Operations managed directly by Admin.",de:"Direkt von Admin verwaltete Funktionen."} as const
const copy6={nl:copy6[locale],fr:"Tâches et affectations",en:"Tasks and assignments",de:"Aufgaben und Zuweisungen"} as const
const copy7={nl:copy7[locale],fr:"Supervision financière",en:"Financial oversight",de:"Finanzaufsicht"} as const
const copy8={nl:copy8[locale],fr:"Données de vente et exports disponibles.",en:"Available sales data and exports.",de:"Verfügbare Verkaufsdaten und Exporte."} as const
const copy9={nl:copy9[locale],fr:"Ventes et revenus",en:"Sales and revenue",de:"Verkäufe und Erlöse"} as const
const copy10={nl:copy10[locale],fr:"Exports Excel",en:"Excel exports",de:"Excel-Exporte"} as const
const copy11={nl:copy11[locale],fr:"← Administration",en:copy11[locale],de:copy11[locale]} as const
const copy12={nl:copy12[locale],fr:"Gestion centrale",en:"Central management",de:"Zentrale Verwaltung"} as const
const copy13={nl:copy13[locale],fr:"Approbations, gestion et finances depuis le portail Admin. Les fonctions existantes restent sur leurs routes sécurisées.",en:"Approvals, management and financial oversight from Admin. Existing features remain on their secured routes.",de:"Freigaben, Verwaltung und Finanzaufsicht im Admin-Portal. Bestehende Funktionen bleiben auf ihren geschützten Routen."} as const
const groups=(locale:Awaited<ReturnType<typeof requestUiLocale>>)=>[
 {title:"Goedkeuringen",description:copy0[locale],links:[{label:copy1[locale],href:"/personnel"},{label:copy2[locale],href:"/admin/time-records"},{label:copy3[locale],href:"/shifts"}]},
 {title:copy4[locale],description:copy5[locale],links:[{label:copy6[locale],href:"/tasks"},{label:"Evenementen",href:"/events"},{label:"Personeel",href:"/crew"},{label:"Inventaris",href:"/inventory"},{label:"Incidenten",href:"/incidents"},{label:"Platformbeheer",href:"/admin/platform"}]},
 {title:copy7[locale],description:copy8[locale],links:[{label:copy9[locale],href:"/sales"},{label:copy10[locale],href:"/exports"}]},
] as const

export default async function AdminManagementPage(){
 const actor=await getCurrentUser()
 const locale=await requestUiLocale()
 if(!actor?.isAdmin||(!actor.approved&&!actor.isOwner)||actor.account_blocked&&!actor.isOwner)redirect("/")
 return <main className="mx-auto max-w-6xl space-y-6 p-4 pb-32 md:p-8"><div><Link href="/admin" className="text-sm text-violet-400">{copy11[locale]}</Link><h1 className="mt-3 text-3xl font-bold">{copy12[locale]}</h1><p className="mt-2 text-sm text-muted-foreground">{copy13[locale]}</p></div><div className="grid gap-4 lg:grid-cols-3">{groups(locale).map(group=><section key={group.title} className="space-y-3 rounded-2xl border bg-card p-4"><h2 className="text-xl font-bold">{group.title}</h2><p className="text-sm text-muted-foreground">{group.description}</p><div className="grid gap-2">{group.links.map(link=><Link key={link.href} href={link.href} className="rounded-lg border px-3 py-3 text-sm font-medium hover:border-violet-500/60">{link.label}</Link>)}</div></section>)}</div></main>
}
