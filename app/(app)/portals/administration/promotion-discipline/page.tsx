import Link from "next/link"
import {createHash,randomUUID} from "node:crypto"
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
async function registerReference(form:FormData){
 "use server"
 const actor=await getCurrentUser()
 if(!actor?.isAdmin&&!actor?.isOwner)throw new Error("Admin required")
 const task=String(form.get("task_id")??"")
 const file=form.get("reference")
 if(!/^[0-9a-f-]{36}$/i.test(task)||!(file instanceof File)||!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size<1||file.size>10*1024*1024)throw new Error("Invalid reference")
 const db=await createClient()
 const bytes=Buffer.from(await file.arrayBuffer())
 const sha=createHash("sha256").update(bytes).digest("hex")
 const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg"
 const path=`${actor.id}/promotion-reference/${randomUUID()}.${ext}`
 const {error:uploadError}=await db.storage.from("work-media").upload(path,bytes,{contentType:file.type,upsert:false})
 if(uploadError)throw new Error("Reference upload failed")
 const {error}=await db.rpc("upt_admin_register_promotion_reference" as never,{p_task:task,p_path:path,p_sha256:sha} as never)
 if(error){await db.storage.from("work-media").remove([path]);throw new Error("Reference registration failed")}
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
 const {data:taskRows,error:taskError}=await db.from("tasks").select("id,title").order("created_at",{ascending:false}).limit(100)
 return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
 <Link href="/portals/administration" className="text-sm text-violet-400">← {t.back}</Link>
 <h1 className="text-2xl font-bold">{t.title}</h1><form action={registerReference} className="space-y-2 rounded-xl border p-4"><label className="block text-sm">{({nl:"Taak-ID",fr:"ID de tâche",en:"Task ID",de:"Aufgaben-ID"} as const)[locale]}<select name="task_id" required className="mt-1 w-full rounded-lg border bg-background p-2"><option value="">{({nl:"Selecteer een taak",fr:"Sélectionner une tâche",en:"Select a task",de:"Aufgabe auswählen"} as const)[locale]}</option>{taskRows?.map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select>{taskError&&<span role="alert" className="text-xs text-red-500">{t.error}</span>}</label><label className="block text-sm">{({nl:"Officiële referentieafbeelding",fr:"Image de référence officielle",en:"Official reference image",de:"Offizielles Referenzbild"} as const)[locale]}<input type="file" name="reference" accept="image/jpeg,image/png,image/webp" required className="mt-1 block max-w-full"/></label><button className="rounded-lg bg-violet-600 px-4 py-2 text-white">{({nl:"Referentie registreren",fr:"Enregistrer la référence",en:"Register reference",de:"Referenz registrieren"} as const)[locale]}</button></form><p className="text-sm text-muted-foreground">{t.intro}</p>
 {error?<p role="alert">{t.error}</p>:rows.length===0?<p>{t.empty}</p>:<ul className="space-y-3">{rows.map(r=><li key={r.user_id} className="space-y-2 rounded-xl border p-4">
 <p className="break-all text-sm">{t.user}: {r.user_id}</p>
 <p>{t.strikes}: {r.strikes} · {t.blocks}: {r.suspension_count}</p>
 <p>{r.permanently_blocked?t.permanent:r.blocked_until&&new Date(r.blocked_until)>new Date()?t.until+": "+new Date(r.blocked_until).toLocaleDateString(locale):t.active}</p>
 {(r.permanently_blocked||r.blocked_until&&new Date(r.blocked_until)>new Date())&&<form action={unblock} className="space-y-2"><input type="hidden" name="user" value={r.user_id}/><label className="block text-sm">{t.reason}<textarea name="reason" minLength={10} required className="mt-1 w-full rounded-lg border bg-background p-2"/></label><button className="rounded-lg bg-violet-600 px-4 py-2 text-white">{t.unblock}</button></form>}
 </li>)}</ul>}
 </main>
}
