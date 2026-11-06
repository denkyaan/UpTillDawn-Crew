import Link from "next/link"
import {redirect} from "next/navigation"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {requestUiLocale} from "@/lib/server-locale"

export const dynamic="force-dynamic"
const copy={
 nl:{title:"Evenementtaken en promotie",intro:"Bekijk evenementtaken vanuit Admin. Nieuwe taken en toewijzingen beheer je via het bestaande taakbeheer.",tasks:"Taakbeheer openen",empty:"Geen evenementtaken gevonden.",error:"Taken konden niet geladen worden.",next:"Volgende",previous:"Vorige",back:"Centraal beheer",event:"Evenement",all:"Alle evenementen",filter:"Filter",clear:"Wissen",eventError:"Evenementen konden niet geladen worden."},
 fr:{title:"Tâches événementielles et promotion",intro:"Consultez les tâches événementielles depuis Admin. Gérez les tâches et affectations dans le module existant.",tasks:"Ouvrir les tâches",empty:"Aucune tâche événementielle.",error:"Chargement des tâches impossible.",next:"Suivant",previous:"Précédent",back:"Gestion centrale",event:"Événement",all:"Tous les événements",filter:"Filtrer",clear:"Effacer",eventError:"Chargement des événements impossible."},
 en:{title:"Event tasks and promotion",intro:"Review event tasks in Admin. Create tasks and manage assignments in the existing task manager.",tasks:"Open task management",empty:"No event tasks found.",error:"Unable to load tasks.",next:"Next",previous:"Previous",back:"Central management",event:"Event",all:"All events",filter:"Filter",clear:"Clear",eventError:"Unable to load events."},
 de:{title:"Eventaufgaben und Promotion",intro:"Eventaufgaben in Admin ansehen. Aufgaben und Zuweisungen in der bestehenden Aufgabenverwaltung bearbeiten.",tasks:"Aufgabenverwaltung öffnen",empty:"Keine Eventaufgaben gefunden.",error:"Aufgaben konnten nicht geladen werden.",next:"Weiter",previous:"Zurück",back:"Zentrale Verwaltung",event:"Event",all:"Alle Events",filter:"Filtern",clear:"Löschen",eventError:"Events konnten nicht geladen werden."},
} as const
export default async function AdminEventTasks({searchParams}:{searchParams:Promise<{page?:string;event?:string}>}){
 const actor=await getCurrentUser()
 if(!actor?.isAdmin||(!actor.approved&&!actor.isOwner)||actor.account_blocked&&!actor.isOwner)redirect("/")
 const locale=await requestUiLocale()
 const t=copy[locale]
 const params=await searchParams
 const page=typeof params.page==="string"&&/^[1-9]\d{0,3}$/.test(params.page)?Number(params.page):1
 const db=await createClient()
 const {data:events,error:eventsError}=await db.from("events").select("id,name").order("start_at",{ascending:false}).limit(300)
 const eventIds=new Set((events??[]).map(event=>event.id))
 const requestedEvent=typeof params.event==="string"&&params.event.length>0?params.event:null
 const event=requestedEvent&&eventIds.has(requestedEvent)?requestedEvent:null
 let query=db.from("tasks").select("id,title,description,event_id,created_at").not("event_id","is",null)
 if(event)query=query.eq("event_id",event)
 if(requestedEvent&&!event)query=query.eq("event_id",requestedEvent)
 const {data,error}=await query.order("created_at",{ascending:false}).order("id",{ascending:false}).range((page-1)*30,page*30)
 const eventNames=new Map((events??[]).map(item=>[item.id,item.name]))
 const rows=(data??[]).slice(0,30)
 const href=(p:number)=>"/admin/management/event-tasks?page="+p+(event?"&event="+encodeURIComponent(event):"")
 return <main className="mx-auto max-w-4xl space-y-5 p-4 pb-32 md:p-8"><Link href="/admin/management" className="text-sm text-violet-400">← {t.back}</Link><header className="space-y-2"><h1 className="text-2xl font-bold">{t.title}</h1><p className="text-sm text-muted-foreground">{t.intro}</p></header><form method="get" className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-sm">{t.event}<select name="event" defaultValue={event??""} disabled={Boolean(eventsError)} className="rounded-lg border bg-background p-2"><option value="">{t.all}</option>{(events??[]).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="submit" className="rounded-lg border px-4 py-2">{t.filter}</button><Link href="/admin/management/event-tasks" className="rounded-lg border px-4 py-2">{t.clear}</Link></form>{eventsError&&<p role="alert">{t.eventError}</p>}<Link href="/tasks" className="inline-flex rounded-xl border border-violet-500/50 px-4 py-3 font-semibold text-violet-400">{t.tasks}</Link>{error?<p role="alert">{t.error}</p>:rows.length?<ul className="space-y-3">{rows.map(task=><li key={task.id} className="rounded-xl border bg-card p-4"><p className="font-semibold">{task.title}</p><p className="text-xs text-muted-foreground">{t.event}: {eventNames.get(task.event_id)??task.event_id}</p>{task.description&&<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>}</li>)}</ul>:<p className="rounded-xl border p-4">{t.empty}</p>}<nav className="flex justify-between">{page>1?<Link href={href(page-1)} className="rounded-lg border px-3 py-2">{t.previous}</Link>:<span/>}{(data?.length??0)>30&&<Link href={href(page+1)} className="rounded-lg border px-3 py-2">{t.next}</Link>}</nav></main>
}
