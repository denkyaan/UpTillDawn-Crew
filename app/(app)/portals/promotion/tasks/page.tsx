import Link from "next/link"
import {requestUiLocale} from "@/lib/server-locale"
import {createClient} from "@/lib/supabase/crew-server"
import {getCurrentUser} from "@/lib/actions/auth"
import {redirect} from "next/navigation"
export const dynamic="force-dynamic"
const labels={
 nl:{title:"Promotietaken",intro:"Bekijk je toegewezen promotieopdrachten. Taken buiten evenementen blijven beschikbaar.",empty:"Geen promotietaken toegewezen.",error:"Taken kunnen momenteel niet worden geladen.",status:"Status",back:"Terug naar promotie"},
 fr:{title:"Tâches promotionnelles",intro:"Consultez vos missions promotionnelles, même hors événement.",empty:"Aucune tâche promotionnelle attribuée.",error:"Impossible de charger les tâches.",status:"Statut",back:"Retour à la promotion"},
 en:{title:"Promotion tasks",intro:"Review your assigned promotion work, including tasks outside events.",empty:"No promotion tasks assigned.",error:"Tasks are currently unavailable.",status:"Status",back:"Back to promotion"},
 de:{title:"Promotionaufgaben",intro:"Deine zugewiesenen Promotionaufgaben, auch außerhalb von Events.",empty:"Keine Promotionaufgaben zugewiesen.",error:"Aufgaben derzeit nicht verfügbar.",status:"Status",back:"Zurück zur Promotion"},
} as const
export default async function PromotionTasks(){
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 const locale=await requestUiLocale()
 const t=labels[locale]
 const db=await createClient()
 const {data,error}=await db.from("task_assignments").select("id,status,created_at,tasks(id,title,description,event_id,updated_at)").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100)
 return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
  <Link href="/portals/promotion" className="text-sm text-violet-400">← {t.back}</Link>
  <header><h1 className="text-2xl font-bold">{t.title}</h1><p className="mt-2 text-sm text-muted-foreground">{t.intro}</p></header>
  {error?<p role="alert">{t.error}</p>:!data?.length?<p className="rounded-xl border p-5 text-muted-foreground">{t.empty}</p>:<ul className="space-y-3">{data.map(item=><li key={item.id} className="rounded-xl border bg-card p-4"><h2 className="font-semibold">{item.tasks?.title??"—"}</h2>{item.tasks?.description&&<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.tasks.description}</p>}<p className="mt-3 text-xs text-violet-400">{t.status}: {item.status}</p></li>)}</ul>}
 </main>
}
