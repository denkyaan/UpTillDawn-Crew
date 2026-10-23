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
 const {data:assigned,error:assignmentError}=await db.from("task_assignments").select("id").eq("id",assignment).eq("user_id",user.id).maybeSingle()
 if(assignmentError||!assigned)throw new Error("Assignment unavailable")
 const bytes=Buffer.from(await file.arrayBuffer())
 const sha=createHash("sha256").update(bytes).digest("hex")
 const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg"
 const path=`${user.id}/promotion/${randomUUID()}.${ext}`
 const {error:uploadError}=await db.storage.from("work-media").upload(path,bytes,{contentType:file.type,upsert:false})
 if(uploadError)throw new Error("Evidence upload failed")
 const {error:saveError}=await db.rpc("upt_submit_promotion_evidence" as never,{p_assignment:assignment,p_storage_path:path,p_sha256:sha} as never)
 if(saveError){await db.storage.from("work-media").remove([path]);throw new Error("Evidence registration failed")}
 revalidatePath("/portals/promotion/tasks")
}
export default async function PromotionTasks(){
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 const locale=await requestUiLocale()
 const t=labels[locale]
 const db=await createClient()
 const {data:evidence}=await db.from("promotion_evidence" as never).select("assignment_id,verification_status,submitted_at").eq("submitted_by",user.id).order("submitted_at",{ascending:false}).limit(100)
 const evidenceRows=(evidence??[]) as unknown as {assignment_id:string;verification_status:string;submitted_at:string}[]
 const {data,error}=await db.from("task_assignments").select("id,status,created_at,tasks(id,title,description,event_id,updated_at)").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100)
 return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
  <Link href="/portals/promotion" className="text-sm text-violet-400">← {t.back}</Link>
  <header><h1 className="text-2xl font-bold">{t.title}</h1><p className="mt-2 text-sm text-muted-foreground">{t.intro}</p></header>
  <p className="text-xs text-muted-foreground">{t.history}</p>
  {error?<p role="alert">{t.error}</p>:!data?.length?<p className="rounded-xl border p-5 text-muted-foreground">{t.empty}</p>:<ul className="space-y-3">{data.map(item=><li key={item.id} className="rounded-xl border bg-card p-4"><h2 className="font-semibold">{item.tasks?.title??"—"}</h2>{item.tasks?.description&&<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.tasks.description}</p>}<p className="mt-3 text-xs text-violet-400">{t.status}: {item.status}</p>{item.status==="NOT STARTED"&&<form action={changePromotionTaskStatus} className="mt-3"><input type="hidden" name="assignment_id" value={item.id}/><button type="submit" name="status" value="IN PROGRESS" className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white">{t.start}</button></form>}{<form action={submitPromotionEvidence} className="mt-3 flex flex-wrap items-center gap-2"><input type="hidden" name="assignment_id" value={item.id}/><input type="file" name="evidence" accept="image/png,image/jpeg,image/webp" required className="max-w-full text-xs"/><button type="submit" className="rounded-lg border border-violet-500 px-3 py-2 text-sm">{({nl:"Bewijs indienen",fr:"Envoyer la preuve",en:"Submit evidence",de:"Nachweis senden"} as const)[locale]}</button><span className="text-xs text-muted-foreground">{evidenceRows.find(e=>e.assignment_id===item.id)?.verification_status??"—"}</span></form>}</li>)}</ul>}
 </main>
}
