import {listPage} from "@/lib/list-query"
import {PendingSubmitButton} from "@/components/ui/pending-submit-button"
import Link from "next/link"
import {createHash,randomUUID} from "node:crypto"
import {requestUiLocale} from "@/lib/server-locale"
import {createClient} from "@/lib/supabase/crew-server"
import {getCurrentUser} from "@/lib/actions/auth"
import {redirect} from "next/navigation"
import {revalidatePath} from "next/cache"
import {canOpenPortal,type PortalAssignment} from "@/lib/portal-access"
export const dynamic="force-dynamic"
const labels={
 nl:{title:"Promotietaken",intro:"Bekijk je toegewezen promotieopdrachten. Taken buiten evenementen blijven beschikbaar.",empty:"Geen promotietaken toegewezen.",error:"Taken kunnen momenteel niet worden geladen.",status:"Status",start:"Start",complete:"Voltooien",history:"Taakhistoriek",back:"Terug naar promotie"},
 fr:{title:"Tâches promotionnelles",intro:"Consultez vos missions promotionnelles, même hors événement.",empty:"Aucune tâche promotionnelle attribuée.",error:"Impossible de charger les tâches.",status:"Statut",start:"Commencer",complete:"Terminer",history:"Historique des tâches",back:"Retour à la promotion"},
 en:{title:"Promotion tasks",intro:"Review your assigned promotion work, including tasks outside events.",empty:"No promotion tasks assigned.",error:"Tasks are currently unavailable.",status:"Status",start:"Start",complete:"Complete",history:"Task history",back:"Back to promotion"},
 de:{title:"Promotionaufgaben",intro:"Deine zugewiesenen Promotionaufgaben, auch außerhalb von Events.",empty:"Keine Promotionaufgaben zugewiesen.",error:"Aufgaben derzeit nicht verfügbar.",status:"Status",start:"Starten",complete:"Abschließen",history:"Aufgabenverlauf",back:"Zurück zur Promotion"},
} as const
async function requirePromotionAccess(){
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 if((!user.approved||user.account_blocked)&&!user.isOwner)throw new Error("Promotion access denied")
 const db=await createClient()
 if(!user.isOwner&&!user.realIsAdmin){
  const {data,error}=await db.rpc("upt_my_portal_assignments")
  if(error||!canOpenPortal("promotion",(data??[]) as PortalAssignment[],{approved:user.approved,blocked:user.account_blocked===true}))throw new Error("Promotion access denied")
 }
 return {user,db}
}
const validAssignmentId=(id:string)=>/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)
async function changePromotionTaskStatus(formData:FormData){
 "use server"
 const {user,db}=await requirePromotionAccess()
 const id=String(formData.get("assignment_id")??"")
 const status=String(formData.get("status")??"")
 if(!validAssignmentId(id)||status!=="IN PROGRESS")throw new Error("Invalid promotion task transition")
 const {data:blocked,error:blockError}=await db.rpc("upt_promotion_is_blocked" as never)
 if(blockError||blocked)throw new Error("Promotion access blocked")
 const {data:assigned,error:assignmentError}=await db.from("task_assignments").select("id,status,confirmed_at").eq("id",id).eq("user_id",user.id).maybeSingle()
 if(assignmentError||!assigned||(assigned.status!=="NOT STARTED"&&(assigned.status!=="IN PROGRESS"||assigned.confirmed_at!==null)))throw new Error("Only your open assignment can be started or confirmed")
 const {error}=await db.rpc("upt_start_promotion_task",{p_assignment:id})
 if(error)throw new Error("Task status update failed")
 revalidatePath("/portals/promotion/tasks")
}
async function submitPromotionEvidence(formData:FormData){
 "use server"
 const {user,db}=await requirePromotionAccess()
 const assignment=String(formData.get("assignment_id")??"")
 const file=formData.get("evidence")
 if(!validAssignmentId(assignment)||!(file instanceof File))throw new Error("Invalid promotion evidence submission")
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size<1||file.size>10*1024*1024)throw new Error("Invalid image")
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
export default async function PromotionTasks({searchParams}:{searchParams:Promise<{page?:string}>}){
 const {user,db}=await requirePromotionAccess()
 const locale=await requestUiLocale()
 const t=labels[locale]
 const {data:promotionBlocked,error:promotionBlockError}=await db.rpc("upt_promotion_is_blocked" as never)
 // Fail closed when the restriction check cannot be completed.
 const isPromotionBlocked=promotionBlockError!==null||promotionBlocked!==false
 const precheckLabels={nl:{exact_file_match:"Bestand identiek aan referentie; publicatie niet bevestigd",no_exact_file_match:"Geen exacte bestandsovereenkomst; controle nodig",no_reference:"Geen officieel referentiemateriaal beschikbaar"},fr:{exact_file_match:"Fichier identique à la référence ; publication non confirmée",no_exact_file_match:"Aucune correspondance exacte ; vérification requise",no_reference:"Aucune référence officielle disponible"},en:{exact_file_match:"File matches reference; publication not verified",no_exact_file_match:"No exact file match; review needed",no_reference:"No official reference available"},de:{exact_file_match:"Datei entspricht der Referenz; Veröffentlichung nicht bestätigt",no_exact_file_match:"Keine exakte Übereinstimmung; Prüfung nötig",no_reference:"Kein offizielles Referenzmaterial verfügbar"}} as const
 const evidenceStatusLabels={
  nl:{pending:"In afwachting",verified:"Geverifieerd",rejected:"Afgewezen",inconclusive:"Verder onderzoek nodig"},
  fr:{pending:"En attente",verified:"Vérifié",rejected:"Rejeté",inconclusive:"Examen complémentaire"},
  en:{pending:"Pending",verified:"Verified",rejected:"Rejected",inconclusive:"Further review needed"},
  de:{pending:"Ausstehend",verified:"Verifiziert",rejected:"Abgelehnt",inconclusive:"Weitere Prüfung erforderlich"}
 } as const
 const assignmentStatusLabels={
  nl:{"NOT STARTED":"Nog te starten","IN PROGRESS":"Bezig","COMPLETED":"Voltooid","CANCELLED":"Geannuleerd"},
  fr:{"NOT STARTED":"À commencer","IN PROGRESS":"En cours","COMPLETED":"Terminée","CANCELLED":"Annulée"},
  en:{"NOT STARTED":"Not started","IN PROGRESS":"In progress","COMPLETED":"Completed","CANCELLED":"Cancelled"},
  de:{"NOT STARTED":"Noch nicht begonnen","IN PROGRESS":"In Bearbeitung","COMPLETED":"Abgeschlossen","CANCELLED":"Abgebrochen"}
 } as const
 const rawPage=(await searchParams).page??"1"
 const page=listPage(rawPage,9999)
 const offset=(page-1)*100
 const {data,error}=await db.from("task_assignments").select("id,status,confirmed_at,created_at,tasks(id,title,description,event_id,updated_at)").eq("user_id",user.id).order("created_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+100)
 const visibleAssignmentIds=(data??[]).slice(0,100).map(item=>item.id)
 const {data:evidence,error:evidenceError}=visibleAssignmentIds.length?await db.from("promotion_evidence" as never).select("assignment_id,verification_status,verification_details,submitted_at").eq("submitted_by",user.id).in("assignment_id",visibleAssignmentIds).order("submitted_at",{ascending:false}).limit(1000):{data:[],error:null}
 const evidenceRows=(evidence??[]) as unknown as {assignment_id:string;verification_status:string;verification_details:unknown;submitted_at:string}[]
 const evidenceByAssignment=new Map<string,typeof evidenceRows>()
 for(const entry of evidenceRows){const history=evidenceByAssignment.get(entry.assignment_id)??[];history.push(entry);evidenceByAssignment.set(entry.assignment_id,history)}
 return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
  <Link href="/portals/promotion" className="text-sm text-violet-400">← {t.back}</Link>
  <header><h1 className="text-2xl font-bold">{t.title}</h1><p className="mt-2 text-sm text-muted-foreground">{t.intro}</p></header>
  <p className="text-xs text-muted-foreground">{({nl:"Pagina",fr:"Page",en:"Page",de:"Seite"} as const)[locale]} {page}</p>
  {evidenceRows.length===1000&&<p role="status" className="rounded-lg border p-3 text-sm">{({nl:"Enkel de 1000 recentste bewijsindieningen voor deze takenpagina worden getoond.",fr:"Seuls les 1000 derniers dépôts de preuves pour cette page de tâches sont affichés.",en:"Only the 1000 most recent evidence submissions for this task page are shown.",de:"Nur die 1000 neuesten Nachweise für diese Aufgabenseite werden angezeigt."} as const)[locale]}</p>}
  {evidenceError&&<p role="alert" className="rounded-lg border border-amber-500 p-3 text-sm">{({nl:"Bewijsstatussen konden niet geladen worden. Controleer je indieningen later opnieuw.",fr:"Les statuts des preuves sont indisponibles. Réessayez plus tard.",en:"Evidence statuses are unavailable. Check your submissions again later.",de:"Nachweisstatus nicht verfügbar. Bitte später erneut prüfen."} as const)[locale]}</p>}
  {isPromotionBlocked&&<p role="alert" className="rounded-lg border border-amber-500 p-3 text-sm">{({nl:"Je promotietoegang is tijdelijk of definitief geblokkeerd. Je kunt geen promotietaken starten of bewijzen indienen.",fr:"Votre accès à la promotion est suspendu. Vous ne pouvez pas démarrer des tâches ni envoyer des preuves.",en:"Your promotion access is restricted. You cannot start tasks or submit evidence.",de:"Dein Promotionzugang ist gesperrt. Du kannst keine Aufgaben starten oder Nachweise einreichen."} as const)[locale]}</p>}
  <p className="text-xs text-muted-foreground">{t.history}</p>
  {error?<p role="alert">{t.error}</p>:!data?.length?<p className="rounded-xl border p-5 text-muted-foreground">{t.empty}</p>:<ul className="space-y-3">{data.slice(0,100).map(item=><li key={item.id} className="rounded-xl border bg-card p-4"><h2 className="font-semibold">{item.tasks?.title??"—"}</h2>{item.tasks?.description&&<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.tasks.description}</p>}<p className="mt-3 text-xs text-violet-400">{t.status}: {item.status in assignmentStatusLabels[locale]?assignmentStatusLabels[locale][item.status as keyof typeof assignmentStatusLabels.nl]:item.status}</p>{!isPromotionBlocked&&(item.status==="NOT STARTED"||(item.status==="IN PROGRESS"&&!item.confirmed_at))&&<form action={changePromotionTaskStatus} className="mt-3"><input type="hidden" name="assignment_id" value={item.id}/><PendingSubmitButton name="status" value="IN PROGRESS" pendingLabel={t.start+"…"} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white">{item.status==="NOT STARTED"?t.start:({nl:"Wijzigingen bevestigen",fr:"Confirmer les modifications",en:"Confirm changes",de:"Änderungen bestätigen"} as const)[locale]}</PendingSubmitButton></form>}{!isPromotionBlocked&&item.status==="IN PROGRESS"&&Boolean(item.confirmed_at)&&<form action={submitPromotionEvidence} className="mt-3 flex flex-wrap items-center gap-2"><input type="hidden" name="assignment_id" value={item.id}/><input type="file" name="evidence" accept="image/png,image/jpeg,image/webp" required className="max-w-full text-xs"/><button type="submit" className="rounded-lg border border-violet-500 px-3 py-2 text-sm">{({nl:"Bewijs indienen",fr:"Envoyer la preuve",en:"Submit evidence",de:"Nachweis senden"} as const)[locale]}</button><span className="text-xs text-muted-foreground">{(()=>{const status=evidenceByAssignment.get(item.id)?.[0]?.verification_status;return evidenceError?"—":status&&status in evidenceStatusLabels[locale]?evidenceStatusLabels[locale][status as keyof typeof evidenceStatusLabels.nl]:"—"})()} · {(()=>{const details=evidenceByAssignment.get(item.id)?.[0]?.verification_details;const check=details&&typeof details==="object"&&"reference_check" in details?String(details.reference_check):"";return check in precheckLabels[locale]?precheckLabels[locale][check as keyof typeof precheckLabels.nl]:""})()}</span></form>}{(evidenceByAssignment.get(item.id)?.length??0)>0&&<div className="mt-3 space-y-1 border-t pt-3"><p className="text-xs font-semibold">{t.history}</p>{(evidenceByAssignment.get(item.id)??[]).map((e,i)=><p key={e.submitted_at+"-"+i} className="text-xs text-muted-foreground"><time dateTime={e.submitted_at}>{new Date(e.submitted_at).toLocaleString(locale)}</time> · {e.verification_status in evidenceStatusLabels[locale]?evidenceStatusLabels[locale][e.verification_status as keyof typeof evidenceStatusLabels.nl]:e.verification_status}</p>)}</div>}</li>)}</ul>}
  {!error&&<nav aria-label={({nl:"Takenpagina’s",fr:"Pages des tâches",en:"Task pages",de:"Aufgabenseiten"} as const)[locale]} className="flex items-center justify-between gap-3 pt-3">{page>1?<Link href={`/portals/promotion/tasks?page=${page-1}`} className="rounded-lg border px-4 py-2 text-sm">{({nl:"Vorige",fr:"Précédent",en:"Previous",de:"Zurück"} as const)[locale]}</Link>:<span/>}{page<9999&&(data?.length??0)>100&&<Link href={`/portals/promotion/tasks?page=${page+1}`} className="rounded-lg border px-4 py-2 text-sm">{({nl:"Volgende",fr:"Suivant",en:"Next",de:"Weiter"} as const)[locale]}</Link>}</nav>}
 </main>
}
