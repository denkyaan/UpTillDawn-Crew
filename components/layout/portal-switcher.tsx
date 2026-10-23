import Link from "next/link"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {accessiblePortals,type PortalAssignment,type Portal} from "@/lib/portal-access"
import {requestUiLocale} from "@/lib/server-locale"
const href:Record<Portal,string>={events:"/",promotion:"/portals/promotion",administration:"/portals/administration"}
export async function PortalSwitcher(){
 const current=await getCurrentUser()
 if(!current)return null
 const {data}=await (await createClient()).rpc("upt_my_portal_assignments")
 const assigned=accessiblePortals((data??[]) as PortalAssignment[],{approved:current.approved,blocked:current.account_blocked===true})
 const portals=[...new Set<Portal>([...(current.isOwner?["events","promotion","administration"] as Portal[]:[]),...(current.role==="staff"||current.role==="responsible_lead"||current.realIsAdmin?["events" as Portal]:[]),...assigned])]
 if(portals.length<2)return null
 const locale=await requestUiLocale()
 const names={events:{nl:"Evenementen",fr:"Événements",en:"Events",de:"Veranstaltungen"},promotion:{nl:"Promotie",fr:"Promotion",en:"Promotion",de:"Promotion"},administration:{nl:"Administratie",fr:"Administration",en:"Administration",de:"Verwaltung"}} as const
 return <nav className="flex flex-wrap items-center gap-2 border-b px-4 py-2" aria-label={({nl:"Wissel van portaal",fr:"Changer de portail",en:"Switch portal",de:"Portal wechseln"} as const)[locale]}>{portals.map(p=><Link key={p} href={`/portals/switch/${p}`} className="rounded-lg border border-violet-500/50 px-3 py-1.5 text-xs font-semibold text-violet-400">{names[p][locale]}</Link>)}</nav>
}
