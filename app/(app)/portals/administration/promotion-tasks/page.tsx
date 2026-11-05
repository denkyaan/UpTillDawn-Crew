import Link from "next/link"
import {redirect} from "next/navigation"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {requestUiLocale} from "@/lib/server-locale"

export const dynamic="force-dynamic"

const labels={
 nl:{title:"Promotietaken beheren",intro:"Overzicht van promotieopdrachten binnen Administratie. Bewijzen en blokkeringen beheer je via de controlepagina.",empty:"Geen promotietaken gevonden.",error:"Promotietaken konden niet worden geladen.",review:"Bewijzen, strikes en blokkeringen",back:"Terug naar Marketing",created:"Aangemaakt"},
 fr:{title:"Gestion des tâches promotionnelles",intro:"Consultez les missions promotionnelles dans Administration. Gérez les preuves et restrictions sur la page de contrôle.",empty:"Aucune tâche trouvée.",error:"Impossible de charger les tâches.",review:"Preuves et restrictions",back:"Retour au marketing",created:"Créée"},
 en:{title:"Manage promotion tasks",intro:"Review promotion assignments inside Administration. Manage evidence and restrictions on the review page.",empty:"No promotion tasks found.",error:"Promotion tasks could not be loaded.",review:"Evidence, strikes and restrictions",back:"Back to Marketing",created:"Created"},
 de:{title:"Promotionsaufgaben verwalten",intro:"Promotionsaufgaben innerhalb der Verwaltung ansehen. Nachweise und Sperren auf der Prüfseite verwalten.",empty:"Keine Aufgaben gefunden.",error:"Aufgaben konnten nicht geladen werden.",review:"Nachweise und Sperren",back:"Zurück zum Marketing",created:"Erstellt"}
} as const

export default async function AdministrationPromotionTasks(){
 const actor=await getCurrentUser()
 if(!actor)redirect("/login")
 if(!actor.isAdmin&&!actor.isOwner)redirect("/portals/administration")
 const locale=await requestUiLocale()
 const t=labels[locale]
 const db=await createClient()
 const {data,error}=await db.from("tasks").select("id,title,created_at").order("created_at",{ascending:false}).limit(100)
 return <main className="mx-auto max-w-4xl space-y-5 p-4 pb-36 sm:p-6">
  <Link href="/portals/administration/modules/marketing" className="text-sm text-violet-400">← {t.back}</Link>
  <header className="space-y-2"><h1 className="text-2xl font-bold">{t.title}</h1><p className="text-sm text-muted-foreground">{t.intro}</p></header>
  <Link href="/portals/administration/promotion-discipline" className="inline-flex rounded-xl border border-violet-500/40 px-4 py-3 font-semibold text-violet-400">{t.review}</Link>
  {error?<p role="alert" className="rounded-xl border p-4">{t.error}</p>:!data?.length?<p className="rounded-xl border p-4 text-muted-foreground">{t.empty}</p>:<ul className="space-y-2">{data.map(task=><li key={task.id} className="rounded-xl border bg-card p-4"><p className="font-semibold">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{t.created}: {new Date(task.created_at).toLocaleDateString(locale)}</p></li>)}</ul>}
 </main>
}
