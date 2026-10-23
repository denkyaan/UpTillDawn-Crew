import Link from "next/link"
import {redirect} from "next/navigation"
import {revalidatePath} from "next/cache"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {requestUiLocale} from "@/lib/server-locale"
export const dynamic="force-dynamic"
const messages={
 nl:{title:"Promotieblokkeringen",intro:"Beheer strikes en hef blokkeringen op met een geregistreerde reden.",empty:"Geen sancties geregistreerd.",user:"Gebruiker",strikes:"Strikes",blocks:"Blokkeringen",until:"Geblokkeerd tot",permanent:"Definitief geblokkeerd",active:"Actief",reason:"Reden voor opheffing (minimaal 10 tekens)",unblock:"Blokkering opheffen",back:"Administratie",error:"Gegevens konden niet worden geladen."},
 fr:{title:"Blocages promotion",intro:"Consultez les sanctions et levez un blocage avec une justification enregistrée.",empty:"Aucune sanction enregistrée.",user:"Utilisateur",strikes:"Avertissements",blocks:"Blocages",until:"Bloqué jusqu’au",permanent:"Bloqué définitivement",active:"Actif",reason:"Motif de levée (10 caractères minimum)",unblock:"Lever le blocage",back:"Administration",error:"Impossible de charger les données."},
 en:{title:"Promotion restrictions",intro:"Review strikes and lift restrictions with an audited reason.",empty:"No restrictions recorded.",user:"User",strikes:"Strikes",blocks:"Blocks",until:"Blocked until",permanent:"Permanently blocked",active:"Active",reason:"Reason for lifting (at least 10 characters)",unblock:"Lift restriction",back:"Administration",error:"Unable to load records."},
 de:{title:"Promotion-Sperren",intro:"Verwarnungen prüfen und Sperren mit protokollierter Begründung aufheben.",empty:"Keine Sanktionen erfasst.",user:"Benutzer",strikes:"Verwarnungen",blocks:"Sperren",until:"Gesperrt bis",permanent:"Dauerhaft gesperrt",active:"Aktiv",reason:"Grund für die Aufhebung (mindestens 10 Zeichen)",unblock:"Sperre aufheben",back:"Verwaltung",error:"Datensätze konnten nicht geladen werden."}
} as const
async function unblock(form:FormData){
 "use server"
 const actor=await getCurrentUser()
 if(!actor?.isAdmin&&!actor?.isOwner)throw new Error("Admin required")
 const user=String(form.get("user")??"")
 const reason=String(form.get("reason")??"").trim()
 if(!/^[0-9a-f-]{36}$/i.test(user)||reason.length<10)throw new Error("Invalid unblock request")
 const db=await createClient()
 const {error}=await db.rpc("upt_admin_unblock_promotion" as never,{p_user:user,p_reason:reason} as never)
 if(error)throw new Error("Could not lift restriction")
 revalidatePath("/portals/administration/promotion-discipline")
}
export default async function PromotionDisciplinePage(){
 const actor=await getCurrentUser()
 if(!actor)redirect("/login")
 if(!actor.isAdmin&&!actor.isOwner)redirect("/portals/administration")
 const locale=await requestUiLocale()
 const t=messages[locale]
 const db=await createClient()
 const {data,error}=await db.rpc("upt_admin_promotion_discipline_list" as never)
 const rows=(data??[]) as {user_id:string;strikes:number;suspension_count:number;blocked_until:string|null;permanently_blocked:boolean}[]
 return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
 <Link href="/portals/administration" className="text-sm text-violet-400">← {t.back}</Link>
 <h1 className="text-2xl font-bold">{t.title}</h1><p className="text-sm text-muted-foreground">{t.intro}</p>
 {error?<p role="alert">{t.error}</p>:rows.length===0?<p>{t.empty}</p>:<ul className="space-y-3">{rows.map(r=><li key={r.user_id} className="space-y-2 rounded-xl border p-4">
 <p className="break-all text-sm">{t.user}: {r.user_id}</p>
 <p>{t.strikes}: {r.strikes} · {t.blocks}: {r.suspension_count}</p>
 <p>{r.permanently_blocked?t.permanent:r.blocked_until&&new Date(r.blocked_until)>new Date()?t.until+": "+new Date(r.blocked_until).toLocaleDateString(locale):t.active}</p>
 {(r.permanently_blocked||r.blocked_until&&new Date(r.blocked_until)>new Date())&&<form action={unblock} className="space-y-2"><input type="hidden" name="user" value={r.user_id}/><label className="block text-sm">{t.reason}<textarea name="reason" minLength={10} required className="mt-1 w-full rounded-lg border bg-background p-2"/></label><button className="rounded-lg bg-violet-600 px-4 py-2 text-white">{t.unblock}</button></form>}
 </li>)}</ul>}
 </main>
}
