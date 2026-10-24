import Link from "next/link"
import {PromotionVisualReview} from "@/components/promotion-visual-review"
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
 const isJpeg=bytes.length>=4&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff
 const isPng=bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString("ascii",12,16)==="IHDR"
 const isWebp=bytes.length>=16&&bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP"
 if(!((file.type==="image/jpeg"&&isJpeg)||(file.type==="image/png"&&isPng)||(file.type==="image/webp"&&isWebp)))throw new Error("Invalid reference image format")
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
 const {data:pendingEvidence,error:pendingError}=await db.from("promotion_evidence" as never).select("id,assignment_id,submitted_by,submitted_at,verification_status,verification_details,storage_path").in("verification_status",["pending","inconclusive"]).order("submitted_at",{ascending:false}).limit(50)
 const pendingRows=(pendingEvidence??[]) as unknown as {id:string;assignment_id:string;submitted_by:string;submitted_at:string;verification_status:string;verification_details:Record<string,unknown>;storage_path:string}[]
 // Storage signed URLs are short-lived and never expose the private bucket publicly.
 const evidenceLinks=await Promise.all(pendingRows.map(async e=>{
  if(!e.storage_path)return {id:e.id,url:null}
  const {data:signed}=await db.storage.from("work-media").createSignedUrl(e.storage_path,300)
  return {id:e.id,url:signed?.signedUrl??null}
 }))
 const evidenceUrlById=new Map(evidenceLinks.map(e=>[e.id,e.url]))
 const {data:referenceRows,error:referenceError}=await db.from("promotion_reference_media" as never).select("id,task_id,storage_path,created_at").order("created_at",{ascending:false}).limit(50)
 const references=(referenceRows??[]) as unknown as {id:string;task_id:string;storage_path:string;created_at:string}[]
 const referenceLinks=await Promise.all(references.map(async r=>{
  if(!r.storage_path)return {id:r.id,url:null}
  const {data:signed}=await db.storage.from("work-media").createSignedUrl(r.storage_path,300)
  return {id:r.id,url:signed?.signedUrl??null}
 }))
 const referenceUrlById=new Map(referenceLinks.map(r=>[r.id,r.url]))
 const {data:taskRows,error:taskError}=await db.from("tasks").select("id,title").order("created_at",{ascending:false}).limit(100)
 const assignmentIds=[...new Set(pendingRows.map(e=>e.assignment_id))]
 const {data:evidenceAssignments}=assignmentIds.length
  ?await db.from("task_assignments").select("id,task_id").in("id",assignmentIds)
  :{data:[] as {id:string;task_id:string}[]}
 const taskIds=[...new Set((evidenceAssignments??[]).map(a=>a.task_id))]
 const {data:evidenceTasks}=taskIds.length
  ?await db.from("tasks").select("id,title").in("id",taskIds)
  :{data:[] as {id:string;title:string}[]}
 const evidenceTaskByAssignment=new Map((evidenceAssignments??[]).map(a=>[a.id,(evidenceTasks??[]).find(t=>t.id===a.task_id)?.title??a.task_id]))
 const evidenceTaskIdByAssignment=new Map((evidenceAssignments??[]).map(a=>[a.id,a.task_id]))
 const referenceIdsByTask=new Map<string,string[]>()
 for(const reference of references){
  referenceIdsByTask.set(reference.task_id,[...(referenceIdsByTask.get(reference.task_id)??[]),reference.id])
 }
 return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
 <Link href="/portals/administration" className="text-sm text-violet-400">← {t.back}</Link>
 <h1 className="text-2xl font-bold">{t.title}</h1><section className="space-y-2 rounded-xl border p-4"><h2 className="font-semibold">{({nl:"Bewijs in afwachting van controle",fr:"Preuves en attente de vérification",en:"Evidence awaiting verification",de:"Nachweise zur Überprüfung"} as const)[locale]}</h2>{pendingError?<p role="alert">{t.error}</p>:pendingRows.length===0?<p className="text-sm text-muted-foreground">{({nl:"Geen openstaande bewijzen.",fr:"Aucune preuve en attente.",en:"No pending evidence.",de:"Keine offenen Nachweise."} as const)[locale]}</p>:<ul className="space-y-2">{pendingRows.map(e=><li key={e.id} className="rounded-lg border p-2 text-xs"><p className="font-semibold">{evidenceTaskByAssignment.get(e.assignment_id)??e.assignment_id}</p><p className="break-all text-muted-foreground">{e.submitted_by} · {e.assignment_id}</p><p>{e.verification_status} · {new Date(e.submitted_at).toLocaleString(locale)}</p><p>{String(e.verification_details?.reference_check??"—")}</p><p className="text-amber-600">{({nl:"Niet automatisch geverifieerd: publicatiebewijs en inhoud vereisen onafhankelijke controle.",fr:"Non vérifié automatiquement : la publication et le contenu exigent une vérification indépendante.",en:"Not automatically verified: publication and content require independent review.",de:"Nicht automatisch verifiziert: Veröffentlichung und Inhalt erfordern eine unabhängige Prüfung."} as const)[locale]}</p>{(referenceIdsByTask.get(evidenceTaskIdByAssignment.get(e.assignment_id)??"")??[]).map(refId=>referenceUrlById.get(refId)?<span key={refId} className="ml-3"><a href={referenceUrlById.get(refId)??"#"} target="_blank" rel="noopener noreferrer" className="text-violet-400 underline">{({nl:"Bijhorende referentie (5 min)",fr:"Référence associée (5 min)",en:"Matching reference (5 min)",de:"Zugehörige Referenz (5 Min.)"} as const)[locale]}</a></span>:null)}{evidenceUrlById.get(e.id)&&(referenceIdsByTask.get(evidenceTaskIdByAssignment.get(e.assignment_id)??"")??[]).some(refId=>referenceUrlById.has(refId))&&<PromotionVisualReview locale={locale} evidenceUrl={evidenceUrlById.get(e.id)!} referenceUrls={(referenceIdsByTask.get(evidenceTaskIdByAssignment.get(e.assignment_id)??"")??[]).map(refId=>referenceUrlById.get(refId)).filter((url):url is string=>Boolean(url))}/>} {evidenceUrlById.get(e.id)&&<a href={evidenceUrlById.get(e.id)??"#"} target="_blank" rel="noopener noreferrer" className="text-violet-400 underline">{({nl:"Screenshot bekijken (5 min)",fr:"Voir la capture (5 min)",en:"View screenshot (5 min)",de:"Screenshot ansehen (5 Min.)"} as const)[locale]}</a>}</li>)}</ul>}</section><section className="space-y-2 rounded-xl border p-4"><h2 className="font-semibold">{({nl:"Geregistreerd promotiemateriaal",fr:"Supports promotionnels enregistrés",en:"Registered promotion media",de:"Registriertes Werbematerial"} as const)[locale]}</h2>{referenceError?<p role="alert">{t.error}</p>:references.length===0?<p className="text-sm text-muted-foreground">{({nl:"Nog geen referenties.",fr:"Aucune référence pour le moment.",en:"No references yet.",de:"Noch keine Referenzen."} as const)[locale]}</p>:<ul className="space-y-2">{references.map(r=><li key={r.id} className="rounded-lg border p-2 text-xs"><p>{taskRows?.find(t=>t.id===r.task_id)?.title??r.task_id}</p><p className="text-muted-foreground">{new Date(r.created_at).toLocaleString(locale)}</p>{referenceUrlById.get(r.id)&&<a href={referenceUrlById.get(r.id)??"#"} target="_blank" rel="noopener noreferrer" className="text-violet-400 underline">{({nl:"Referentie bekijken (5 min)",fr:"Voir la référence (5 min)",en:"View reference (5 min)",de:"Referenz ansehen (5 Min.)"} as const)[locale]}</a>}</li>)}</ul>}</section><form action={registerReference} className="space-y-2 rounded-xl border p-4"><label className="block text-sm">{({nl:"Taak-ID",fr:"ID de tâche",en:"Task ID",de:"Aufgaben-ID"} as const)[locale]}<select name="task_id" required className="mt-1 w-full rounded-lg border bg-background p-2"><option value="">{({nl:"Selecteer een taak",fr:"Sélectionner une tâche",en:"Select a task",de:"Aufgabe auswählen"} as const)[locale]}</option>{taskRows?.map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select>{taskError&&<span role="alert" className="text-xs text-red-500">{t.error}</span>}</label><label className="block text-sm">{({nl:"Officiële referentieafbeelding",fr:"Image de référence officielle",en:"Official reference image",de:"Offizielles Referenzbild"} as const)[locale]}<input type="file" name="reference" accept="image/jpeg,image/png,image/webp" required className="mt-1 block max-w-full"/></label><button className="rounded-lg bg-violet-600 px-4 py-2 text-white">{({nl:"Referentie registreren",fr:"Enregistrer la référence",en:"Register reference",de:"Referenz registrieren"} as const)[locale]}</button></form><p className="text-sm text-muted-foreground">{t.intro}</p>
 {error?<p role="alert">{t.error}</p>:rows.length===0?<p>{t.empty}</p>:<ul className="space-y-3">{rows.map(r=><li key={r.user_id} className="space-y-2 rounded-xl border p-4">
 <p className="break-all text-sm">{t.user}: {r.user_id}</p>
 <p>{t.strikes}: {r.strikes} · {t.blocks}: {r.suspension_count}</p>
 <p>{r.permanently_blocked?t.permanent:r.blocked_until&&new Date(r.blocked_until)>new Date()?t.until+": "+new Date(r.blocked_until).toLocaleDateString(locale):t.active}</p>
 {(r.permanently_blocked||r.blocked_until&&new Date(r.blocked_until)>new Date())&&<form action={unblock} className="space-y-2"><input type="hidden" name="user" value={r.user_id}/><label className="block text-sm">{t.reason}<textarea name="reason" minLength={10} required className="mt-1 w-full rounded-lg border bg-background p-2"/></label><button className="rounded-lg bg-violet-600 px-4 py-2 text-white">{t.unblock}</button></form>}
 </li>)}</ul>}
 </main>
}
