import Link from "next/link"
import {revalidatePath} from "next/cache"
import {redirect} from "next/navigation"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {requestUiLocale} from "@/lib/server-locale"

export const dynamic="force-dynamic"

const labels={
 nl:{title:"Promotietaken beheren",intro:"Overzicht van promotieopdrachten binnen Administratie. Bewijzen en blokkeringen beheer je via de controlepagina.",empty:"Geen promotietaken gevonden.",error:"Promotietaken konden niet worden geladen.",review:"Bewijzen, strikes en blokkeringen",back:"Terug naar Marketing",created:"Aangemaakt",assign:"Medewerker toewijzen",choose:"Kies een medewerker",membersError:"Medewerkers konden niet worden geladen.",remove:"Toewijzing verwijderen",member:"Medewerker",assignmentList:"Toegewezen medewerkers",assigned:"Toewijzingen",assignmentError:"Toewijzingen konden niet worden geladen.",event:"Evenement",general:"Algemene taak",scope:"Type taak",all:"Alle taken",eventOnly:"Evenementtaken",generalOnly:"Algemene taken",search:"Zoek promotietaken",find:"Zoeken",clear:"Wissen",previous:"Vorige",next:"Volgende",page:"Pagina"},
 fr:{title:"Gestion des tâches promotionnelles",intro:"Consultez les missions promotionnelles dans Administration. Gérez les preuves et restrictions sur la page de contrôle.",empty:"Aucune tâche trouvée.",error:"Impossible de charger les tâches.",review:"Preuves et restrictions",back:"Retour au marketing",created:"Créée",assign:"Affecter un membre",choose:"Choisir un membre",membersError:"Impossible de charger les membres.",remove:"Supprimer l’affectation",member:"Membre",assignmentList:"Membres affectés",assigned:"Affectations",assignmentError:"Impossible de charger les affectations.",event:"Événement",general:"Tâche générale",scope:"Type de tâche",all:"Toutes les tâches",eventOnly:"Tâches d’événement",generalOnly:"Tâches générales",search:"Rechercher des tâches",find:"Rechercher",clear:"Effacer",previous:"Précédent",next:"Suivant",page:"Page"},
 en:{title:"Manage promotion tasks",intro:"Review promotion assignments inside Administration. Manage evidence and restrictions on the review page.",empty:"No promotion tasks found.",error:"Promotion tasks could not be loaded.",review:"Evidence, strikes and restrictions",back:"Back to Marketing",created:"Created",assign:"Assign staff member",choose:"Choose a staff member",membersError:"Staff members could not be loaded.",remove:"Remove assignment",member:"Staff member",assignmentList:"Assigned staff",assigned:"Assignments",assignmentError:"Assignments could not be loaded.",event:"Event",general:"General task",scope:"Task type",all:"All tasks",eventOnly:"Event tasks",generalOnly:"General tasks",search:"Search promotion tasks",find:"Search",clear:"Clear",previous:"Previous",next:"Next",page:"Page"},
 de:{title:"Promotionsaufgaben verwalten",intro:"Promotionsaufgaben innerhalb der Verwaltung ansehen. Nachweise und Sperren auf der Prüfseite verwalten.",empty:"Keine Aufgaben gefunden.",error:"Aufgaben konnten nicht geladen werden.",review:"Nachweise und Sperren",back:"Zurück zum Marketing",created:"Erstellt",assign:"Mitarbeiter zuweisen",choose:"Mitarbeiter auswählen",membersError:"Mitarbeiter konnten nicht geladen werden.",remove:"Zuweisung entfernen",member:"Mitarbeiter",assignmentList:"Zugewiesene Mitarbeiter",assigned:"Zuweisungen",assignmentError:"Zuweisungen konnten nicht geladen werden.",event:"Veranstaltung",general:"Allgemeine Aufgabe",scope:"Aufgabentyp",all:"Alle Aufgaben",eventOnly:"Eventaufgaben",generalOnly:"Allgemeine Aufgaben",search:"Promotionsaufgaben suchen",find:"Suchen",clear:"Löschen",previous:"Zurück",next:"Weiter",page:"Seite"}
} as const

async function assignPromotionTask(form:FormData){
 "use server"
 const actor=await getCurrentUser()
 if(!actor||( !actor.realIsAdmin&&!actor.isOwner)||(!actor.approved&&!actor.isOwner)||(actor.account_blocked&&!actor.isOwner))throw new Error("Admin authorization required")
 const task=String(form.get("task_id")??"")
 const user=String(form.get("user_id")??"")
 const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
 if(!uuid.test(task)||!uuid.test(user))throw new Error("Invalid task or user")
 const db=await createClient()
 const {data:target,error:taskError}=await db.from("tasks").select("id,event_id").eq("id",task).maybeSingle()
 if(taskError||!target?.event_id)throw new Error("Only event tasks can be assigned through this workflow")
 const {data:membership,error:membershipError}=await db.from("event_members").select("user_id").eq("event_id",target.event_id).eq("user_id",user).maybeSingle()
 if(membershipError||!membership)throw new Error("User is not a member of this event")
 const {data:profile,error:profileError}=await db.from("profiles").select("id").eq("id",user).eq("approved",true).maybeSingle()
 if(profileError||!profile)throw new Error("User is not an approved member")
 const {error}=await db.rpc("upt_assign_task",{p_task:task,p_user:user})
 if(error)throw new Error("Task assignment failed")
 revalidatePath("/portals/administration/promotion-tasks")
 revalidatePath("/admin/management/promotion-tasks")
}

async function removePromotionAssignment(form:FormData){
 "use server"
 const actor=await getCurrentUser()
 if(!actor||(!actor.realIsAdmin&&!actor.isOwner)||(!actor.approved&&!actor.isOwner)||(actor.account_blocked&&!actor.isOwner))throw new Error("Admin authorization required")
 const id=String(form.get("assignment_id")??"")
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))throw new Error("Invalid assignment")
 const db=await createClient()
 const {error}=await db.rpc("upt_remove_task_assignment",{p_assignment:id})
 if(error)throw new Error("Could not remove task assignment")
 revalidatePath("/portals/administration/promotion-tasks")
 revalidatePath("/admin/management/promotion-tasks")
}

export default async function AdministrationPromotionTasks({searchParams,adminView=false}:{searchParams:Promise<{q?:string;page?:string;scope?:string}>;adminView?:boolean}){
 const actor=await getCurrentUser()
 if(!actor)redirect("/login")
 if(adminView&&(!actor.realIsAdmin&&!actor.isOwner||!actor.approved&&!actor.isOwner||actor.account_blocked&&!actor.isOwner))redirect("/admin")
 // The administration layout already enforces approved Administration portal access.
 const locale=await requestUiLocale()
 const t=labels[locale]
 const db=await createClient()
 const params=await searchParams
 const q=typeof params.q==="string"?params.q.trim().slice(0,100):""
 const scope=params.scope==="event"||params.scope==="general"?params.scope:"all"
 const page=typeof params.page==="string"&&/^[1-9]\\d{0,4}$/.test(params.page)?Number(params.page):1
 const pageSize=50
 const offset=(page-1)*pageSize
 let tasksQuery=db.from("tasks").select("id,title,description,event_id,created_at")
 if(scope==="event")tasksQuery=tasksQuery.not("event_id","is",null)
 if(scope==="general")tasksQuery=tasksQuery.is("event_id",null)
 if(q)tasksQuery=tasksQuery.ilike("title",`%${q.replace(/[\\\\%_]/g,match=>"\\\\"+match)}%`)
 const {data,error}=await tasksQuery.order("created_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+pageSize)
 const hasNext=(data?.length??0)>pageSize
 const rows=data?.slice(0,pageSize)??[]
 const taskIds=rows.map(task=>task.id)
 const {data:assignments,error:assignmentError,count:assignmentTotal}=(actor.realIsAdmin||actor.isOwner)&&taskIds.length?await db.from("task_assignments").select("id,task_id,user_id",{count:"exact"}).in("task_id",taskIds).limit(1000):{data:[],error:null,count:0}
 const assignmentOverflow=assignmentTotal===null||assignmentTotal>(assignments?.length??0)
 const assignmentCounts=new Map<string,number>()
 for(const assignment of assignments??[])assignmentCounts.set(assignment.task_id,(assignmentCounts.get(assignment.task_id)??0)+1)
 const assignmentsByTask=new Map<string,Array<{id:string;user_id:string}>>()
 for(const assignment of assignments??[]){const group=assignmentsByTask.get(assignment.task_id)??[];group.push({id:assignment.id,user_id:assignment.user_id});assignmentsByTask.set(assignment.task_id,group)}
 const eventIds=[...new Set(rows.map(task=>task.event_id).filter((id):id is string=>Boolean(id)))]
 const membershipPages:Array<{event_id:string;user_id:string}>=[]
 let membersError=false
 let memberListTruncated=false
 if((actor.realIsAdmin||actor.isOwner)&&eventIds.length){
  for(let offset=0;offset<10000;offset+=1000){
   const {data,error:pageError}=await db.from("event_members").select("event_id,user_id").in("event_id",eventIds).order("event_id").order("user_id").range(offset,offset+999)
   if(pageError){membersError=true;break}
   membershipPages.push(...(data??[]))
   if((data?.length??0)<1000)break
   if(offset===9000)memberListTruncated=true
  }
 }
 const memberships=membershipPages
 const memberIds=[...new Set([...(memberships??[]).map(member=>member.user_id),...(assignments??[]).map(assignment=>assignment.user_id)])]
 const profiles:Array<{id:string;full_name:string|null}>=[]
 let profilesError=false
 for(let offset=0;offset<memberIds.length;offset+=200){
  const {data,error:batchError}=await db.from("profiles").select("id,full_name").eq("approved",true).in("id",memberIds.slice(offset,offset+200))
  if(batchError){profilesError=true;break}
  profiles.push(...(data??[]))
 }
 const names=new Map(profiles.map(profile=>[profile.id,profile.full_name||profile.id]))
 const membersByEvent=new Map<string,Array<{id:string;name:string}>>()
 for(const membership of memberships??[]){if(!names.has(membership.user_id))continue;const group=membersByEvent.get(membership.event_id)??[];group.push({id:membership.user_id,name:names.get(membership.user_id)!});membersByEvent.set(membership.event_id,group)}
 for(const group of membersByEvent.values())group.sort((a,b)=>a.name.localeCompare(b.name,locale))
 const basePath=adminView?"/admin/management/promotion-tasks":"/portals/administration/promotion-tasks"
 const pageHref=(target:number)=>basePath+"?"+new URLSearchParams({...(q?{q}:{}),...(scope!=="all"?{scope}:{}),page:String(target)}).toString()
 return <main className="mx-auto max-w-4xl space-y-5 p-4 pb-36 sm:p-6">
  <Link href={adminView?"/admin/management":"/portals/administration/modules/marketing"} className="text-sm text-violet-400">← {t.back}</Link>
  <header className="space-y-2"><h1 className="text-2xl font-bold">{t.title}</h1><p className="text-sm text-muted-foreground">{t.intro}</p></header>
  <form method="get" action={basePath} role="search" className="flex flex-wrap gap-2"><input name="q" defaultValue={q} aria-label={t.search} placeholder={t.search} className="min-w-0 flex-1 rounded-lg border bg-background p-3"/><select name="scope" defaultValue={scope} aria-label={t.scope} className="rounded-lg border bg-background p-3"><option value="all">{t.all}</option><option value="event">{t.eventOnly}</option><option value="general">{t.generalOnly}</option></select><button className="rounded-lg border px-4 py-2">{t.find}</button>{(q||scope!=="all")&&<Link href={basePath} className="rounded-lg border px-4 py-2">{t.clear}</Link>}</form>
  <Link href={adminView?"/admin/management/promotion-discipline":"/portals/administration/promotion-discipline"} className="inline-flex rounded-xl border border-violet-500/40 px-4 py-3 font-semibold text-violet-400">{t.review}</Link>
  {(actor.realIsAdmin||actor.isOwner)&&(assignmentError||assignmentOverflow)&&<p role="alert">{t.assignmentError}</p>}
  {error?<p role="alert" className="rounded-xl border p-4">{t.error}</p>:!rows.length?<p className="rounded-xl border p-4 text-muted-foreground">{t.empty}</p>:<ul className="space-y-2">{rows.map(task=><li key={task.id} className="rounded-xl border bg-card p-4"><p className="font-semibold">{task.title}</p>{task.description&&<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>}<p className="mt-2 text-xs text-muted-foreground">{task.event_id?`${t.event}: ${task.event_id}`:t.general}</p>{(actor.realIsAdmin||actor.isOwner)&&task.event_id&&!membersError&&!profilesError&&!memberListTruncated&&!assignmentError&&!assignmentOverflow&&<form action={assignPromotionTask} className="mt-3 flex flex-wrap items-end gap-2"><input type="hidden" name="task_id" value={task.id}/><label className="flex min-w-0 flex-1 flex-col gap-1 text-xs">{t.choose}<select name="user_id" required defaultValue="" className="rounded-lg border bg-background p-2"><option value="" disabled>{t.choose}</option>{(membersByEvent.get(task.event_id)??[]).filter(member=>!(assignmentsByTask.get(task.id)??[]).some(assignment=>assignment.user_id===member.id)).map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select></label><button className="rounded-lg border px-3 py-2 text-sm">{t.assign}</button></form>}{(actor.realIsAdmin||actor.isOwner)&&!assignmentError&&!assignmentOverflow&&<section aria-label={t.assignmentList} className="mt-3 space-y-2"><p className="text-xs text-muted-foreground">{t.assigned}: {assignmentCounts.get(task.id)??0}</p>{(assignmentsByTask.get(task.id)??[]).map(assignment=><form key={assignment.id} action={removePromotionAssignment} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2"><span className="break-all text-xs">{t.member}: {names.get(assignment.user_id)??assignment.user_id}</span><input type="hidden" name="assignment_id" value={assignment.id}/><button className="rounded-lg border px-3 py-2 text-xs">{t.remove}</button></form>)}</section>}<p className="mt-1 text-xs text-muted-foreground">{t.created}: {new Date(task.created_at).toLocaleDateString(locale)}</p></li>)}</ul>}
  {(membersError||profilesError||memberListTruncated)&&<p role="alert" className="rounded-xl border p-3">{t.membersError}</p>}
  {assignmentError&&<p role="alert" className="rounded-xl border p-3">{t.assignmentError}</p>}
  {!error&&(page>1||hasNext)&&<nav aria-label={t.page} className="flex items-center justify-between gap-3 rounded-xl border p-3"><span className="text-sm">{t.page} {page}</span><div className="flex gap-2">{page>1&&<Link href={pageHref(page-1)} className="rounded-lg border px-3 py-2 text-sm">{t.previous}</Link>}{hasNext&&<Link href={pageHref(page+1)} className="rounded-lg border px-3 py-2 text-sm">{t.next}</Link>}</div></nav>}
 </main>
}
