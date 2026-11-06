import Link from "next/link"
import {createTask} from "@/lib/actions/uptilldawn"
import {redirect} from "next/navigation"
import {revalidatePath} from "next/cache"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {requestUiLocale} from "@/lib/server-locale"

export const dynamic="force-dynamic"
const copy={
 nl:{title:"Evenementtaken en promotie",intro:"Bekijk evenementtaken vanuit Admin. Nieuwe taken en toewijzingen beheer je via het bestaande taakbeheer.",tasks:"Taakbeheer openen",empty:"Geen evenementtaken gevonden.",error:"Taken konden niet geladen worden.",next:"Volgende",previous:"Vorige",back:"Centraal beheer",event:"Evenement",all:"Alle evenementen",filter:"Filter",clear:"Wissen",eventError:"Evenementen konden niet geladen worden.",create:"Taak aanmaken",name:"Taaknaam",description:"Omschrijving",member:"Medewerkers",selectMember:"Kies één of meerdere medewerkers",unavailable:"Geen beschikbare medewerkers gevonden.",directoryError:"Medewerkers konden niet geladen worden.",assigned:"Toegewezen medewerkers",assign:"Medewerker toevoegen",remove:"Verwijderen",assignmentError:"Toewijzingen konden niet geladen worden.",status:"Status",progress:"Voortgang",confirmed:"Bevestigd",edit:"Taak bewerken",save:"Wijzigingen opslaan"},
 fr:{title:"Tâches événementielles et promotion",intro:"Consultez les tâches événementielles depuis Admin. Gérez les tâches et affectations dans le module existant.",tasks:"Ouvrir les tâches",empty:"Aucune tâche événementielle.",error:"Chargement des tâches impossible.",next:"Suivant",previous:"Précédent",back:"Gestion centrale",event:"Événement",all:"Tous les événements",filter:"Filtrer",clear:"Effacer",eventError:"Chargement des événements impossible.",create:"Créer une tâche",name:"Nom de la tâche",description:"Description",member:"Membres",selectMember:"Choisissez un ou plusieurs membres",unavailable:"Aucun membre disponible.",directoryError:"Impossible de charger les membres.",assigned:"Membres affectés",assign:"Ajouter un membre",remove:"Supprimer",assignmentError:"Impossible de charger les affectations.",status:"Statut",progress:"Progression",confirmed:"Confirmé",edit:"Modifier la tâche",save:"Enregistrer"},
 en:{title:"Event tasks and promotion",intro:"Review event tasks in Admin. Create tasks and manage assignments in the existing task manager.",tasks:"Open task management",empty:"No event tasks found.",error:"Unable to load tasks.",next:"Next",previous:"Previous",back:"Central management",event:"Event",all:"All events",filter:"Filter",clear:"Clear",eventError:"Unable to load events.",create:"Create task",name:"Task name",description:"Description",member:"Members",selectMember:"Select one or more members",unavailable:"No available members found.",directoryError:"Unable to load members.",assigned:"Assigned members",assign:"Add member",remove:"Remove",assignmentError:"Unable to load assignments.",status:"Status",progress:"Progress",confirmed:"Confirmed",edit:"Edit task",save:"Save changes"},
 de:{title:"Eventaufgaben und Promotion",intro:"Eventaufgaben in Admin ansehen. Aufgaben und Zuweisungen in der bestehenden Aufgabenverwaltung bearbeiten.",tasks:"Aufgabenverwaltung öffnen",empty:"Keine Eventaufgaben gefunden.",error:"Aufgaben konnten nicht geladen werden.",next:"Weiter",previous:"Zurück",back:"Zentrale Verwaltung",event:"Event",all:"Alle Events",filter:"Filtern",clear:"Löschen",eventError:"Events konnten nicht geladen werden.",create:"Aufgabe erstellen",name:"Aufgabenname",description:"Beschreibung",member:"Mitarbeiter",selectMember:"Einen oder mehrere Mitarbeiter wählen",unavailable:"Keine verfügbaren Mitarbeiter gefunden.",directoryError:"Mitarbeiter konnten nicht geladen werden.",assigned:"Zugewiesene Mitarbeiter",assign:"Mitarbeiter hinzufügen",remove:"Entfernen",assignmentError:"Zuweisungen konnten nicht geladen werden.",status:"Status",progress:"Fortschritt",confirmed:"Bestätigt",edit:"Aufgabe bearbeiten",save:"Änderungen speichern"},
} as const

const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
async function updateAssignment(form:FormData){
 "use server"
 const actor=await getCurrentUser()
 if(!actor||(!actor.realIsAdmin&&!actor.isOwner)||(!actor.approved&&!actor.isOwner)||actor.account_blocked)throw new Error("Admin authorization required")
 const task=String(form.get("task_id")??"")
 const user=String(form.get("user_id")??"")
 const assignment=String(form.get("assignment_id")??"")
 const remove=form.get("operation")==="remove"
 if(remove?!uuid.test(assignment):!uuid.test(task)||!uuid.test(user))throw new Error("Invalid assignment input")
 const db=await createClient()
 if(!remove){
  const {data:target,error:targetError}=await db.from("tasks").select("event_id").eq("id",task).maybeSingle()
  if(targetError||!target?.event_id)throw new Error("Event task required")
 }
 const {error}=remove?await db.rpc("upt_remove_task_assignment",{p_assignment:assignment}):await db.rpc("upt_assign_task",{p_task:task,p_user:user})
 if(error)throw new Error("Task assignment update failed")
 revalidatePath("/admin/management/event-tasks")
 revalidatePath("/tasks")
}
async function editEventTask(form:FormData){
 "use server"
 const actor=await getCurrentUser()
 if(!actor||(!actor.realIsAdmin&&!actor.isOwner)||(!actor.approved&&!actor.isOwner)||actor.account_blocked)throw new Error("Admin authorization required")
 const task=String(form.get("task_id")??"")
 const title=String(form.get("title")??"").trim()
 const description=String(form.get("description")??"")
 if(!uuid.test(task)||!title||title.length>200||description.length>4000)throw new Error("Invalid task details")
 const db=await createClient()
 const {error}=await db.rpc("upt_admin_update_event_task",{p_task:task,p_title:title,p_description:description})
 if(error)throw new Error("Task update failed")
 revalidatePath("/admin/management/event-tasks")
 revalidatePath("/tasks")
}
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
 const {data:upcomingEvent,error:upcomingError}=!requestedEvent?await db.from("events").select("id").gte("start_at",new Date().toISOString()).order("start_at",{ascending:true}).limit(1).maybeSingle():{data:null,error:null}
 const selectedEvent=requestedEvent?(event??null):(upcomingError?null:(upcomingEvent?.id??(events??[])[0]?.id??null))
 const [{data:available,error:availabilityError},{data:members,error:membersError}]=selectedEvent?await Promise.all([db.from("event_availability").select("user_id").eq("event_id",selectedEvent).eq("response","can").limit(1001),db.from("event_members").select("user_id").eq("event_id",selectedEvent).limit(1001)]):[{data:[],error:null},{data:[],error:null}]
 const availableIds=new Set((available??[]).map(row=>row.user_id))
 const eligibleIds=[...new Set((members??[]).map(row=>row.user_id).filter(id=>availableIds.has(id)))]
 const {data:profiles,error:profilesError}=eligibleIds.length?await db.from("profiles").select("id,full_name").eq("approved",true).in("id",eligibleIds.slice(0,200)):{data:[],error:null}
 const eligible=(profiles??[])
 const directoryIncomplete=(available?.length??0)>1000||(members?.length??0)>1000||eligibleIds.length>200
 const taskIds=rows.map(row=>row.id)
 const {data:assignments,error:assignmentError}=taskIds.length?await db.from("task_assignments").select("id,task_id,user_id,status,confirmed_at").in("task_id",taskIds).limit(1001):{data:[],error:null}
 const assignmentOverflow=(assignments?.length??0)>1000
 const assignedByTask=new Map<string,typeof assignments>()
 for(const item of assignments??[]){const list=assignedByTask.get(item.task_id)??[];list.push(item);assignedByTask.set(item.task_id,list)}
 const assignmentUsers=[...new Set((assignments??[]).map(item=>item.user_id))]
 const {data:assignedProfiles,error:assignedProfilesError}=assignmentUsers.length?await db.from("profiles").select("id,full_name").in("id",assignmentUsers.slice(0,1000)):{data:[],error:null}
 const assignedNames=new Map((assignedProfiles??[]).map(person=>[person.id,person.full_name]))
 const assignmentNamesIncomplete=assignmentUsers.length>1000
 const href=(p:number)=>"/admin/management/event-tasks?page="+p+(event?"&event="+encodeURIComponent(event):"")
 return <main className="mx-auto max-w-4xl space-y-5 p-4 pb-32 md:p-8"><Link href="/admin/management" className="text-sm text-violet-400">← {t.back}</Link><header className="space-y-2"><h1 className="text-2xl font-bold">{t.title}</h1><p className="text-sm text-muted-foreground">{t.intro}</p></header><form method="get" className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-sm">{t.event}<select name="event" defaultValue={event??""} disabled={Boolean(eventsError)} className="rounded-lg border bg-background p-2"><option value="">{t.all}</option>{(events??[]).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="submit" className="rounded-lg border px-4 py-2">{t.filter}</button><Link href="/admin/management/event-tasks" className="rounded-lg border px-4 py-2">{t.clear}</Link></form>{eventsError&&<p role="alert">{t.eventError}</p>}<section className="rounded-xl border bg-card p-4"><h2 className="mb-3 font-semibold">{t.create}</h2>{upcomingError||availabilityError||membersError||profilesError||directoryIncomplete?<p role="alert">{t.directoryError}</p>:!selectedEvent||!eligible.length?<p>{t.unavailable}</p>:<form action={createTask} className="grid gap-3"><label className="grid gap-1 text-sm">{t.event}<input type="hidden" name="event_id" value={selectedEvent}/><span className="rounded-lg border p-2">{eventNames.get(selectedEvent)??selectedEvent}</span></label><label className="grid gap-1 text-sm">{t.member}<span className="text-xs text-muted-foreground">{t.selectMember}</span><select name="user_id" required multiple size={Math.min(8,Math.max(3,eligible.length))} className="rounded-lg border bg-background p-2">{eligible.map(row=><option key={row.id} value={row.id}>{row.full_name||row.id}</option>)}</select></label><label className="grid gap-1 text-sm">{t.name}<input name="title" required maxLength={200} className="rounded-lg border bg-background p-2"/></label><label className="grid gap-1 text-sm">{t.description}<textarea name="description" maxLength={4000} className="rounded-lg border bg-background p-2"/></label><button type="submit" className="rounded-lg border border-violet-500 p-3 font-semibold">{t.create}</button></form>}</section><Link href="/tasks" className="inline-flex rounded-xl border border-violet-500/50 px-4 py-3 font-semibold text-violet-400">{t.tasks}</Link>{error?<p role="alert">{t.error}</p>:rows.length?<ul className="space-y-3">{rows.map(task=><li key={task.id} className="rounded-xl border bg-card p-4"><p className="font-semibold">{task.title}</p><p className="text-xs text-muted-foreground">{t.event}: {eventNames.get(task.event_id)??task.event_id}</p>{task.description&&<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>}<details className="mt-3 rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">{t.edit}</summary><form action={editEventTask} className="mt-3 grid gap-2"><input type="hidden" name="task_id" value={task.id}/><label className="grid gap-1 text-sm">{t.name}<input name="title" defaultValue={task.title} required maxLength={200} className="rounded border bg-background p-2"/></label><label className="grid gap-1 text-sm">{t.description}<textarea name="description" defaultValue={task.description??""} maxLength={4000} className="rounded border bg-background p-2"/></label><button type="submit" className="rounded border p-2">{t.save}</button></form></details><div className="mt-3 space-y-2"><h3 className="text-sm font-semibold">{t.assigned}</h3>{!assignmentError&&!assignmentOverflow&&<p className="text-xs text-muted-foreground">{t.progress}: {(assignedByTask.get(task.id)??[]).filter(item=>item.status==="COMPLETED").length}/{(assignedByTask.get(task.id)??[]).length}</p>}{assignmentError||assignmentOverflow||assignedProfilesError||assignmentNamesIncomplete?<p role="alert">{t.assignmentError}</p>:<>{(assignedByTask.get(task.id)??[]).map(item=><form key={item.id} action={updateAssignment} className="flex items-center justify-between gap-2 rounded-lg border p-2"><span className="text-xs">{assignedNames.get(item.user_id)||item.user_id} · {t.status}: {item.status}{item.status==="COMPLETED"&&item.confirmed_at?` · ${t.confirmed}: ${new Date(item.confirmed_at).toLocaleString(locale)}`:""}</span><input type="hidden" name="operation" value="remove"/><input type="hidden" name="assignment_id" value={item.id}/><button type="submit" className="rounded border px-2 py-1 text-xs">{t.remove}</button></form>)}{selectedEvent===task.event_id&&!assignmentError&&!assignmentOverflow&&!assignedProfilesError&&!assignmentNamesIncomplete&&!directoryIncomplete&&!availabilityError&&!membersError&&!profilesError&&eligible.length>0&&<form action={updateAssignment} className="flex flex-wrap gap-2"><input type="hidden" name="task_id" value={task.id}/><select name="user_id" required defaultValue="" className="min-w-0 flex-1 rounded-lg border bg-background p-2 text-sm"><option value="" disabled>{t.selectMember}</option>{eligible.filter(person=>!(assignedByTask.get(task.id)??[]).some(item=>item.user_id===person.id)).map(person=><option key={person.id} value={person.id}>{person.full_name||person.id}</option>)}</select><button type="submit" className="rounded-lg border px-3 py-2 text-sm">{t.assign}</button></form>}</>}</div></li>)}</ul>:<p className="rounded-xl border p-4">{t.empty}</p>}<nav className="flex justify-between">{page>1?<Link href={href(page-1)} className="rounded-lg border px-3 py-2">{t.previous}</Link>:<span/>}{(data?.length??0)>30&&<Link href={href(page+1)} className="rounded-lg border px-3 py-2">{t.next}</Link>}</nav></main>
}
