import Link from "next/link"
import {createTask} from "@/lib/actions/uptilldawn"
import {redirect} from "next/navigation"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {requestUiLocale} from "@/lib/server-locale"

export const dynamic="force-dynamic"
const copy={
 nl:{title:"Evenementtaken en promotie",intro:"Bekijk evenementtaken vanuit Admin. Nieuwe taken en toewijzingen beheer je via het bestaande taakbeheer.",tasks:"Taakbeheer openen",empty:"Geen evenementtaken gevonden.",error:"Taken konden niet geladen worden.",next:"Volgende",previous:"Vorige",back:"Centraal beheer",event:"Evenement",all:"Alle evenementen",filter:"Filter",clear:"Wissen",eventError:"Evenementen konden niet geladen worden.",create:"Taak aanmaken",name:"Taaknaam",description:"Omschrijving",member:"Medewerker",selectMember:"Kies medewerker",unavailable:"Geen beschikbare medewerkers gevonden.",directoryError:"Medewerkers konden niet geladen worden."},
 fr:{title:"Tâches événementielles et promotion",intro:"Consultez les tâches événementielles depuis Admin. Gérez les tâches et affectations dans le module existant.",tasks:"Ouvrir les tâches",empty:"Aucune tâche événementielle.",error:"Chargement des tâches impossible.",next:"Suivant",previous:"Précédent",back:"Gestion centrale",event:"Événement",all:"Tous les événements",filter:"Filtrer",clear:"Effacer",eventError:"Chargement des événements impossible.",create:"Créer une tâche",name:"Nom de la tâche",description:"Description",member:"Membre",selectMember:"Choisir un membre",unavailable:"Aucun membre disponible.",directoryError:"Impossible de charger les membres."},
 en:{title:"Event tasks and promotion",intro:"Review event tasks in Admin. Create tasks and manage assignments in the existing task manager.",tasks:"Open task management",empty:"No event tasks found.",error:"Unable to load tasks.",next:"Next",previous:"Previous",back:"Central management",event:"Event",all:"All events",filter:"Filter",clear:"Clear",eventError:"Unable to load events.",create:"Create task",name:"Task name",description:"Description",member:"Member",selectMember:"Select member",unavailable:"No available members found.",directoryError:"Unable to load members."},
 de:{title:"Eventaufgaben und Promotion",intro:"Eventaufgaben in Admin ansehen. Aufgaben und Zuweisungen in der bestehenden Aufgabenverwaltung bearbeiten.",tasks:"Aufgabenverwaltung öffnen",empty:"Keine Eventaufgaben gefunden.",error:"Aufgaben konnten nicht geladen werden.",next:"Weiter",previous:"Zurück",back:"Zentrale Verwaltung",event:"Event",all:"Alle Events",filter:"Filtern",clear:"Löschen",eventError:"Events konnten nicht geladen werden.",create:"Aufgabe erstellen",name:"Aufgabenname",description:"Beschreibung",member:"Mitarbeiter",selectMember:"Mitarbeiter wählen",unavailable:"Keine verfügbaren Mitarbeiter gefunden.",directoryError:"Mitarbeiter konnten nicht geladen werden."},
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
 const selectedEvent=event??(events??[])[0]?.id??null
 const [{data:available,error:availabilityError},{data:members,error:membersError}]=selectedEvent?await Promise.all([db.from("event_availability").select("user_id").eq("event_id",selectedEvent).eq("response","can").limit(1001),db.from("event_members").select("user_id").eq("event_id",selectedEvent).limit(1001)]):[{data:[],error:null},{data:[],error:null}]
 const availableIds=new Set((available??[]).map(row=>row.user_id))
 const eligibleIds=[...new Set((members??[]).map(row=>row.user_id).filter(id=>availableIds.has(id)))]
 const {data:profiles,error:profilesError}=eligibleIds.length?await db.from("profiles").select("id,full_name").eq("approved",true).in("id",eligibleIds.slice(0,200)):{data:[],error:null}
 const eligible=(profiles??[])
 const directoryIncomplete=(available?.length??0)>1000||(members?.length??0)>1000||eligibleIds.length>200
 const href=(p:number)=>"/admin/management/event-tasks?page="+p+(event?"&event="+encodeURIComponent(event):"")
 return <main className="mx-auto max-w-4xl space-y-5 p-4 pb-32 md:p-8"><Link href="/admin/management" className="text-sm text-violet-400">← {t.back}</Link><header className="space-y-2"><h1 className="text-2xl font-bold">{t.title}</h1><p className="text-sm text-muted-foreground">{t.intro}</p></header><form method="get" className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-sm">{t.event}<select name="event" defaultValue={event??""} disabled={Boolean(eventsError)} className="rounded-lg border bg-background p-2"><option value="">{t.all}</option>{(events??[]).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="submit" className="rounded-lg border px-4 py-2">{t.filter}</button><Link href="/admin/management/event-tasks" className="rounded-lg border px-4 py-2">{t.clear}</Link></form>{eventsError&&<p role="alert">{t.eventError}</p>}<section className="rounded-xl border bg-card p-4"><h2 className="mb-3 font-semibold">{t.create}</h2>{availabilityError||membersError||profilesError||directoryIncomplete?<p role="alert">{t.directoryError}</p>:!selectedEvent||!eligible.length?<p>{t.unavailable}</p>:<form action={createTask} className="grid gap-3"><label className="grid gap-1 text-sm">{t.event}<input type="hidden" name="event_id" value={selectedEvent}/><span className="rounded-lg border p-2">{eventNames.get(selectedEvent)??selectedEvent}</span></label><label className="grid gap-1 text-sm">{t.member}<select name="user_id" required defaultValue="" className="rounded-lg border bg-background p-2"><option value="" disabled>{t.selectMember}</option>{eligible.map(row=><option key={row.id} value={row.id}>{row.full_name||row.id}</option>)}</select></label><label className="grid gap-1 text-sm">{t.name}<input name="title" required maxLength={200} className="rounded-lg border bg-background p-2"/></label><label className="grid gap-1 text-sm">{t.description}<textarea name="description" maxLength={4000} className="rounded-lg border bg-background p-2"/></label><button type="submit" className="rounded-lg border border-violet-500 p-3 font-semibold">{t.create}</button></form>}</section><Link href="/tasks" className="inline-flex rounded-xl border border-violet-500/50 px-4 py-3 font-semibold text-violet-400">{t.tasks}</Link>{error?<p role="alert">{t.error}</p>:rows.length?<ul className="space-y-3">{rows.map(task=><li key={task.id} className="rounded-xl border bg-card p-4"><p className="font-semibold">{task.title}</p><p className="text-xs text-muted-foreground">{t.event}: {eventNames.get(task.event_id)??task.event_id}</p>{task.description&&<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>}</li>)}</ul>:<p className="rounded-xl border p-4">{t.empty}</p>}<nav className="flex justify-between">{page>1?<Link href={href(page-1)} className="rounded-lg border px-3 py-2">{t.previous}</Link>:<span/>}{(data?.length??0)>30&&<Link href={href(page+1)} className="rounded-lg border px-3 py-2">{t.next}</Link>}</nav></main>
}
