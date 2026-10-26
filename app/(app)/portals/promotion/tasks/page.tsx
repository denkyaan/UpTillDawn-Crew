import Link from "next/link"
import {createHash,randomUUID} from "node:crypto"
import {requestUiLocale} from "@/lib/server-locale"
import {createClient} from "@/lib/supabase/crew-server"
import {getCurrentUser} from "@/lib/actions/auth"
import {redirect} from "next/navigation"
import {revalidatePath} from "next/cache"
export const dynamic="force-dynamic"
const labels={
 nl:{title:"Promotietaken",intro:"Bekijk je toegewezen promotieopdrachten. Taken buiten evenementen blijven beschikbaar.",empty:"Geen promotietaken toegewezen.",error:"Taken kunnen momenteel niet worden geladen.",status:"Status",start:"Start",complete:"Voltooien",history:"Taakhistoriek",back:"Terug naar promotie"},
 fr:{title:"Tâches promotionnelles",intro:"Consultez vos missions promotionnelles, même hors événement.",empty:"Aucune tâche promotionnelle attribuée.",error:"Impossible de charger les tâches.",status:"Statut",start:"Commencer",complete:"Terminer",history:"Historique des tâches",back:"Retour à la promotion"},
 en:{title:"Promotion tasks",intro:"Review your assigned promotion work, including tasks outside events.",empty:"No promotion tasks assigned.",error:"Tasks are currently unavailable.",status:"Status",start:"Start",complete:"Complete",history:"Task history",back:"Back to promotion"},
 de:{title:"Promotionaufgaben",intro:"Deine zugewiesenen Promotionaufgaben, auch außerhalb von Events.",empty:"Keine Promotionaufgaben zugewiesen.",error:"Aufgaben derzeit nicht verfügbar.",status:"Status",start:"Starten",complete:"Abschließen",history:"Aufgabenverlauf",back:"Zurück zur Promotion"},
} as const
async function changePromotionTaskStatus(formData:FormData){
 "use server"
 const current=await getCurrentUser()
 if(!current)redirect("/login")
 const id=String(formData.get("assignment_id")??"")
 const status=String(formData.get("status")??"")
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)||status!=="IN PROGRESS")return
 const db=await createClient()
 const {data:blocked,error:blockError}=await db.rpc("upt_promotion_is_blocked" as never)
 if(blockError||blocked)throw new Error("Promotion access blocked")
 const {error}=await db.rpc("upt_update_task_status",{p_assignment:id,p_status:status})
 if(error)throw new Error("Task status update failed")
 revalidatePath("/portals/promotion/tasks")
}
async function submitPromotionEvidence(formData:FormData){
 "use server"
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 const assignment=String(formData.get("assignment_id")??"")
 const file=formData.get("evidence")
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(assignment)||!(file instanceof File))return
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size<1||file.size>10*1024*1024)throw new Error("Invalid image")
 const db=await createClient()
 const {data:blocked,error:blockError}=await db.rpc("upt_promotion_is_blocked" as never)
 if(blockError||blocked)throw new Error("Promotion access blocked")
 const {data:assigned,error:assignmentError}=await db.from("task_assignments").select("id,status").eq("id",assignment).eq("user_id",user.id).maybeSingle()
 if(assignmentError||!assigned||assigned.status!=="IN PROGRESS")throw new Error("Assignment must be in progress to submit evidence")
 const bytes=Buffer.from(await file.arrayBuffer())
 if(bytes.length!==file.size||bytes.length>10*1024*1024)throw new Error("Invalid image size")
 // Validate actual file signatures, not only browser-supplied MIME types.
 const isJpeg=bytes.length>=4&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff
 const isPng=bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString("ascii",12,16)==="IHDR"
 const isWebp=bytes.length>=16&&bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP"
 if(!((file.type==="image/jpeg"&&isJpeg)||(file.type==="image/png"&&isPng)||(file.type==="image/webp"&&isWebp)))throw new Error("Image format does not match file contents")
 const sha=createHash("sha256").update(bytes).digest("hex")
 const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg"
 const path=`${user.id}/promotion/${randomUUID()}.${ext}`
 const {error:uploadError}=await db.storage.from("work-media").upload(path,bytes,{contentType:file.type,upsert:false})
 if(uploadError)throw new Error("Evidence upload failed")
 const {error:saveError}=await db.rpc("upt_submit_promotion_evidence" as never,{p_assignment:assignment,p_storage_path:path,p_sha256:sha} as never)
 if(saveError){
  const {error:cleanupError}=await db.storage.from("work-media").remove([path])
  if(cleanupError)throw new Error("Evidence registration failed; uploaded file cleanup also failed")
  throw new Error("Evidence registration failed")
 }
 revalidatePath("/portals/promotion/tasks")
}
export default async function PromotionTasks(){
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 const locale=await requestUiLocale()
 const t=labels[locale]
 const db=await createClient()
 const {data:promotionBlocked}=await db.rpc("upt_promotion_is_blocked" as never)
 const isPromotionBlocked=promotionBlocked===true
 const {data:evidence}=await db.from("promotion_evidence" as never).select("assignment_id,verification_status,verification_details,submitted_at").eq("submitted_by",user.id).order("submitted_at",{ascending:false}).limit(100)
 const evidenceRows=(evidence??[]) as unknown as {assignment_id:string;verification_status:string;verification_details:unknown;submitted_at:string}[]
 const precheckLabels={nl:{exact_file_match:"Bestand identiek aan referentie; publicatie niet bevestigd",no_exact_file_match:"Geen exacte bestandsovereenkomst; controle nodig",no_reference:"Geen officieel referentiemateriaal beschikbaar"},fr:{exact_file_match:"Fichier identique à la référence ; publication non confirmée",no_exact_file_match:"Aucune correspondance exacte ; vérification requise",no_reference:"Aucune référence officielle disponible"},en:{exact_file_match:"File matches reference; publication not verified",no_exact_file_match:"No exact file match; review needed",no_reference:"No official reference available"},de:{exact_file_match:"Datei entspricht der Referenz; Veröffentlichung nicht bestätigt",no_exact_file_match:"Keine exakte Übereinstimmung; Prüfung nötig",no_reference:"Kein offizielles Referenzmaterial verfügbar"}} as const
 const evidenceStatusLabels={
  nl:{pending:"In afwachting",verified:"Geverifieerd",rejected:"Afgewezen",inconclusive:"Verder onderzoek nodig"},
  fr:{pending:"En attente",verified:"Vérifié",rejected:"Rejeté",inconclusive:"Examen complémentaire"},
  en:{pending:"Pending",verified:"Verified",rejected:"Rejected",inconclusive:"Further review needed"},
  de:{pending:"Ausstehend",verified:"Verifiziert",rejected:"Abgelehnt",inconclusive:"Weitere Prüfung erforderlich"}
 } as const
 const {data,error}=await db.from("task_assignments").select("id,status,created_at,tasks(id,title,description,event_id,updated_at)").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100)
 return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
  <Link href="/portals/promotion" className="text-sm text-violet-400">← {t.back}</Link>
  <header><h1 className="text-2xl font-bold">{t.title}</h1><p className="mt-2 text-sm text-muted-foreground">{t.intro}</p></header>
  {isPromotionBlocked&&<p role="alert" className="rounded-lg border border-amber-500 p-3 text-sm">{({nl:"Je promotietoegang is tijdelijk of definitief geblokkeerd. Je kunt geen promotietaken starten of bewijzen indienen.",fr:"Votre accès à la promotion est suspendu. Vous ne pouvez pas démarrer des tâches ni envoyer des preuves.",en:"Your promotion access is restricted. You cannot start tasks or submit evidence.",de:"Dein Promotionzugang ist gesperrt. Du kannst keine Aufgaben starten oder Nachweise einreichen."} as const)[locale]}</p>}
  <p className="text-xs text-muted-foreground">{t.history}</p>
  {error?<p role="alert">{t.error}</p>:!data?.length?<p className="rounded-xl border p-5 text-muted-foreground">{t.empty}</p>:<ul className="space-y-3">{data.map(item=><li key={item.id} className="rounded-xl border bg-card p-4"><h2 className="font-semibold">{item.tasks?.title??"—"}</h2>{item.tasks?.description&&<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.tasks.description}</p>}<p className="mt-3 text-xs text-violet-400">{t.status}: {item.status}</p>{!isPromotionBlocked&&item.status==="NOT STARTED"&&<form action={changePromotionTaskStatus} className="mt-3"><input type="hidden" name="assignment_id" value={item.id}/><button type="submit" name="status" value="IN PROGRESS" className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white">{t.start}</button></form>}{!isPromotionBlocked&&item.status==="IN PROGRESS"&&<form action={submitPromotionEvidence} className="mt-3 flex flex-wrap items-center gap-2"><input type="hidden" name="assignment_id" value={item.id}/><input type="file" name="evidence" accept="image/png,image/jpeg,image/webp" required className="max-w-full text-xs"/><button type="submit" className="rounded-lg border border-violet-500 px-3 py-2 text-sm">{({nl:"Bewijs indienen",fr:"Envoyer la preuve",en:"Submit evidence",de:"Nachweis senden"} as const)[locale]}</button><span className="text-xs text-muted-foreground">{evidenceRows.find(e=>e.assignment_id===item.id)?.verification_status??"—"} · {(()=>{const details=evidenceRows.find(e=>e.assignment_id===item.id)?.verification_details;const check=details&&typeof details==="object"&&"reference_check" in details?String(details.reference_check):"";return check in precheckLabels[locale]?precheckLabels[locale][check as keyof typeof precheckLabels.nl]:""})()}</span></form>}{evidenceRows.filter(e=>e.assignment_id===item.id).length>0&&<div className="mt-3 space-y-1 border-t pt-3"><p className="text-xs font-semibold">{t.history}</p>{evidenceRows.filter(e=>e.assignment_id===item.id).map((e,i)=><p key={e.submitted_at+"-"+i} className="text-xs text-muted-foreground"><time dateTime={e.submitted_at}>{new Date(e.submitted_at).toLocaleString(locale)}</time> · {e.verification_status in evidenceStatusLabels[locale]?evidenceStatusLabels[locale][e.verification_status as keyof typeof evidenceStatusLabels.nl]:e.verification_status}</p>)}</div>}</li>)}</ul>}
 </main>
}
