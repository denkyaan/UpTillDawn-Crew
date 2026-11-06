import Link from "next/link"
import {requestUiLocale} from "@/lib/server-locale"
import {redirect} from "next/navigation"
import {getCurrentUser} from "@/lib/actions/auth"

export const dynamic="force-dynamic"

const copy0={nl:"Beslissingen en controles voor de organisatie.",fr:"Décisions et contrôles de l’organisation.",en:"Decisions and organizational controls.",de:"Entscheidungen und Organisationskontrollen."} as const
const copy1={nl:"Personeelsgoedkeuringen",fr:"Approbations du personnel",en:"Staff approvals",de:"Personal-Freigaben"} as const
const copy2={nl:"Werkuren en tijdcorrecties",fr:"Heures et corrections",en:"Hours and time corrections",de:"Arbeitszeiten und Korrekturen"} as const
const copy3={nl:"Werkroosters en diensten",fr:"Plannings et services",en:"Rosters and shifts",de:"Dienstpläne und Schichten"} as const
const copy4={nl:"Organisatiebeheer",fr:"Gestion de l’organisation",en:"Organization management",de:"Organisationsverwaltung"} as const
const copy5={nl:"Operationele functies die Admin rechtstreeks beheert.",fr:"Fonctions opérationnelles gérées par Admin.",en:"Operations managed directly by Admin.",de:"Direkt von Admin verwaltete Funktionen."} as const
const copy6={nl:"Taken en toewijzingen",fr:"Tâches et affectations",en:"Tasks and assignments",de:"Aufgaben und Zuweisungen"} as const
const copy7={nl:"Financieel toezicht",fr:"Supervision financière",en:"Financial oversight",de:"Finanzaufsicht"} as const
const copy8={nl:"Beschikbare verkoopgegevens en exports.",fr:"Données de vente et exports disponibles.",en:"Available sales data and exports.",de:"Verfügbare Verkaufsdaten und Exporte."} as const
const copy9={nl:"Verkoop en opbrengsten",fr:"Ventes et revenus",en:"Sales and revenue",de:"Verkäufe und Erlöse"} as const
const copy10={nl:"Excel-exports",fr:"Exports Excel",en:"Excel exports",de:"Excel-Exporte"} as const
const copy11={nl:"← Admin",fr:"← Administration",en:"← Admin",de:"← Admin"} as const
const copy12={nl:"Centraal beheer",fr:"Gestion centrale",en:"Central management",de:"Zentrale Verwaltung"} as const
const copy13={nl:"Goedkeuringen, organisatiebeheer en financieel toezicht vanuit het Admin-portaal. Bestaande functies blijven in hun huidige beveiligde routes.",fr:"Approbations, gestion et finances depuis le portail Admin. Les fonctions existantes restent sur leurs routes sécurisées.",en:"Approvals, management and financial oversight from Admin. Existing features remain on their secured routes.",de:"Freigaben, Verwaltung und Finanzaufsicht im Admin-Portal. Bestehende Funktionen bleiben auf ihren geschützten Routen."} as const
const groups=(locale:Awaited<ReturnType<typeof requestUiLocale>>)=>[
 {title:{nl:"Goedkeuringen",fr:"Approbations",en:"Approvals",de:"Freigaben"}[locale],description:copy0[locale],links:[{label:copy1[locale],href:"/personnel"},{label:copy2[locale],href:"/admin/time-records"},{label:copy3[locale],href:"/shifts"}]},
 {title:copy4[locale],description:copy5[locale],links:[{label:copy6[locale],href:"/tasks"},{label:{nl:"Evenementen",fr:"Événements",en:"Events",de:"Veranstaltungen"}[locale],href:"/events"},{label:{nl:"Personeel",fr:"Personnel",en:"Staff",de:"Personal"}[locale],href:"/crew"},{label:{nl:"Inventaris",fr:"Inventaire",en:"Inventory",de:"Inventar"}[locale],href:"/inventory"},{label:{nl:"Incidenten",fr:"Incidents",en:"Incidents",de:"Vorfälle"}[locale],href:"/incidents"},{label:{nl:"Platformbeheer",fr:"Gestion de plateforme",en:"Platform management",de:"Plattformverwaltung"}[locale],href:"/admin/platform"}]},
 {title:copy7[locale],description:copy8[locale],links:[{label:copy9[locale],href:"/sales"},{label:copy10[locale],href:"/exports"}]},
] as const

export default async function AdminManagementPage(){
 const actor=await getCurrentUser()
 const locale=await requestUiLocale()
 if(!actor?.isAdmin||(!actor.approved&&!actor.isOwner)||actor.account_blocked&&!actor.isOwner)redirect("/")
 return <main className="mx-auto max-w-6xl space-y-6 p-4 pb-32 md:p-8"><div><Link href="/admin" className="text-sm text-violet-400">{copy11[locale]}</Link><h1 className="mt-3 text-3xl font-bold">{copy12[locale]}</h1><p className="mt-2 text-sm text-muted-foreground">{copy13[locale]}</p></div><div className="grid gap-4 lg:grid-cols-3">{groups(locale).map(group=><section key={group.title} className="space-y-3 rounded-2xl border bg-card p-4"><h2 className="text-xl font-bold">{group.title}</h2><p className="text-sm text-muted-foreground">{group.description}</p><div className="grid gap-2">{group.links.map(link=><Link key={link.href} href={link.href} className="rounded-lg border px-3 py-3 text-sm font-medium hover:border-violet-500/60">{link.label}</Link>)}</div></section>)}</div></main>
}
