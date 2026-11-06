import Link from "next/link"
import {redirect} from "next/navigation"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {requestUiLocale} from "@/lib/server-locale"

export const dynamic="force-dynamic"

const labels={
 nl:{title:"Promotietaken beheren",intro:"Overzicht van promotieopdrachten binnen Administratie. Bewijzen en blokkeringen beheer je via de controlepagina.",empty:"Geen promotietaken gevonden.",error:"Promotietaken konden niet worden geladen.",review:"Bewijzen, strikes en blokkeringen",back:"Terug naar Marketing",created:"Aangemaakt",event:"Evenement",general:"Algemene taak",search:"Zoek promotietaken",find:"Zoeken",clear:"Wissen",previous:"Vorige",next:"Volgende",page:"Pagina"},
 fr:{title:"Gestion des tâches promotionnelles",intro:"Consultez les missions promotionnelles dans Administration. Gérez les preuves et restrictions sur la page de contrôle.",empty:"Aucune tâche trouvée.",error:"Impossible de charger les tâches.",review:"Preuves et restrictions",back:"Retour au marketing",created:"Créée",event:"Événement",general:"Tâche générale",search:"Rechercher des tâches",find:"Rechercher",clear:"Effacer",previous:"Précédent",next:"Suivant",page:"Page"},
 en:{title:"Manage promotion tasks",intro:"Review promotion assignments inside Administration. Manage evidence and restrictions on the review page.",empty:"No promotion tasks found.",error:"Promotion tasks could not be loaded.",review:"Evidence, strikes and restrictions",back:"Back to Marketing",created:"Created",event:"Event",general:"General task",search:"Search promotion tasks",find:"Search",clear:"Clear",previous:"Previous",next:"Next",page:"Page"},
 de:{title:"Promotionsaufgaben verwalten",intro:"Promotionsaufgaben innerhalb der Verwaltung ansehen. Nachweise und Sperren auf der Prüfseite verwalten.",empty:"Keine Aufgaben gefunden.",error:"Aufgaben konnten nicht geladen werden.",review:"Nachweise und Sperren",back:"Zurück zum Marketing",created:"Erstellt",event:"Veranstaltung",general:"Allgemeine Aufgabe",search:"Promotionsaufgaben suchen",find:"Suchen",clear:"Löschen",previous:"Zurück",next:"Weiter",page:"Seite"}
} as const

export default async function AdministrationPromotionTasks({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
 const actor=await getCurrentUser()
 if(!actor)redirect("/login")
 // The administration layout already enforces approved Administration portal access.
 const locale=await requestUiLocale()
 const t=labels[locale]
 const db=await createClient()
 const params=await searchParams
 const q=typeof params.q==="string"?params.q.trim().slice(0,100):""
 const page=typeof params.page==="string"&&/^[1-9]\\d{0,4}$/.test(params.page)?Number(params.page):1
 const pageSize=50
 const offset=(page-1)*pageSize
 let tasksQuery=db.from("tasks").select("id,title,description,event_id,created_at")
 if(q)tasksQuery=tasksQuery.ilike("title",`%${q.replace(/[\\\\%_]/g,match=>"\\\\"+match)}%`)
 const {data,error}=await tasksQuery.order("created_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+pageSize)
 const hasNext=(data?.length??0)>pageSize
 const rows=data?.slice(0,pageSize)??[]
 const pageHref=(target:number)=>"/portals/administration/promotion-tasks?"+new URLSearchParams({...(q?{q}:{}),page:String(target)}).toString()
 return <main className="mx-auto max-w-4xl space-y-5 p-4 pb-36 sm:p-6">
  <Link href="/portals/administration/modules/marketing" className="text-sm text-violet-400">← {t.back}</Link>
  <header className="space-y-2"><h1 className="text-2xl font-bold">{t.title}</h1><p className="text-sm text-muted-foreground">{t.intro}</p></header>
  <form method="get" action="/portals/administration/promotion-tasks" role="search" className="flex flex-wrap gap-2"><input name="q" defaultValue={q} aria-label={t.search} placeholder={t.search} className="min-w-0 flex-1 rounded-lg border bg-background p-3"/><button className="rounded-lg border px-4 py-2">{t.find}</button>{q&&<Link href="/portals/administration/promotion-tasks" className="rounded-lg border px-4 py-2">{t.clear}</Link>}</form>
  <Link href="/portals/administration/promotion-discipline" className="inline-flex rounded-xl border border-violet-500/40 px-4 py-3 font-semibold text-violet-400">{t.review}</Link>
  {error?<p role="alert" className="rounded-xl border p-4">{t.error}</p>:!rows.length?<p className="rounded-xl border p-4 text-muted-foreground">{t.empty}</p>:<ul className="space-y-2">{rows.map(task=><li key={task.id} className="rounded-xl border bg-card p-4"><p className="font-semibold">{task.title}</p>{task.description&&<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>}<p className="mt-2 text-xs text-muted-foreground">{task.event_id?`${t.event}: ${task.event_id}`:t.general}</p><p className="mt-1 text-xs text-muted-foreground">{t.created}: {new Date(task.created_at).toLocaleDateString(locale)}</p></li>)}</ul>}
  {!error&&(page>1||hasNext)&&<nav aria-label={t.page} className="flex items-center justify-between gap-3 rounded-xl border p-3"><span className="text-sm">{t.page} {page}</span><div className="flex gap-2">{page>1&&<Link href={pageHref(page-1)} className="rounded-lg border px-3 py-2 text-sm">{t.previous}</Link>}{hasNext&&<Link href={pageHref(page+1)} className="rounded-lg border px-3 py-2 text-sm">{t.next}</Link>}</div></nav>}
 </main>
}
