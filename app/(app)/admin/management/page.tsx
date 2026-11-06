import Link from "next/link"
import {redirect} from "next/navigation"
import {getCurrentUser} from "@/lib/actions/auth"

export const dynamic="force-dynamic"

const groups=[
 {title:"Goedkeuringen",description:"Beslissingen en controles voor de organisatie.",links:[{label:"Personeelsgoedkeuringen",href:"/personnel"},{label:"Werkuren en tijdcorrecties",href:"/admin/time-records"},{label:"Werkroosters en diensten",href:"/shifts"}]},
 {title:"Organisatiebeheer",description:"Operationele functies die Admin rechtstreeks beheert.",links:[{label:"Taken en toewijzingen",href:"/tasks"},{label:"Evenementen",href:"/events"},{label:"Personeel",href:"/crew"},{label:"Inventaris",href:"/inventory"},{label:"Incidenten",href:"/incidents"},{label:"Platformbeheer",href:"/admin/platform"}]},
 {title:"Financieel toezicht",description:"Beschikbare verkoopgegevens en exports.",links:[{label:"Verkoop en opbrengsten",href:"/sales"},{label:"Excel-exports",href:"/exports"}]},
] as const

export default async function AdminManagementPage(){
 const actor=await getCurrentUser()
 if(!actor?.isAdmin||(!actor.approved&&!actor.isOwner)||actor.account_blocked&&!actor.isOwner)redirect("/")
 return <main className="mx-auto max-w-6xl space-y-6 p-4 pb-32 md:p-8"><div><Link href="/admin" className="text-sm text-violet-400">← Admin</Link><h1 className="mt-3 text-3xl font-bold">Centraal beheer</h1><p className="mt-2 text-sm text-muted-foreground">Goedkeuringen, organisatiebeheer en financieel toezicht vanuit het Admin-portaal. Bestaande functies blijven in hun huidige beveiligde routes.</p></div><div className="grid gap-4 lg:grid-cols-3">{groups.map(group=><section key={group.title} className="space-y-3 rounded-2xl border bg-card p-4"><h2 className="text-xl font-bold">{group.title}</h2><p className="text-sm text-muted-foreground">{group.description}</p><div className="grid gap-2">{group.links.map(link=><Link key={link.href} href={link.href} className="rounded-lg border px-3 py-3 text-sm font-medium hover:border-violet-500/60">{link.label}</Link>)}</div></section>)}</div></main>
}
